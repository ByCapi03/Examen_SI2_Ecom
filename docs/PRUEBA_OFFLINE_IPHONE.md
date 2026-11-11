# Cómo probar el modo offline desde un iPhone

Hay dos cosas que probar: la **web instalada (PWA)** en Safari, y la **app móvil** (Expo).
La web offline es la que cubre el POS del cajero; la app móvil cubre las reservas del cliente.

> Para el punto 4 y 5 del parcial (offline con IndexedDB, ventas en efectivo y reservas con UUID) lo más
> importante es la **PWA**. Empieza por ella.

---

## A. Web (PWA) en el iPhone: POS y reservas offline

### Por qué necesitas HTTPS
iOS solo activa el Service Worker (lo que permite abrir la web sin red) en sitios **HTTPS**. Con `http://192.168...` la
página abre, pero **no funcionará offline**. Tienes dos caminos:

**Camino 1 (recomendado, sin pagar nada): túneles HTTPS temporales con cloudflared**

Necesitas el comando `cloudflared` instalado en tu PC (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

1. Arranca el backend (con los datos demo):
   ```bash
   cd backend
   npm run seed:demo
   npm run build && npm run start:prod
   ```
2. En otra terminal, expón el backend:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   Copia la URL `https://xxxx.trycloudflare.com` que muestra (**URL del API**).
3. Compila el frontend apuntando a esa URL y sírvelo (el offline solo existe en la versión compilada, no en `npm run dev`):
   ```bash
   cd frontend
   VITE_API_URL=https://xxxx.trycloudflare.com npm run build
   npm run preview -- --host --port 4173
   ```
4. En una tercera terminal, expón el frontend:
   ```bash
   cloudflared tunnel --url http://localhost:4173
   ```
   Copia la otra URL `https://yyyy.trycloudflare.com` (**URL de la web**).

**Camino 2:** publicar el backend y el frontend en un hosting con HTTPS (Render, Railway, Netlify, Vercel…) y usar sus URLs.

### Pasos en el iPhone (cajero)
1. Abre **Safari** (no Chrome) con la **URL de la web**.
2. Toca **Compartir → «Añadir a pantalla de inicio»**. *Importante:* en iOS la app instalada tiene su propio
   almacenamiento, separado de Safari. **Instálala primero y haz todo desde el ícono.**
3. Abre el ícono, inicia sesión con **`cajero1@luna.com` / `123456`**.
4. Si el cajero no tiene caja abierta: ábrela (la caja la crea antes el administrador o encargado, p. ej. «Caja 1»).
5. Entra al **Terminal POS** y espera a ver el mensaje **«Catálogo local guardado»**. Eso significa que ya tienes los productos en el teléfono.
6. Activa el **modo avión** (también apaga el Wi-Fi). Cierra la app por completo (desliza hacia arriba) y **ábrela de nuevo desde el ícono**: debe cargar sin red.
7. Agrega una prenda y cobra en **EFECTIVO**. Verás la barra inferior **«Sin conexión · 1 pendiente»** y el comprobante local.
   (Con tarjeta o QR te dirá que solo se acepta efectivo sin conexión: es la regla RN-09.)
8. Desactiva el modo avión. En unos segundos la barra pasa a **«Sincronizando…»** y luego **«Sincronizada»**.
   Confirma en el panel (**Ventas**) que la venta aparece una sola vez.

### Prueba del cobro por QR (con conexión)
1. Con internet, en el Terminal POS agrega una prenda y elige **Método de pago: QR** → **COBRAR**.
2. Aparece el código QR con el monto y una cuenta regresiva de 5 minutos.
3. Con **otro teléfono** (o la cámara del mismo), escanea el QR: se abre la página de confirmación con el monto. Pulsa **CONFIRMAR PAGO**.
4. En el POS aparece **«¡Pago por QR recibido!»** y el stock se descuenta. Si nadie paga, el QR vence y el stock se libera.

> El QR lleva al cliente a la web de DRESSED. Para que funcione desde otro teléfono, arranca el backend con la URL pública del **frontend**:
> `$env:QR_PUBLIC_WEB_URL="https://TU-TUNEL-DEL-FRONTEND.trycloudflare.com"` antes de `npm run start:prod`.
> El pago es una **simulación** (banco de demostración); conectarlo a un banco real requiere un proveedor de QR bancario.

### Sin conexión, ¿QR y tarjeta?
No se pueden cobrar offline: el cliente tiene que pagar y el servidor confirmar. Sin red el POS solo acepta **efectivo**.

### Prueba de conflicto de stock
1. Con el iPhone **offline**, vende 2 unidades de un producto que tenga poco stock (p. ej. 3 disponibles).
2. Desde tu PC (administrador o encargado) registra un **ajuste de inventario** que deje ese producto con 0.
3. Vuelve a conectar el iPhone. La venta se **aplica igual** (no se pierde el dinero) y aparece un conflicto
   **STOCK_SHORTFALL** en **Conflictos offline**, para que el encargado lo resuelva.

### Reserva offline del cliente (web)
1. En el iPhone abre `https://yyyy.trycloudflare.com/t/luna`, inicia sesión como **`cliente@luna.com` / `123456`**
   y navega el catálogo una vez con red.
2. Activa el modo avión, abre el catálogo y crea una **reserva** en una sucursal: queda guardada en el teléfono.
3. Quita el modo avión: se envía sola. Revisa **Mi cuenta → Reservas**.

### Cosas de iOS que conviene saber
- iOS **no** sincroniza en segundo plano: la sincronización ocurre **cuando abres la app** o cuando vuelve la red
  mientras está abierta. Si no ves que sincroniza, ábrela de nuevo.
- No uses **navegación privada**: borra el almacenamiento local.
- Si Safari no se usa por ~7 días, iOS puede limpiar los datos del sitio; la app instalada en pantalla de inicio sufre menos esto.
- Los túneles `trycloudflare.com` cambian cada vez que los reinicias: si los cambias, **vuelve a compilar** el frontend con la URL nueva y reinstala la app.

---

## B. App móvil (Expo): reservas del cliente offline

1. Instala **Expo Go** desde el App Store en el iPhone.
2. El iPhone y la PC deben estar en la **misma red Wi-Fi** (o usa el punto de acceso del iPhone).
3. En la PC averigua tu IP local (por ejemplo `192.168.1.20`) y arranca la app:
   ```bash
   cd mobile
   npm install
   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start
   ```
   (En Windows PowerShell: `$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:3000"; npx expo start`.) El backend debe estar corriendo y el firewall de la PC permitir el puerto 3000.
4. Escanea el QR con la cámara del iPhone → se abre en Expo Go.
5. Inicia sesión con **`cliente@luna.com` / `123456`** (la app exige iniciar sesión; verás solo el catálogo de Moda Luna).
   Navega el catálogo una vez con red.
6. Activa el **modo avión** **sin cerrar ni recargar** la app (Expo Go necesita a tu PC para cargar el código; una vez cargada, sigue funcionando).
7. Crea una **reserva**: queda en la cola local (SQLite) y aparece el aviso de operaciones pendientes.
8. Desactiva el modo avión: se sincroniza sola al volver a primer plano o a los 30 s.

**Límites de esta prueba:** con Expo Go no puedes cerrar la app estando offline y volver a abrirla (no hay servidor de código).
Para eso necesitas una **compilación propia** (`eas build --profile preview --platform ios`), que requiere una cuenta de desarrollador de Apple.
Esa compilación debe usar un API con **HTTPS** (iOS bloquea `http://` en apps compiladas). Las notificaciones push tampoco funcionan en Expo Go.

---

## C. Si algo no funciona

| Síntoma | Causa probable |
|---|---|
| La web no abre sin red | Está en `http` (no HTTPS) o usaste `npm run dev`; usa la versión compilada con túnel HTTPS |
| «Catálogo local guardado» no aparece | Abre el POS con red y espera unos segundos antes de activar el modo avión |
| No puede cobrar | El cajero no tiene una caja abierta; ábrela antes de quedarte sin red |
| El login falla desde el iPhone | La URL del API compilada en el frontend no es la del túnel actual; recompila |
| Sincroniza solo al abrir | Comportamiento normal de iOS (sin sincronización en segundo plano) |
