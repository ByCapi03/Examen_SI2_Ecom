# Despliegue en AWS por la consola — DRESSED

| Pieza | Servicio | Nota |
|---|---|---|
| Web (React / PWA) | **AWS Amplify Hosting** | HTTPS incluido; compila desde GitHub |
| API (NestJS) | **AWS App Runner** | Despliega desde GitHub; HTTPS incluido |
| Base de datos | **Neon** (ya la tienes) | Ver `docs/DESPLIEGUE.md`, Paso 1 |

Todo se hace en la consola web de AWS (https://console.aws.amazon.com). **No necesitas instalar nada.** Las claves y contraseñas las escribes tú en los formularios de AWS.

> **Costos.** AWS pide tarjeta. App Runner **cobra** mientras la instancia está activa (poco, pero no es gratis permanente) y Amplify tiene una capa gratuita limitada. Revisa los precios vigentes en AWS y pon una **alerta de presupuesto** (Billing → Budgets) antes de empezar. Si algo no se va a usar, pausa o elimina el servicio.

Elige **una región** y úsala en todo (por ejemplo *US East (N. Virginia)* `us-east-1` o *South America (São Paulo)* `sa-east-1`).

---

## Orden recomendado

La API necesita la URL de la web (CORS y QR) y la web necesita la URL de la API. Por eso: primero la API, luego la web, y por último se vuelve a la API a poner la URL de la web.

## Paso 1. Base de datos (Neon)

Usa tu proyecto de Neon. Copia la cadena de conexión **directa** (sin `-pooler`) → será `DATABASE_URL`. No la pegues en chats.

## Paso 2. API en App Runner

1. Consola de AWS → busca **App Runner** → **Create service**.
2. **Source:** *Source code repository* → conecta tu cuenta de GitHub (te pide instalar la app *AWS Connector for GitHub*) → elige el repositorio `Examen_SI2_Ecom` y la rama.
3. **Source directory:** `backend`.
4. **Deployment trigger:** *Automatic* (se redespliega con cada push) o *Manual*.
5. **Configure build:** elige **Use a configuration file** (usa `backend/apprunner.yaml`).
   *Si la consola no ofrece Node.js 22:* elige **Configure all settings here**, runtime **Node.js 22** (o 20), build command `npm ci --include=dev && npm run build`, start command `node dist/main`, puerto `3000`.
6. **Service settings → Environment variables.** Agrega:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | una frase larga y aleatoria (mínimo 32 caracteres) |
| `DATABASE_URL` | la cadena de Neon |
| `DB_SSL` | `true` |
| `DB_SYNCHRONIZE` | `true` |
| `FRONTEND_URL`, `QR_PUBLIC_WEB_URL`, `CORS_ORIGINS` | por ahora `https://ejemplo.com`; se corrigen en el Paso 4 |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | el dueño de la plataforma; contraseña **fuerte** |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | las de Cloudinary |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASSWORD` | opcionales |

   *Para guardar `DATABASE_URL`, `JWT_SECRET` y claves de forma más segura, puedes crear los valores en **AWS Secrets Manager** y referenciarlos desde App Runner; para el examen, las variables normales son suficientes.*
7. **Health check:** protocolo **HTTP**, ruta **`/health`**.
8. **Create & deploy.** Tarda unos 5–10 minutos. Al terminar verás el **Default domain**: `https://xxxxxxxx.REGION.awsapprunner.com`. Ábrelo + `/health`: debe responder `{"status":"ok",…}`.

## Paso 3. Web en Amplify

1. Consola de AWS → **AWS Amplify** → **Create new app** → **GitHub** → autoriza → elige el repositorio y la rama.
2. Amplify detecta el monorepo gracias a `amplify.yml` (app root `frontend`). Si te pregunta, marca *My app is a monorepo* y escribe `frontend`.
3. **Environment variables:**
   - `VITE_API_URL` = la URL de App Runner del Paso 2 (con `https://`, **sin** barra final).
   - `VITE_SUPPORT_EMAIL` (opcional).
4. **Save and deploy.** Al terminar tendrás `https://main.xxxxxxxx.amplifyapp.com`.
5. **Reglas para la PWA** (Amplify → *Hosting → Rewrites and redirects* → *Manage redirects*) agrega, para que `/t/luna`, `/dashboard`, etc. los resuelva React:

| Source address | Target address | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp\|webmanifest)$)([^.]+$)/>` | `/index.html` | **200 (Rewrite)** |

6. **Service worker sin caché** (para que el modo offline se actualice): en *Hosting → Custom headers* pega:

```yaml
customHeaders:
  - pattern: '/sw.js'
    headers:
      - key: 'Cache-Control'
        value: 'no-cache'
  - pattern: '/firebase-messaging-sw.js'
    headers:
      - key: 'Cache-Control'
        value: 'no-cache'
```

## Paso 4. Volver a la API a poner la URL de la web

En App Runner → tu servicio → **Configuration → Edit** → variables de entorno:

- `FRONTEND_URL` = `https://main.xxxxxxxx.amplifyapp.com`
- `QR_PUBLIC_WEB_URL` = la misma
- `CORS_ORIGINS` = la misma (sin barra final)

Guarda: App Runner redespliega solo.

## Paso 5. Datos de demostración

Desde tu PC, apuntando a Neon (PowerShell, en `backend`; haz esto con la API ya *Running*, para que las tablas existan):

```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\backend"
$env:DATABASE_URL="postgresql://…tu-cadena-de-Neon…"
npm run seed:demo
```

No uses `seed:demo:reset` en la nube. Luego prueba: `https://TU-WEB/login` con `admin@luna.com` / `123456`, y `https://TU-WEB/t/luna`.

## Paso 6. Móvil

En `mobile\.env`: `EXPO_PUBLIC_API_URL=https://xxxxxxxx.REGION.awsapprunner.com` y `npx expo start --go --clear`.

---

## Si algo falla

| Síntoma | Causa y solución |
|---|---|
| App Runner: la compilación falla | Revisa *Logs → Build logs*. Si no existe Node 22, configura el runtime a mano (Paso 2.5). |
| App Runner: el health check falla | La ruta debe ser `/health`, protocolo HTTP, puerto 3000. Revisa *Application logs* (suele ser `DATABASE_URL` o `JWT_SECRET`). |
| «JWT_SECRET es obligatorio» | Falta la variable `JWT_SECRET`. |
| La web carga pero el login da error de red | `VITE_API_URL` incorrecta; corrígela y haz **Redeploy** en Amplify (se escribe al compilar). |
| Error de CORS | `CORS_ORIGINS` debe ser **exactamente** la URL de la web, sin barra final. |
| Las rutas `/t/luna` dan 404 al recargar | Falta la regla de reescritura del Paso 3.5. |
| El QR del POS abre una URL rara | `QR_PUBLIC_WEB_URL` incorrecta. |
| La primera carga tarda | Neon despierta de su suspensión; unos segundos. |
| La factura sube | Pausa o elimina App Runner y Amplify cuando no los uses. |
