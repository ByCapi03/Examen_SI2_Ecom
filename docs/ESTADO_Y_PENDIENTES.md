# Estado del Segundo Parcial: qué está hecho, qué falta probar y qué sugerir

Evaluado contra los 9 puntos del enunciado del parcial. Fecha de la revisión: 11/11/2026, rama `claude/happy-ritchie-bfjbbq`.

Leyenda: ✅ implementado y probado · 🟡 implementado, con prueba parcial o con límites · ❌ no implementado.

## 1. Parámetros del parcial

| # | Parámetro | Estado | Evidencia | Pendiente |
|---|---|---|---|---|
| 1 | SaaS multitenant y aislamiento | ✅ | E2E SaaS 64/64, E2E tienda 22/22; FKs compuestas; tenant por JWT; tienda por `/t/<slug>`; catálogo propio por empresa (categorías, tallas, colores, temporadas, colecciones, proveedores); correo único por empresa (ver 1.c) | Solo las ciudades siguen siendo un catálogo compartido |
| 2 | PWA instalable | 🟡 | `vite-plugin-pwa`, manifest (renombrado a DRESSED), SW con precache | No se probó la instalación real ni Lighthouse; `start_url` es `/` (landing) |
| 3 | Persistencia móvil SQLite | 🟡 | `expo-sqlite`, cola y catálogo local, `PendingSyncBanner` | Solo verificado con `tsc`; nunca ejecutado en dispositivo/emulador |
| 4 | Operación offline web (IndexedDB) | ✅ | Prueba en navegador (11/11/2026): POS recarga sin red y muestra el catálogo guardado | Catálogo y carrito **del cliente** offline sin probar tras pasar a `/t/<slug>` (se corrigió el acceso a la tienda sin red) |
| 5 | Ventas en efectivo y reservas offline con UUID | ✅ | Prueba en navegador: venta offline → sincronizada (1 venta con `offlineOperationId`); T14–T22 | Reserva offline desde la web del cliente y móvil sin probar en UI |
| 6 | Sincronización y conflictos | ✅ | `/sync/batch`, idempotencia, STOCK_SHORTFALL, PRICE_CHANGED, CASH_SESSION_CLOSED; T16–T26; Jest | Pantalla de conflictos sin re-probar tras los cambios de rutas |
| 7 | Reportes generativos con IA (lenguaje natural) | 🟡 | Especificación validada, SQL parametrizado de solo lectura, T27–T30, Jest | Sin `AI_API_KEY` solo usa el intérprete local; no se probó con un LLM real |
| 8 | ML supervisado y no supervisado | ✅ | Regresión lineal (demanda) y K-Means RFM; T31–T33; Jest `ml.spec` | Faltan métricas de calidad del modelo para la defensa (ver sugerencias) |
| 9 | Documentación ICONIX | 🟡 | `docs/uml`, `docs/informe` (Cap. I–VI), verificador RNF12 | Falta renderizar los diagramas y regenerar el informe; revisar fecha y bibliografía |

## 1.b Actualización (11/11/2026): SuperAdmin y planes

| Tema | Estado |
|---|---|
| Panel y usuario SuperAdmin (empresas, plan, vigencia, MRR/ARR, suspender, extender) | ✅ 32 pruebas E2E (`npm run test:e2e:planes`) |
| Planes con precio mensual y anual (10 meses) y vigencia por ciclo | ✅ |
| Límites por plan: sucursales, productos, usuarios internos | ✅ aplicados en backend, visibles en precios y *Mi suscripción* |
| Vencimiento: bloquea altas y funciones del plan; la sincronización offline sigue aceptándose | ✅ |
| Suspensión de empresas (login, sesiones activas y tienda pública) | ✅ |
| Cobro real del plan con Stripe Checkout (confirmación, idempotencia, webhook firmado) | ✅ 16 pruebas contra un Stripe simulado; **falta probarlo con tu clave real de Stripe (modo test)** |
| Facturas/recibos y recordatorios de vencimiento por correo | ❌ |
| Cobro por QR en el POS (QR del monto, el cliente escanea y confirma, stock reservado, vence y se cancela) | ✅ 18 pruebas E2E y verificado en navegador; el banco es de demostración |
| QR y tarjeta sin conexión | ❌ no es posible cobrarlos sin red; solo efectivo (idea: venta "por verificar" para conciliar después) |
| Avisos de empresa suspendida / plan vencido (web y móvil) | ✅ web verificada en navegador; móvil solo compilado |

## 1.c Actualización (11/11/2026): correo por empresa, ML persistente y caja móvil

| Tema | Estado |
|---|---|
| Un mismo correo en varias empresas: `users.email` y `clients.email` únicos por `(tenantId, email)`; el login acepta `tenantSlug` y, si el correo y la contraseña coinciden en varias empresas, responde `409 MULTIPLE_TENANTS` y la pantalla deja elegir (sin revelar dónde existe el correo) | ✅ E2E T48–T53 |
| Modelos de ML entrenados y **persistidos por versión** (`POST /analytics/train`, `GET /analytics/models`): parámetros, métricas (MAE vs. baseline ingenuo, silueta) y procedencia de datos reales/sintéticos; las predicciones usan el modelo guardado | ✅ E2E T54–T58 y Jest |
| Generador de datos sintéticos marcado (`npm run seed:synthetic`; `--sales=3000` fija la cantidad exacta de ventas, `--clean` las borra). Los datos de `seed:demo` también son simulados pero **no** están marcados como sintéticos, por lo que el panel los cuenta como reales | ✅ verificado; con k=6 el K-Means recupera los 6 comportamientos generados |
| Caja POS offline en la app móvil (rol CAJERO): migración SQLite v3, sucursal/existencias/clientes mínimos, ventas y detalle locales, descuento de existencias, estado derivado de la cola | 🟡 lógica y SQLite verificados contra SQLite real (`mobile/scripts`), contrato con el backend en E2E T59–T63; **la pantalla no se ejecutó en dispositivo/emulador** |

