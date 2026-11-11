# Despliegue en la nube (gratis) — DRESSED

Resultado: una web pública con **HTTPS** (la PWA funciona offline en el iPhone **sin túneles**), una API y una base de datos en la nube.

| Pieza | Servicio | Costo |
|---|---|---|
| Base de datos PostgreSQL | **Neon** | gratis |
| API (NestJS) | **Render** · Web Service | gratis |
| Web (React / PWA) | **Render** · Static Site | gratis |
| Imágenes | Cloudinary (ya lo usas) | gratis |

> El plan gratis de Render **duerme la API tras 15 min sin uso**: la primera petición tarda 30–60 s en despertarla. Para una demostración, ábrela 2 minutos antes (o ver «Evitar que se duerma»).

Todo se prepara una sola vez. El archivo `render.yaml` (en la raíz del repositorio) ya describe la API y la web.

---

## Paso 0. Qué necesitas

- Cuenta de **GitHub** con este repositorio (ya lo tienes).
- Cuentas gratis en **Neon** (https://neon.tech) y **Render** (https://render.com). Puedes entrar con GitHub.
- Tus claves de **Cloudinary** (de `backend\.env`).

---

## Paso 1. Crear la base de datos en Neon

1. En Neon: **Create project** → nombre `dressed` → región la más cercana (p. ej. *AWS São Paulo* o *US East*).
2. En el panel del proyecto: **Connect** → copia la cadena **Connection string** (empieza con `postgresql://…` y termina en `?sslmode=require`).
3. Guárdala: es tu `DATABASE_URL`. **No la subas a GitHub ni la pegues en chats.**

---

## Paso 2. Crear la API y la web en Render (Blueprint)

1. En Render: **New +** → **Blueprint** → conecta tu cuenta de GitHub → elige el repositorio `Examen_SI2_Ecom`.
2. Rama: la que uses (`claude/happy-ritchie-bfjbbq`, o `main` si ya la fusionaste).
3. Render lee `render.yaml` y te muestra dos servicios: `dressed-api` y `dressed-web`. Te pide los valores marcados como secretos. Complétalos así (supón que las URLs serán las de abajo; ver la nota):

**dressed-api**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la cadena de Neon (Paso 1) |
| `FRONTEND_URL` | `https://dressed-web.onrender.com` |
| `QR_PUBLIC_WEB_URL` | `https://dressed-web.onrender.com` |
| `CORS_ORIGINS` | `https://dressed-web.onrender.com` |
| `SUPERADMIN_EMAIL` | el correo del dueño de la plataforma |
| `SUPERADMIN_PASSWORD` | una contraseña **fuerte** |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | las de tu Cloudinary |
| `SMTP_USER`, `SMTP_PASSWORD` | opcional (correo de verificación) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | opcional (cobro real de planes) |

`JWT_SECRET` lo **genera Render solo**. Déjalo así.

**dressed-web**

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://dressed-api.onrender.com` |
| `VITE_SUPPORT_EMAIL` | opcional |

4. Pulsa **Apply**. La primera construcción tarda unos 5–10 minutos.

> **Nota sobre las URLs.** Render usa el nombre del servicio: `dressed-api` → `https://dressed-api.onrender.com`. Si ese nombre ya estaba ocupado por otra persona, Render agrega un sufijo y la URL real es otra. Mírala en el panel de cada servicio. Si no coincide con lo que escribiste:
> 1. En `dressed-api` → **Environment** corrige `FRONTEND_URL`, `QR_PUBLIC_WEB_URL` y `CORS_ORIGINS`.
> 2. En `dressed-web` → **Environment** corrige `VITE_API_URL` y luego **Manual Deploy → Clear build cache & deploy** (las variables `VITE_` se escriben al compilar).

---

## Paso 3. Comprobar que está viva

Abre en el navegador (espera a que Render diga **Live**):

- `https://dressed-api.onrender.com/health` → debe mostrar `{"status":"ok", …}`.
- `https://dressed-api.onrender.com/saas/billing/config` → debe mostrar un JSON.
- `https://dressed-web.onrender.com` → debe verse la página de DRESSED.

La primera vez que arranca, la API **crea las tablas sola** en Neon.

---

## Paso 4. Cargar los datos de demostración

Se ejecuta **desde tu PC**, apuntando a la base de Neon. En PowerShell:

```powershell
cd "C:\Users\MSI CYBORG 15 A13V\Desktop\UNI\Examen_SI2_Ecom\backend"
$env:DATABASE_URL="postgresql://…la-cadena-de-Neon…"
$env:DB_SSL="true"
npm run seed:demo
```

> Haz esto **después** de que la API esté *Live* (para que las tablas ya existan). El comando solo crea las empresas demo si no existen. **No uses `seed:demo:reset` en la nube** a menos que quieras borrar y recrear las empresas demo.

Cuando termine, entra a `https://dressed-web.onrender.com/login` con `admin@luna.com` / `123456`.
Tienda pública: `https://dressed-web.onrender.com/t/luna`.

Después de cargar los datos, **cierra esa PowerShell** (o ejecuta `Remove-Item Env:DATABASE_URL`) para no apuntar a la nube por accidente.

---

## Paso 5. Probar desde el iPhone (offline real, sin túneles)

1. Safari → `https://dressed-web.onrender.com` → **Compartir → Añadir a pantalla de inicio**.
2. Abre el ícono, entra como `cajero1@luna.com` / `123456` y espera **«Catálogo local guardado»** en el Terminal POS.
3. Modo avión → cierra y abre la app desde el ícono → cobra en efectivo → quita el modo avión → se sincroniza.

El QR de pago del POS también funciona: usa `QR_PUBLIC_WEB_URL`, que ya apunta a tu web pública.

---

## Paso 6. App móvil (Expo)

En `mobile\.env` pon la API pública:

```
EXPO_PUBLIC_API_URL=https://dressed-api.onrender.com
```

y arranca como siempre (`npx expo start --go --clear`). Con una URL HTTPS pública ya no dependes de tu PC ni de tu red.

---

## Opcionales

**Stripe (cobro real de planes).** En Stripe → Developers → Webhooks → *Add endpoint*:
`https://dressed-api.onrender.com/saas/billing/webhook`, evento `checkout.session.completed`. Copia el secreto (`whsec_…`) a `STRIPE_WEBHOOK_SECRET` en Render.

**Notificaciones push (Firebase).** En Render agrega `FIREBASE_SERVICE_ACCOUNT_JSON` con **todo el contenido** del JSON de la cuenta de servicio (en una sola línea). En `dressed-web` agrega las variables `VITE_FIREBASE_*` (ver `frontend\.env.example`) y vuelve a desplegar la web.

**Evitar que se duerma.** Crea un monitor gratis en https://uptimerobot.com con la URL `https://dressed-api.onrender.com/health` cada 5 minutos. (Mantiene despierta la API; el plan gratis de Render tiene horas mensuales limitadas, úsalo solo para la fecha de la demostración.)

**Dominio propio.** Render → tu servicio → **Settings → Custom Domains**.

---

## Seguridad: lo que ya quedó resuelto y lo que debes cuidar

- `JWT_SECRET` es obligatorio en producción (el servidor no arranca sin él) y Render lo genera aleatorio.
- `CORS_ORIGINS` limita qué sitios web pueden llamar a tu API.
- Las claves van como **variables de entorno** de Render, nunca en el repositorio.
- `DB_SYNCHRONIZE=true` deja que la API cree/ajuste las tablas al arrancar. Es cómodo para el examen; en un sistema real se usan migraciones y se pone `false`.
- Usa una contraseña **fuerte** para `SUPERADMIN_PASSWORD`. Las cuentas demo (`123456`) son solo para la demostración: no las dejes en un sistema con clientes reales.
- Neon gratis se **suspende** tras unos minutos sin uso y despierta solo en menos de un segundo.

## Si algo falla

| Síntoma | Causa y solución |
|---|---|
| La API no arranca: «JWT_SECRET es obligatorio» | Falta `JWT_SECRET`. En el Blueprint se genera solo; si lo quitaste, agrégalo. |
| La API no conecta a la base | `DATABASE_URL` mal copiada o sin `?sslmode=require`. Revisa también que `DB_SSL=true`. |
| La web carga pero el login dice error de red | `VITE_API_URL` incorrecta, o falta redeploy de la web después de cambiarla. |
| El navegador dice «CORS» | `CORS_ORIGINS` debe ser **exactamente** la URL de la web (sin barra final). |
| La primera pantalla tarda mucho | La API estaba dormida (plan gratis). Espera ~1 minuto. |
| El QR del POS abre `localhost` | `QR_PUBLIC_WEB_URL` mal configurada. Debe ser la URL pública de la web. |
| No suben imágenes | Faltan las 3 variables `CLOUDINARY_*` en la API. |
| La web vieja sigue en el teléfono | Cierra y abre la app dos veces; si no, borra los datos del sitio en Ajustes → Safari. |
