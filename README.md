# DRESSED — SaaS multitenant para tiendas de ropa

Backend NestJS + PostgreSQL · Frontend React (PWA) · App móvil Expo.
Este archivo reúne **todos los comandos** para correr, probar y mostrar el sistema.
Los comandos son para **PowerShell en Windows**. Cambia la ruta si tu proyecto está en otra carpeta.

```powershell
# Ruta del proyecto (ajústala)
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom"
```

---

## 1. Cuentas de demostración (contraseña de TODAS: `123456`)

| Empresa | Rol | Correo |
|---|---|---|
| Moda Luna | Administrador | `admin@luna.com` |
| Moda Luna | Encargado (Luna Centro / Luna Norte) | `encargado1@luna.com` / `encargado2@luna.com` |
| Moda Luna | Cajero | `cajero1@luna.com` … `cajero4@luna.com` |
| Moda Luna | Cliente | `cliente@luna.com` |
| Boutique Sol | Administrador | `admin@sol.com` |
| Boutique Sol | Encargado / Cajero / Cliente | `encargado1@sol.com`, `cajero1@sol.com`, `cliente@sol.com` |
| Plataforma | SuperAdmin | el que definas en `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` (ver sección 2) |

Tienda pública de cada empresa: `/t/luna` y `/t/sol`.

---

## 2. Primera vez (instalación)

Requisitos: **Node 22 o 24**, **PostgreSQL** encendido y una base de datos creada.

```powershell
# Backend
cd backend
npm install
copy .env.example .env        # y completa tus datos (ver tabla de variables más abajo)
npm run build
npm run seed:demo             # crea las empresas demo (si ya existen, no hace nada)
# npm run seed:demo:reset     # BORRA y recrea SOLO las empresas demo (luna y sol); conserva las fotos, el vestidor virtual y Mi tienda web
# npm run seed:demo:images    # recupera fotos perdidas: con --list muestra tus imágenes de Cloudinary; ver backend\demo-images.example.json

# Frontend
cd ..\frontend
npm install

# App móvil
cd ..\mobile
npm install
```

### Variables del backend (`backend\.env`)

| Variable | Para qué |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de sesiones (obligatoria y secreta) |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Crea el usuario SuperAdmin al arrancar (opcional) |
| `QR_PUBLIC_WEB_URL` | URL pública del **frontend**, a la que lleva el QR de pago del POS |
| `FRONTEND_URL` | URL del frontend (retorno de Stripe) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Cobro real de planes (sin ellas funciona en modo demostración) |
| `CLOUDINARY_*` | Imágenes de productos |
| `GOOGLE_APPLICATION_CREDENTIALS` | Notificaciones push (Firebase) |

El archivo `backend\.env.example` explica cada una.

---

## 3. Uso diario en tu PC (sin túneles)

Abre 2 ventanas de PowerShell.

**Ventana 1: backend**
```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\backend"
npm run start:dev
```

**Ventana 2: frontend**
```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\frontend"
npm run dev
```
Abre `http://localhost:5173`. (En este modo el offline **no** funciona; para eso usa la sección 4.)

Si el puerto 3000 está ocupado (`EADDRINUSE`):
```powershell
netstat -ano | findstr :3000
taskkill /PID <número-de-la-última-columna> /F
```

---

## 4. Probar desde el iPhone (offline, QR, PWA) con túneles HTTPS

iOS solo permite abrir la web sin conexión si está en **HTTPS**. Se usan dos túneles de Cloudflare (gratis, sin cuenta).
Son **4 ventanas** abiertas a la vez; el orden importa porque cada URL se usa en la siguiente.

### Una sola vez: instalar cloudflared
```powershell
mkdir C:\cloudflared
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "C:\cloudflared\cloudflared.exe"
C:\cloudflared\cloudflared.exe --version
```