Límite a declarar: el modelo supervisado es una regresión lineal. En datos sintéticos mejora ≈10 % al baseline ingenuo (repetir el promedio reciente) y en los datos demo con estacionalidad semanal **no lo supera** (error 16,6 contra 9,7); el panel lo muestra tal cual. Sería el siguiente paso mejorarlo (estacionalidad, promedio móvil).

## 2. Qué falta IMPLEMENTAR (lista previa; los puntos 1 y 2 ya se resolvieron)

1. **Panel y usuario SuperAdmin.** El endpoint `GET /saas/tenants` existe, pero no hay usuario SuperAdmin sembrado ni pantalla. Es lo que haría quien vende el SaaS: ver empresas, plan y estado, y suspender.
2. **Límites del plan además de sucursales.** Solo se aplica `maxBranches`. La página de precios menciona límites (p. ej. productos del plan Básico) que el backend no aplica.
3. **Cobro del plan.** Cambiar de plan queda registrado, pero no hay cobro/factura real de la suscripción.
4. **Seguridad de arranque.** El secreto JWT tiene un valor por defecto (`defaultSecret`); en producción debe fallar si no está configurado. CORS está abierto y no hay límite de intentos de login.
5. ~~Catálogos por empresa~~ (resuelto: cada empresa tiene los suyos; `seed:demo` los crea por empresa).
6. ~~Pertenencia de un cliente a varias empresas~~ (resuelto: ver 1.c).
7. **Migraciones** de base de datos versionadas en lugar de `synchronize`.
8. **Push:** requiere credenciales reales (ver sección 4).

## 3. Qué falta PROBAR

| Prueba | Por qué importa |
|---|---|
| App móvil en dispositivo real: login, catálogo, reserva offline, sincronización | Es parámetro 3 y 5; hoy solo compila |
| Reserva offline desde la web del cliente (`/t/<slug>/reservations/new`) | Cambió el enrutamiento |
| Pantalla de conflictos (resolver STOCK_SHORTFALL desde la UI) | Parámetro 6 |
| Reportes IA con un LLM real (`AI_API_KEY`) | Hoy solo intérprete local |
| Flujo de pago real: Stripe en modo prueba, webhook y QR | Solo se probó la lógica interna |
| Instalar la PWA y abrirla sin red | Parámetro 2 |
| Push web y móvil con credenciales propias | Requiere Firebase/EAS |
| Vestidor virtual con cámara | Solo verificado por compilación |
| Carga: varias empresas y concurrencia en cajas/stock | Nunca se midió |
| Cuenta del cliente `/account` dentro de la tienda | Cambió el layout |

## 4. Configuraciones que dependen del equipo

- `GOOGLE_APPLICATION_CREDENTIALS` (backend) y `VITE_FIREBASE_*` / `VITE_FIREBASE_VAPID_KEY` (frontend): sin ellas no hay push.
- `projectId` real de EAS en `mobile/app.json`; compilación propia (no Expo Go).
- `AI_API_KEY`, `AI_API_URL`, `AI_MODEL` para IA generativa real.
- Variables de Cloudinary y Stripe.
- PlantUML (Java + jar) para renderizar los diagramas.

## 5. Sugerencias dentro de los parámetros del parcial

**Para lucirse en la defensa (bajo esfuerzo, alto impacto)**
1. **Métricas del ML:** ✅ hecho para el pronóstico (R², MAE con prueba hacia atrás, confianza alta/media/baja, días de stock y explicación en pantalla; verificado 74/74 contra un recálculo independiente). Pendiente: mostrar el tamaño y la calidad de cada segmento RFM.
2. **IA transparente:** indicar en el reporte qué motor respondió (LLM o reglas) y mostrar la especificación validada. Refuerza que la IA no genera SQL.
3. **Pantalla de estado offline:** contador de operaciones pendientes y último sincronizado en el POS y en la app móvil.
4. **Demo guiada:** un guion de 5 minutos con las cuentas demo (`luna` y `sol`): aislamiento, venta offline, conflicto, reporte IA, segmento RFM.
5. **Prueba de aislamiento visible:** en la defensa, intentar leer datos de `sol` con el token de `luna` y mostrar el 404/403.

**Calidad**
6. Integración continua (GitHub Actions) que ejecute Jest, las E2E (con PostgreSQL de servicio) y el verificador de coherencia.
7. Pruebas de interfaz automáticas del flujo offline (convertir el script de navegador usado en esta revisión en una prueba del repositorio).
8. Reporte de cobertura de requisitos: que `verificar_coherencia.py` también cruce la matriz de trazabilidad con los archivos reales.

**Documentación**
9. Consolidar `docs/ICONIX-SEGUNDO-PARCIAL.md` (usa Mermaid y rutas anteriores) con `docs/informe`, para no entregar dos versiones distintas.
10. Renderizar los diagramas y regenerar el informe antes de entregar; completar fecha y validar la bibliografía.
