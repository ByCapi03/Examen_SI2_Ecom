# CAPÍTULO V. PRUEBAS Y RESULTADOS

## 5.1. Plan de pruebas

**Objetivo.** Garantizar el aislamiento multitenant, la consistencia transaccional del inventario y de las cajas,
la seguridad por rol y por plan, la sincronización offline y el comportamiento de la tienda pública por empresa.

| Nivel | Herramienta | Alcance |
|---|---|---|
| Unitarias | Jest (`npx jest`) | Reglas de sincronización, especificación de reportes IA y SQL, modelos ML |
| Integración / sistema (API + BD reales) | `npm run test:e2e:saas` | Aislamiento, offline, conflictos, IA, ML, planes |
| Integración / sistema (tienda) | `npm run test:e2e:tienda` | Tienda pública, registro por empresa, Mi tienda web |
| Interfaz | Playwright (verificación manual asistida) | Landing, tienda por empresa, panel, vestidor |
| Coherencia documental | `python3 docs/uml/scripts/verificar_coherencia.py` | RNF-12: diagramas vs. código |

**Ambientes.** Desarrollo con PostgreSQL local y datos demo (`luna` y `sol`); pasarela en modo de pruebas.

## 5.2. Pruebas funcionales

Se verificó cada módulo por rol con las cuentas demo (todas con contraseña `123456`): administrador, 2 encargados
(uno por sucursal), 4 cajeros (2 por sucursal) y un cliente por empresa. Flujos recorridos: alta y plan, personal, catálogo,
crear caja → abrir sesión → vender → cerrar, reservas, tienda `/t/luna` y `/t/sol`, registro de cliente, personalización de la tienda, reportes y bitácora.

## 5.3. Pruebas de integración

- **Batería E2E SaaS (`test-saas-e2e.js`): 34 pruebas** (T01–T33) sobre API y PostgreSQL reales — aislamiento entre empresas, POS, sincronización idempotente, conflictos, reportes IA con intento de inyección SQL, analítica ML y restricciones de plan.
- **Batería E2E tienda (`test-tienda-publica.js`): 22 pruebas** (P01–P22) — catálogo por empresa, 404/400 por tienda inexistente o ausente, prioridad del JWT, registro dentro de la empresa, saneamiento y permisos de *Mi tienda web*.

## 5.4. Corrección de errores

Defectos detectados y corregidos durante esta fase:

| # | Defecto | Corrección |
|---|---|---|
| 1 | La tienda pública caía en una empresa por defecto cuando no se indicaba tienda. | `requireTenantId()`: 404/400; se elimina el *fallback*. |
| 2 | El catálogo móvil con sesión devolvía 400 porque las rutas públicas no leían el JWT. | El middleware lee el JWT y su `tenantId` manda sobre la cabecera. |
| 3 | El registro de clientes no se ligaba a una empresa. | `registerClient` exige tienda y asigna `tenantId` a usuario y cliente. |
| 4 | Las URL de retorno de Stripe y el nombre del producto estaban fijos a una marca. | URLs `/t/<slug>` y nombre de la empresa. |
| 5 | Vestidor virtual: prendas chicas y deformadas. | Recorte del espacio transparente, proporción real y escala por cuerpo. |
| 6 | Error al subir imágenes. | Integración y configuración de Cloudinary (variables de entorno). |
| 7 | Cajas: se abría una caja sin haberla creado. | Modelo de cajas: primero se crea, luego se abre una sesión. |
| 8 | Registro fallaba por roles inexistentes en BD vacía. | Siembra de roles al arrancar. |

## 5.5. Resultados de las pruebas

| Prueba | Resultado |
|---|---|
| Jest (unitarias) | **24 / 24 aprobadas** |
| E2E SaaS | **34 / 34 aprobadas** |
| E2E tienda pública | **22 / 22 aprobadas** |
| `tsc` backend, frontend y móvil | Sin errores |
| Coherencia documental | Todos los diagramas coherentes con el código |

*Resultados ejecutados sobre la base de datos de demostración con el código de la rama de entrega. La app móvil se verificó con el compilador de tipos; no se ejecutó en un dispositivo.*

## 5.6. Casos de prueba

| ID | Módulo | Caso de uso | Procedimiento / entrada | Resultado esperado |
|---|---|---|---|---|
| TC-01 | Seguridad | CU-03 | Login de un usuario con contraseña temporal. | JWT con `mustChangePassword=true`; el frontend redirige a `/change-password`. |
| TC-02 | Seguridad | CU-07 | `POST /products` con rol CAJERO. | 403 Forbidden; el catálogo no cambia. |
| TC-03 | Aislamiento | CU-21 | `GET /store/products` con slug `luna` y con `sol`. | Catálogos distintos (P03). |
| TC-04 | Aislamiento | CU-21 | Slug inexistente / sin slug y sin sesión. | 404 / 400 (P04, P05). |
| TC-05 | Aislamiento | CU-21 | Cliente de luna con cabecera `X-Tenant-Slug: sol`. | Ve el catálogo de luna (P08). |
| TC-06 | Registro | CU-22 | Registro con `X-Tenant-Slug: sol`. | Usuario y cliente creados en sol (P09–P10). |
| TC-07 | Cajas | CU-13 | Abrir sesión con una caja ya abierta. | 409 «Esa caja ya está abierta / ya tienes una caja abierta». |
| TC-08 | Cajas | CU-13 | Abrir sesión en sucursal sin cajas. | Error solicitando crear una caja. |
| TC-09 | POS | CU-14 | Venta sin stock suficiente. | Línea rechazada; stock intacto. |
| TC-10 | Offline | CU-16 | Reenviar la misma operación (mismo UUID). | `DUPLICATE`, sin duplicar la venta (T16). |
| TC-11 | Offline | CU-17 | Vender offline más que el stock real. | Venta aplicada con conflicto `STOCK_SHORTFALL` y stock ≥ 0 (T17, T19). |
| TC-12 | Planes | CU-19 | Plan Básico solicita reporte con IA. | 403 (T30). |
| TC-13 | IA | CU-19 | Pregunta con intento de inyección SQL. | La BD no se altera (T29). |
| TC-14 | Tienda web | CU-10 | Guardar color `rojo` y logo `javascript:…`. | Se usan color por defecto y logo vacío (P16, P18). |
| TC-15 | Tienda web | CU-10 | Cliente intenta `PATCH /saas/tenants/me/store`. | 403 (P21). |
| TC-16 | Móvil | CU-22 | Abrir la app sin sesión. | Solo Login, Registro y Activar cuenta. |
| TC-17 | Vestidor | CU-23 | Prenda con márgenes transparentes y rodillas fuera de cámara. | La prenda se ajusta a caderas con proporción real. |
| TC-18 | Auditoría | CU-11 | Crear un usuario desde el panel. | Registro en bitácora con usuario, IP y ruta. |

*Los casos TC-01 a TC-15 están respaldados por pruebas automáticas o por la verificación de reglas del servidor citadas entre paréntesis. TC-16 (móvil) y TC-17 (vestidor) se verificaron solo por compilación y revisión de código; requieren validación en dispositivo y con cámara. TC-18 se verificó manualmente con la bitácora de datos demo.*