### Antes de empezar, cada vez
- PostgreSQL encendido.
- Cierra backend, túneles y `preview` viejos (`Ctrl + C`).
- Libera el puerto 3000 si hace falta (comando de la sección 3).
- Trae lo último y compila el backend:
  ```powershell
  cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom"
  git pull origin claude/happy-ritchie-bfjbbq
  cd backend
  npm install
  npm run build
  ```

### Ventana 1: túnel del backend
```powershell
C:\cloudflared\cloudflared.exe tunnel --url http://localhost:3000
```
Copia la URL `https://….trycloudflare.com` → es la **URL DEL API**.

### Ventana 2: frontend compilado (pon la URL DEL API)
```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\frontend"
npm install
$env:VITE_API_URL="https://URL-DEL-API.trycloudflare.com"
npm run build
npm run preview -- --host --port 4173
```

### Ventana 3: túnel del frontend
```powershell
C:\cloudflared\cloudflared.exe tunnel --url http://localhost:4173
```
Copia la URL → es la **URL DE LA WEB** (la que abres en el iPhone).

### Ventana 4: backend (pon la URL DE LA WEB)
```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\backend"
$env:QR_PUBLIC_WEB_URL="https://URL-DE-LA-WEB.trycloudflare.com"
npm run start:prod
```
Debe decir `Nest application successfully started` y no mostrar `EADDRINUSE`.

### Comprobar
- `https://URL-DEL-API.trycloudflare.com/saas/billing/config` → debe mostrar un JSON (`{"stripeEnabled":false,…}`).
- `https://URL-DE-LA-WEB.trycloudflare.com` → debe verse la página de DRESSED.

### Si reinicias un túnel (las URLs cambian cada vez)
- Túnel del **API** → repite las ventanas 2, 3 y 4.
- Túnel de la **web** → repite solo la ventana 4 y abre la URL nueva en el iPhone.

### En el iPhone
1. Safari → abre la **URL DE LA WEB** → Compartir → **Añadir a pantalla de inicio**.
   (Si ya tenías una instalada con otra URL, elimínala primero.)
2. Abre el ícono e inicia sesión como `cajero1@luna.com` / `123456`.
3. **Terminal POS** → espera **«Catálogo local guardado»**.
4. **Offline:** modo avión → cierra la app y ábrela desde el ícono → agrega una prenda → cobra en **EFECTIVO** → quita el modo avión → se sincroniza sola.
5. **QR (con Internet):** elige **QR** → **COBRAR** → escanea con otro teléfono → **CONFIRMAR PAGO** → el POS muestra «¡Pago por QR recibido!».

> Sin conexión solo se acepta efectivo: el QR y la tarjeta necesitan Internet.
> Guía detallada y pruebas de conflicto de stock: [`docs/PRUEBA_OFFLINE_IPHONE.md`](docs/PRUEBA_OFFLINE_IPHONE.md).

### Si la app muestra una versión vieja
Cierra la app y ábrela dos veces. Si no cambia: Ajustes → Safari → Avanzado → **Datos de sitios web** → borra `trycloudflare`, elimina el ícono y vuelve a añadirlo.

---

## 5. App móvil (Expo Go)

```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\mobile"
$env:EXPO_PUBLIC_API_URL="https://URL-DEL-API.trycloudflare.com"
npx expo start
# si no conecta por la red local:  npx expo start --tunnel
```
**Vestidor virtual con cámara en el iPhone (modo experimental):** por defecto está desactivado porque TensorFlow consume mucha memoria. Para activarlo:
```powershell
$env:TRYON="1"
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx expo start --go --clear
```
Entra a un producto → **Probar en vestidor** y permite la cámara. Si falla en Expo Go, el vestidor completo funciona en la web del cliente (`/t/luna`).

**En el navegador (Edge/Chrome), para pruebas rápidas:**
```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\mobile"
$env:EXPO_PUBLIC_API_URL="http://localhost:3000"
npx expo start --web --clear
```
Abre `http://localhost:8081`. En el navegador la sesión usa `localStorage` y no hay pago con tarjeta (Stripe) ni vestidor; el resto funciona.

