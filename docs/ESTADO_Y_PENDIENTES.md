# Estado del Segundo Parcial: qué está hecho, qué falta probar y qué sugerir

Evaluado contra los 9 puntos del enunciado del parcial. Fecha de la revisión: 11/11/2026, rama `claude/happy-ritchie-bfjbbq`.

Leyenda: ✅ implementado y probado · 🟡 implementado, con prueba parcial o con límites · ❌ no implementado.

## 1. Parámetros del parcial

| # | Parámetro | Estado | Evidencia | Pendiente |
|---|---|---|---|---|
| 1 | SaaS multitenant y aislamiento | ✅ | E2E SaaS 34/34, E2E tienda 22/22; FKs compuestas; tenant por JWT; tienda por `/t/<slug>` | Catálogos globales compartidos; correo único global (limitaciones documentadas) |
| 2 | PWA instalable | 🟡 | `vite-plugin-pwa`, manifest (renombrado a DRESSED), SW con precache | No se probó la instalación real ni Lighthouse; `start_url` es `/` (landing) |
| 3 | Persistencia móvil SQLite | 🟡 | `expo-sqlite`, cola y catálogo local, `PendingSyncBanner` | Solo verificado con `tsc`; nunca ejecutado en dispositivo/emulador |
| 4 | Operación offline web (IndexedDB) | ✅ | Prueba en navegador (11/11/2026): POS recarga sin red y muestra el catálogo guardado | Catálogo y carrito **del cliente** offline sin probar tras pasar a `/t/<slug>` (se corrigió el acceso a la tienda sin red) |
| 5 | Ventas en efectivo y reservas offline con UUID | ✅ | Prueba en navegador: venta offline → sincronizada (1 venta con `offlineOperationId`); T14–T22 | Reserva offline desde la web del cliente y móvil sin probar en UI |
| 6 | Sincronización y conflictos | ✅ | `/sync/batch`, idempotencia, STOCK_SHORTFALL, PRICE_CHANGED, CASH_SESSION_CLOSED; T16–T26; Jest | Pantalla de conflictos sin re-probar tras los cambios de rutas |
| 7 | Reportes generativos con IA (lenguaje natural) | 🟡 | Especificación validada, SQL parametrizado de solo lectura, T27–T30, Jest | Sin `AI_API_KEY` solo usa el intérprete local; no se probó con un LLM real |
| 8 | ML supervisado y no supervisado | ✅ | Regresión lineal (demanda) y K-Means RFM; T31–T33; Jest `ml.spec` | Faltan métricas de calidad del modelo para la defensa (ver sugerencias) |
| 9 | Documentación ICONIX | 🟡 | `docs/uml`, `docs/informe` (Cap. I–VI), verificador RNF12 | Falta renderizar los diagramas y regenerar el informe; revisar fecha y bibliografía |

## 2. Qué falta IMPLEMENTAR

1. **Panel y usuario SuperAdmin.** El endpoint `GET /saas/tenants` existe, pero no hay usuario SuperAdmin sembrado ni pantalla. Es lo que haría quien vende el SaaS: ver empresas, plan y estado, y suspender.
2. **Límites del plan además de sucursales.** Solo se aplica `maxBranches`. La página de precios menciona límites (p. ej. productos del plan Básico) que el backend no aplica.
3. **Cobro del plan.** Cambiar de plan queda registrado, pero no hay cobro/factura real de la suscripción.
4. **Seguridad de arranque.** El secreto JWT tiene un valor por defecto (`defaultSecret`); en producción debe fallar si no está configurado. CORS está abierto y no hay límite de intentos de login.
5. **Catálogos por empresa** (categorías, tallas, colores, colecciones) si cada empresa necesita los suyos.
6. **Pertenencia de un cliente a varias empresas** (hoy un correo = una empresa).
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
1. **Métricas del ML:** mostrar error del pronóstico (MAE/MAPE con prueba hacia atrás) y el tamaño de cada segmento RFM. Justifica el modelo.
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
