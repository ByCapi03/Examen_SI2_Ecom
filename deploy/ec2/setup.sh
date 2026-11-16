#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ATEMPORAL en un solo EC2 (Ubuntu 24.04, t3.micro): API NestJS + web React con HTTPS.
#
#   https://<ip-con-guiones>.sslip.io        → web (Caddy sirve frontend/dist)
#   https://api.<ip-con-guiones>.sslip.io    → API (Caddy → Node en :3000)
#
# sslip.io convierte el nombre en la IP del servidor y Caddy saca el certificado HTTPS
# (Let's Encrypt) solo: no hace falta comprar un dominio. Si la IP cambia (al detener e
# iniciar la instancia) el dominio se recalcula en cada arranque y la web no se recompila,
# porque se compila con VITE_API_URL="https://api.{host}" (ver frontend/src/config/resolveApiUrl.ts).
#
# Requisitos previos (los escribe el "User data" de la instancia, NO están en git):
#   /etc/atemporal/backend.env    variables del backend (DATABASE_URL, JWT_SECRET, claves…)
#   /etc/atemporal/frontend.env   variables VITE_* de la web
#
# Instalar o ACTUALIZAR (trae lo último de la rama y recompila): sudo bash setup.sh
# Es idempotente: se puede ejecutar las veces que haga falta.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Ricardo01rivero/Examen_SI2_Ecom.git}"
BRANCH="${BRANCH:-ricardo}"
APP=/opt/atemporal/app
ETC=/etc/atemporal
WEB_ROOT=/var/www/atemporal
RUN_USER=ubuntu
export DEBIAN_FRONTEND=noninteractive

log() { echo "[$(date '+%H:%M:%S')] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo"; exit 1; }
for f in backend.env frontend.env; do
  [ -f "$ETC/$f" ] || { echo "Falta $ETC/$f (lo crea el User data de la instancia)"; exit 1; }
done

# 1. Memoria de intercambio: 1 GB de RAM no alcanza para compilar la web.
if ! swapon --show | grep -q /swapfile; then
  log "Creando swap de 2 GB"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Node 22, git y Caddy
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  log "Instalando Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
command -v git >/dev/null || apt-get install -y git >/dev/null
if ! command -v caddy >/dev/null; then
  log "Instalando Caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update >/dev/null && apt-get install -y caddy >/dev/null
fi

# 3. Código (copia del servidor: se alinea siempre con la rama remota)
if [ -d "$APP/.git" ]; then
  log "Actualizando código ($BRANCH)"
  git -C "$APP" fetch --depth 50 origin "$BRANCH"
  git -C "$APP" reset --hard "origin/$BRANCH"
else
  log "Clonando $REPO_URL ($BRANCH)"
  mkdir -p "$(dirname "$APP")"
  git clone --branch "$BRANCH" --depth 50 "$REPO_URL" "$APP"
fi
chown -R "$RUN_USER:$RUN_USER" "$APP"

# 4. Backend
log "Compilando backend"
install -m 600 -o "$RUN_USER" -g "$RUN_USER" "$ETC/backend.env" "$APP/backend/.env"
sudo -u "$RUN_USER" bash -c "cd '$APP/backend' && npm ci --include=dev --no-audit --no-fund --loglevel=error && npm run build"

# 5. Web (Vite lee .env.production.local al compilar)
log "Compilando web (tarda varios minutos en un t3.micro)"
install -m 600 -o "$RUN_USER" -g "$RUN_USER" "$ETC/frontend.env" "$APP/frontend/.env.production.local"
sudo -u "$RUN_USER" bash -c "cd '$APP/frontend' && npm ci --no-audit --no-fund --loglevel=error && NODE_OPTIONS=--max-old-space-size=1536 npm run build"
rm -rf "$WEB_ROOT.new" && cp -r "$APP/frontend/dist" "$WEB_ROOT.new"
rm -rf "$WEB_ROOT.old"; [ -d "$WEB_ROOT" ] && mv "$WEB_ROOT" "$WEB_ROOT.old"; mv "$WEB_ROOT.new" "$WEB_ROOT"
rm -rf "$WEB_ROOT.old"

# 6. Dominio según la IP pública actual (se recalcula en cada arranque)
cat > /usr/local/bin/atemporal-domain <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
T=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
IP=$(curl -fsS -H "X-aws-ec2-metadata-token: $T" http://169.254.169.254/latest/meta-data/public-ipv4)
WEB="${IP//./-}.sslip.io"
mkdir -p /etc/atemporal
cat > /etc/atemporal/domain.env <<EOT
WEB_DOMAIN=$WEB
API_DOMAIN=api.$WEB
FRONTEND_URL=https://$WEB
QR_PUBLIC_WEB_URL=https://$WEB
CORS_ORIGINS=https://$WEB
EOT
echo "Web: https://$WEB   API: https://api.$WEB" > /etc/atemporal/url.txt
EOF
chmod 755 /usr/local/bin/atemporal-domain

cat > /etc/systemd/system/atemporal-domain.service <<'EOF'
[Unit]
Description=ATEMPORAL: dominio sslip.io segun la IP publica
Wants=network-online.target
After=network-online.target
Before=caddy.service atemporal-api.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/atemporal-domain

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/atemporal-api.service <<EOF
[Unit]
Description=ATEMPORAL API (NestJS)
Requires=atemporal-domain.service
After=network-online.target atemporal-domain.service

[Service]
User=$RUN_USER
WorkingDirectory=$APP/backend
EnvironmentFile=/etc/atemporal/domain.env
Environment=PORT=3000
ExecStart=/usr/bin/node dist/main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/atemporal.conf <<'EOF'
[Unit]
Requires=atemporal-domain.service
After=atemporal-domain.service

[Service]
EnvironmentFile=/etc/atemporal/domain.env
EOF

cat > /etc/caddy/Caddyfile <<EOF
{\$WEB_DOMAIN} {
	root * $WEB_ROOT
	encode gzip
	header /sw.js Cache-Control no-cache
	header /firebase-messaging-sw.js Cache-Control no-cache
	try_files {path} /index.html
	file_server
}

{\$API_DOMAIN} {
	reverse_proxy 127.0.0.1:3000
}
EOF

# 7. Arrancar todo
log "Iniciando servicios"
systemctl daemon-reload
systemctl enable atemporal-domain atemporal-api caddy >/dev/null 2>&1
systemctl restart atemporal-domain
systemctl restart atemporal-api
systemctl restart caddy

log "LISTO. $(cat /etc/atemporal/url.txt)"