Escanea el QR con la cámara del iPhone (Expo Go instalado). Cuenta: `cliente@luna.com` / `123456`.
La app exige iniciar sesión y muestra solo el catálogo de la empresa del cliente.

---

## 6. Pruebas automáticas

Con el backend corriendo (y los datos demo cargados):

```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\backend"
$env:API_URL="http://localhost:3000"
npx jest                                  # 30 pruebas unitarias
npm run test:e2e:saas                     # 36 · aislamiento multitenant, offline, IA, ML
npm run test:e2e:tienda                   # 22 · tienda pública, registro, Mi tienda web
npm run test:e2e:notif                    # 16 · alertas de stock
npm run test:e2e:posqr                    # 18 · cobro por QR en el POS
# Verifica que el pronóstico de demanda (ML) es correcto: lo recalcula desde PostgreSQL (necesita DB_* en el entorno)
npm run verify:forecast                   # 74 comprobaciones independientes
# Planes y SuperAdmin: el backend debe haberse iniciado con SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD
$env:SUPERADMIN_EMAIL="superadmin@dressed.com"; $env:SUPERADMIN_PASSWORD="TuClave123"
npm run test:e2e:planes                   # 33 · ciclos, límites, vigencia, suspensión
```
Las pruebas de Stripe usan un Stripe simulado: ver `docs/informe/07_anexos.md` (Anexo D).

---

## 7. Documentación (UML e informe)

```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom"
python docs\uml\scripts\gen_entities_uml.py        # diagramas de clases y BD desde las entidades
python docs\uml\scripts\verificar_coherencia.py    # verifica que los diagramas coinciden con el código
bash docs/uml/scripts/build_uml.sh                 # renderiza los .puml (requiere PlantUML)
bash docs/informe/build_informe.sh                 # informe Word/PDF (requiere pandoc y LibreOffice)
```
Más detalles en [`docs/README.md`](docs/README.md).

---

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Los productos demo perdieron sus fotos | Pasaba al correr `seed:demo:reset` en versiones anteriores. Ahora las conserva. Para recuperarlas: `npm run seed:demo:images -- --list` crea `backend\cloudinary-gallery.html` (galería de tus fotos) y `backend\demo-images.json` con tus productos; pega ahí la URL y el `public_id` de cada foto y ejecuta `npm run seed:demo:images`. O súbelas otra vez en Productos. |
| `EADDRINUSE :3000` | Ya hay un backend corriendo. Usa `netstat` + `taskkill` (sección 3). |
| `winget` no se reconoce | No lo necesitas: descarga `cloudflared.exe` como en la sección 4. |
| El POS dice «necesita Internet» con señal | El backend o el túnel están caídos (el catálogo guardado engaña). Abre `…/saas/billing/config` desde el teléfono. |
| Safari «no puede conectarse» | Falta el túnel de la web (puerto 4173) o usaste la IP local en vez de la URL HTTPS. |
| La app muestra la versión vieja | Ver «Si la app muestra una versión vieja» (sección 4). |
| El QR no abre desde otro teléfono | Falta `QR_PUBLIC_WEB_URL` con la URL de la web, o cambió el túnel. |
| Login: «empresa suspendida» | El SuperAdmin la suspendió: reactívala en **Plataforma**. |
| `Error: SASL … password must be a string` | Falta `DB_PASSWORD` en `backend\.env`. |

---

## 9. Despliegue en la nube

Guía completa, gratis y paso a paso (Neon + Render, con HTTPS y PWA offline sin túneles): [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md). El archivo `render.yaml` describe la API y la web.

---

## 10. Mapa del repositorio

```
backend/   API NestJS, entidades, scripts de pruebas (backend/scripts)
frontend/  React + Vite (PWA, panel, tienda por empresa /t/<código>)
mobile/    App Expo para clientes
docs/      UML (docs/uml), informe por capítulos (docs/informe), guías
```
