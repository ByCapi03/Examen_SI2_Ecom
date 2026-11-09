# CAPÍTULO IV. DESARROLLO E IMPLEMENTACIÓN

## 4.1. Herramientas y tecnologías utilizadas

| Capa | Tecnología | Uso |
|---|---|---|
| Backend | NestJS 12, TypeScript | API REST modular, guards, interceptores |
| Persistencia | TypeORM 1.x, PostgreSQL | Entidades, subscribers, transacciones, bloqueo pesimista |
| Frontend web | React 19, Vite, React Router 7, Axios | Landing, tienda por empresa, panel, POS |
| PWA / offline | vite-plugin-pwa, Workbox, IndexedDB | Navegación y cola offline |
| Vestidor virtual | TensorFlow.js + MoveNet (pose-detection) | Detección de pose en el dispositivo |
| Móvil | Expo ~57, React Native, React Navigation, expo-sqlite | App de clientes |
| Imágenes | Cloudinary | Almacenamiento y optimización |
| Pagos | Stripe (Checkout + webhook) y pago QR simulado | Cobro en línea |
| Notificaciones | Firebase Admin, WebSocket (gateway) | Push y tiempo real |
| Correo | Nodemailer (SMTP) | Códigos de verificación y contraseñas temporales |
| IA / ML | LLM compatible OpenAI (opcional), intérprete local, regresión y K-Means propios | Reportes en lenguaje natural, demanda, RFM |
| Modelado | PlantUML + scripts Python | Modelos UML versionados y verificados |
| Pruebas | Jest, scripts E2E en Node, Playwright (verificación de UI) | Capítulo V |

## 4.2. Diseño de la arquitectura del sistema

![Arquitectura del sistema](../uml/out/06_arquitectura.png){width=100%}

**Arquitectura en capas y multitenant.** Cada petición atraviesa:

1. `TenantContextMiddleware`: abre un contexto por petición (AsyncLocalStorage). Si viene `X-Tenant-Slug` resuelve la empresa pública; si viene un JWT válido, el `tenantId` del token manda sobre la cabecera.
2. `AuthGuard` → `TenantGuard` → `RolesGuard` → `PlanFeatureGuard`: autentican, fijan el tenant y validan rol y plan.
3. Servicios de módulo: filtran siempre por `tenantId`. La tienda pública usa `requireTenantId()`, que responde 404 si el código no existe y 400 si no se indicó tienda (se eliminó el antiguo *fallback* a una empresa por defecto).
4. `TenantSubscriber` asigna el `tenantId` en cada inserción y las FKs compuestas de la base de datos impiden referencias cruzadas.

**Enrutamiento del frontend.** `/` es la landing del SaaS; la tienda de cada empresa vive en `/t/:slug/*`
(`StoreProvider` carga la empresa y aísla el carrito en `boutique_cart:<slug>`); un interceptor de Axios añade
`X-Tenant-Slug` cuando la URL es `/t/<slug>`; el panel está en `/dashboard/*` y la cuenta del cliente en `/account/*`.

**App móvil.** Sin sesión solo hay Login, Registro (con código de tienda) y Activar cuenta; con sesión se monta el catálogo de la empresa del usuario.

## 4.3. Implementación de la base de datos

El esquema se define en 34 entidades TypeORM (diccionario de datos en el Anexo B). Decisiones clave:

- **Claves foráneas compuestas** `(id, tenantId)` declaradas en las entidades para blindar el aislamiento incluso con `synchronize`.
- `cash_registers` (única por `tenantId+branchId+name`) y `cash_sessions` con índices únicos parciales: un cajero con una sola sesión abierta y una caja con una sola sesión abierta.
- `offline_sync_operations` con unicidad `(tenantId, operationId)` para la idempotencia.
- `audit_logs` con usuario, roles, método, ruta, estado HTTP, IP y detalle.
- `tenants.storeConfig` (jsonb) con la configuración de la tienda web, normalizada en servidor.
- Migración idempotente `npm run migrate:multitenant` para datos históricos (RNF-06) y **datos demo** `npm run seed:demo` (2 empresas, contraseña `123456`).

## 4.4. Desarrollo de los módulos del sistema

| Módulo | Backend | Frontend / móvil | Estado |
|---|---|---|---|
| Plataforma SaaS | `tenants` | `LandingPage`, `PricingPage`, `TenantRegisterPage` | Implementado |
| Autenticación y personal | `auth` (`AuthService`, `AccessService`) | `LoginPage`, `RegisterPage`, `ActivateAccountPage`, `UsersPage`; móvil `Login/Register/Activate` | Implementado |
| Sucursales | `branches` | `BranchesPage` | Implementado |
| Catálogo | `catalog` + `CloudinaryService` | `ProductsAdminPage` | Implementado |
| Inventario y proveedores | `inventory` | `InventoryAdminPage`, `SuppliersPage` | Implementado |
| Cajas y sesiones | `cash-registers`, `cash-sessions` | `CashSessionsAdminPage` (crear caja, abrir/cerrar) | Implementado |
| POS | `pos`, `sales` | `PosTerminalPage`, `PosDashboardPage` | Implementado |
| Reservas y pagos | `reservations`, `payment-gateway`, `payments` | `CreateReservationPage`, `ReservationsAdminPage`, `QrPaymentPage` | Implementado |
| Tienda pública | `store` | `StoreLayout`, `HomePage`, `CatalogPage`, `ProductDetailPage`, `CartPage`, `CheckoutPage` | Implementado |
| Mi tienda web | `tenants` (`updateStoreConfig`) | `StoreBuilderPage`, `StoreLinkCard` | Implementado |
| Vestidor virtual | `store` (`getTryOnData`) | `TryOnPage` (recorte y ajuste de la prenda) | Implementado |
| Sincronización offline | `sync` | `offline/db.ts`, `syncManager.ts`, `SyncConflictsPage` | Implementado |
| Reportes y dashboard | `reports`, `dashboard` | `ReportsPage` (dictado por voz), `DashboardPage` | Implementado |
| IA y ML | `ai-reports`, `analytics`, `intelligence` | `AiReportsPage`, `AnalyticsPage` | Implementado |
| Bitácora | `audit` (`AuditInterceptor`) | `AuditPage` | Implementado |
| Configuración | — | `SettingsPage` (tema, idioma, moneda) | Implementado |
| Notificaciones | `notifications`, `StockAlertSubscriber`, gateway WebSocket, Firebase/Expo | Campana, push web, push móvil | Implementado (el push requiere credenciales de Firebase y un proyecto EAS reales) |

## 4.5. Integración de componentes

- **Web ↔ API:** Axios con interceptores (JWT y `X-Tenant-Slug`); el carrito y la sesión de pago regresan a `/t/<slug>`.
- **Stripe:** `PaymentGatewayService` arma la sesión con el nombre de la empresa y las URL de retorno de su tienda; el webhook confirma el pago.
- **Cloudinary:** las imágenes de producto y de las partes del vestidor se suben mediante el backend.
- **Offline:** la cola local (IndexedDB en web, SQLite en móvil) se envía por lote a `POST /sync/batch`.
- **Móvil ↔ API:** mismo contrato REST; el JWT lleva el `tenantId`, por lo que el catálogo móvil no necesita enviar el código de tienda tras iniciar sesión.
- **Despliegue de referencia:** frontend como sitio estático (PWA), API NestJS en un servicio de aplicaciones, PostgreSQL administrado, y servicios externos (Cloudinary, SMTP, Stripe, Firebase).
