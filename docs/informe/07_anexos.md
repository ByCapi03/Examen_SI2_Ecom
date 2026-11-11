# ANEXOS

## Anexo A. Matriz de trazabilidad (requisito → caso de uso → implementación → prueba)

| Requisito | Caso de uso | Implementación principal | Pruebas |
|---|---|---|---|
| RF-01, RF-02 | CU-01, CU-02 | `tenants.service.ts` (`createTenant`, `verifyEmail`, `changePlan`) | T-SaaS, T10, T30, T33 |
| RF-29 | CU-14 | `pos.service.ts` (`createPosSale` con QR, `settleQrPayment`, `getQrSaleStatus`), `payments.controller.ts`, `PosTerminalPage.tsx` | Q01–Q18 |
| RF-28 | CU-29 | `billing.service.ts` (`startCheckout`, `confirm`, `handleWebhook`), `SubscriptionPage.tsx` | B01–B16 |
| RF-26, RF-27 | CU-28, CU-29 | `tenants.service.ts` (`adminOverview`, `adminTenants`, `adminSetActive`, `adminChangePlan`, `adminExtend`), `plan-features.ts` (`assertPlanLimit`), `PlatformPage.tsx`, `SubscriptionPage.tsx` | S01–S31 (+S24b) |
| RF-03 | CU-03 | `auth.service.ts` (`login`, `activateAccount`, `changePassword`) | TC-01, P06 |
| RF-04 | CU-05 | `branches.service.ts` (límite `maxBranches`) | T10 |
| RF-05 | CU-06 | `access.service.ts`, `UsersPage.tsx` | TC-18 |
| RF-06, RF-07 | CU-07 | `catalog.service.ts`, `cloudinary.service.ts` | TC-02 |
| RF-08 | CU-08 | `inventory.service.ts` | T-SaaS (stock) |
| RF-09 | CU-09, CU-13 | `cash-registers.service.ts`, `cash-sessions.service.ts` | TC-07, TC-08 |
| RF-10 | CU-14 | `pos.service.ts`, `PosTerminalPage.tsx` | T14, TC-09 |
| RF-11, RF-12 | CU-16, CU-17 | `sync.service.ts`, `sync.rules.ts`, `offline/*` | T14–T26, Jest `sync.rules.spec` |
| RF-13 | CU-21 | `store.service.ts` (`requireTenantId`), `StoreContext.tsx` | P01–P08 |
| RF-14 | CU-22 | `auth.service.ts` (`registerClient`), `RegisterPage.tsx`, `RegisterScreen.tsx`, `AppNavigator.tsx` | P09–P12, TC-16 |
| RF-15 | CU-15, CU-24 | `reservations.service.ts`, `payment-gateway.service.ts` | T21, T22 |
| RF-16 | CU-25, CU-26 | `sales.service.ts` (`checkoutWeb`) | — |
| RF-17 | CU-23 | `TryOnPage.tsx`, `utils/garmentFit.ts` | TC-17 |
| RF-18 | CU-10 | `tenants.service.ts` (`updateStoreConfig`), `StoreBuilderPage.tsx` | P13–P22 |
| RF-19 | CU-18 | `dashboard.service.ts`, `reports.service.ts` | — |
| RF-20 | CU-19 | `ai-reports.service.ts`, `report-spec.ts` | T27–T30, Jest |
| RF-21 | CU-20 | `analytics.service.ts`, `ml.ts` | T31–T33, Jest `ml.spec` |
| RF-22 | CU-11 | `audit.interceptor.ts`, `audit.service.ts` | TC-18 |
| RNF-01, RNF-02 | CU-03, CU-21 | `common/tenancy/*`, FKs compuestas | T01–T13, P03–P12 |
| RNF-12 | — | `docs/uml/scripts/*` | `verificar_coherencia.py` |

## Anexo B. Diccionario de datos

El diccionario completo se genera automáticamente desde las entidades en `docs/uml/generated/diccionario_datos.md`
(campos, tipos, claves primarias y nulabilidad de las 34 tablas). Se incluye a continuación.

{{DICCIONARIO}}

## Anexo C. Guía de usuario

### Cuentas de demostración (contraseña `123456`)
Se crean con `npm run seed:demo` (dos empresas: `luna` y `sol`). Los correos siguen el patrón `admin@<empresa>.com`,
`encargado1@<empresa>.com`, `cajero1@<empresa>.com`, `cliente@<empresa>.com`.

### Cliente
1. Abra el enlace que le compartió su tienda (`/t/<código>`) o escriba el código en la página principal.
2. Explore el catálogo, elija talla y color y vea la disponibilidad por sucursal.
3. Cree su cuenta en **Registrarse** (queda asociada a esa tienda) e inicie sesión.
4. **Vestidor virtual:** en el detalle de la prenda pulse *Probar*, autorice la cámara y párese de modo que se vea del torso a las rodillas.
5. Reserve eligiendo sucursal, fecha y hora, y pague en línea o en la sucursal. Consulte **Mi cuenta** para reservas y compras.
6. **App móvil:** inicie sesión con su correo (la primera vez, regístrese con el código de tienda); verá solo el catálogo de su empresa.

### Cajero
1. Inicie sesión; su inicio es el **Terminal POS**.
2. Abra su caja (la sucursal debe tener cajas creadas) indicando el monto inicial.
3. Agregue prendas, elija el método de pago y cobre. Sin conexión solo se acepta efectivo; las ventas se sincronizan al volver la red.
4. Entregue reservas desde **Reservas** y cierre su caja al terminar el turno.

### Encargado de sucursal
Mismo panel que el administrador pero limitado a su sucursal: crear cajas, inventario, ventas, reservas, resolver conflictos de sincronización y reportes de su sucursal.

### Administrador
1. **Sucursales** y **Usuarios**: cree sucursales (según el plan) y asigne encargados y cajeros.
2. **Productos** e **Inventario**: cargue productos, variantes e imágenes y registre el stock por sucursal.
3. **Mi tienda web**: personalice portada, logo, color y contacto; copie o comparta el enlace; revise la vista previa.
4. **Reportes**, **Reportes con IA** y **Analítica ML** (según el plan); **Bitácora** para auditar acciones.
5. **Configuración**: tema, idioma, moneda y barra lateral compacta.

## Anexo D. Cómo reproducir

```bash
# Modelado UML (genera clases/BD desde el código, verifica coherencia y renderiza)
bash docs/uml/scripts/build_uml.sh              # requiere PlantUML para renderizar (PLANTUML_JAR=...)

# Informe completo en Word y PDF
bash docs/informe/build_informe.sh

# Backend y pruebas
cd backend && npm install && npm run seed:demo && npm run build && npm run start:prod
npx jest                       # 24 pruebas unitarias
npm run test:e2e:saas          # 34 pruebas E2E
npm run test:e2e:tienda        # 22 pruebas E2E
npm run test:e2e:notif         # 16 pruebas E2E
# Stripe: node scripts/mock-stripe.js y backend con STRIPE_SECRET_KEY=sk_test_mockserver STRIPE_API_HOST=localhost STRIPE_API_PORT=12111 STRIPE_API_PROTOCOL=http STRIPE_WEBHOOK_SECRET=whsec_testsecret
npm run test:e2e:stripe        # 16 pruebas E2E
npm run test:e2e:posqr         # 18 pruebas E2E
SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... npm run test:e2e:planes   # 32 pruebas E2E (el backend debe tener las mismas variables)
```
