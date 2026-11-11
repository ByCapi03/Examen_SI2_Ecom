# CAPÍTULO III. ANÁLISIS Y DISEÑO CON ICONIX

> Todos los diagramas de este capítulo se renderizan desde `docs/uml/src/*.puml` y
> `docs/uml/generated/*.puml` con `docs/uml/scripts/build_uml.sh`.

## 3.1. Modelo de dominio

![Modelo de dominio](../uml/out/02_modelo_dominio.png){width=100%}

Conceptos principales: **Empresa (Tenant)** agrupa Sucursales, Usuarios, Clientes, Cajas, Productos, Inventario,
Ventas y Reservas. La **Suscripción** vincula la empresa a un **Plan**. El **Cliente** puede tener una cuenta digital
(Usuario). Las **Operaciones offline** y sus **Conflictos** sostienen la sincronización. Las entidades globales
(ciudades, categorías, tallas, colores, temporadas, colecciones, promociones, proveedores) son compartidas.

## 3.2. Diagramas de robustez

En ICONIX, los diagramas de robustez conectan el **actor** con **fronteras** (pantallas), **controles** (lógica) y **entidades** (datos).
Se elaboraron para los casos de uso nuevos o modificados:

| Diagrama | Caso de uso | Archivo |
|---|---|---|
| Venta POS con caja y sincronización | CU-13, CU-14, CU-16 | `03a_robustez_venta_pos.puml` |
| Tienda pública y registro de cliente | CU-21, CU-22 | `03b_robustez_tienda_publica.puml` |
| Reserva y pago | CU-24, CU-25 | `03c_robustez_reserva_pago.puml` |
| Tienda web personalizable | CU-10 | `03d_robustez_tienda_web.puml` |
| Vestidor virtual | CU-23 | `03e_robustez_vestidor.puml` |

![Robustez: venta POS](../uml/out/03a_robustez_venta_pos.png){width=100%}

![Robustez: tienda pública y registro](../uml/out/03b_robustez_tienda_publica.png){width=100%}

![Robustez: reserva y pago](../uml/out/03c_robustez_reserva_pago.png){width=100%}

![Robustez: tienda web](../uml/out/03d_robustez_tienda_web.png){width=100%}

![Robustez: vestidor virtual](../uml/out/03e_robustez_vestidor.png){width=100%}

## 3.3. Diagramas de secuencia UML

| Diagrama | Descripción |
|---|---|
| `04a_sec_login_multitenant` | Inicio de sesión: el `tenantId` entra al JWT desde el usuario. |
| `04b_sec_registro_cliente_tienda` | Registro de cliente con `X-Tenant-Slug` y `requireTenantId()`. |
| `04c_sec_venta_pos_offline` | Venta offline, cola, lote y sincronización idempotente. |
| `04d_sec_caja` | Crear caja y abrir sesión de caja. |
| `04e_sec_reserva_pago` | Reserva con pago Stripe y webhook. |
| `04f_sec_tienda_web` | Personalización y visita de la tienda web. |
| `04g_sec_reporte_ia` | Reporte en lenguaje natural sin SQL generado por la IA. |
| `04h_sec_alerta_stock` | Alerta de stock bajo: subscriber, notificación interna y push. |
| `04i_sec_plataforma_suscripcion` | SuperAdmin cambia el plan y suspende una empresa. |

![Secuencia: inicio de sesión](../uml/out/04a_sec_login_multitenant.png){width=95%}

![Secuencia: registro de cliente](../uml/out/04b_sec_registro_cliente_tienda.png){width=95%}

![Secuencia: venta offline](../uml/out/04c_sec_venta_pos_offline.png){width=95%}

![Secuencia: cajas](../uml/out/04d_sec_caja.png){width=95%}

![Secuencia: reserva y pago](../uml/out/04e_sec_reserva_pago.png){width=95%}

![Secuencia: tienda web](../uml/out/04f_sec_tienda_web.png){width=95%}

![Secuencia: reporte IA](../uml/out/04g_sec_reporte_ia.png){width=95%}

![Secuencia: alerta de stock](../uml/out/04h_sec_alerta_stock.png){width=95%}

![Secuencia: plataforma y suscripción](../uml/out/04i_sec_plataforma_suscripcion.png){width=95%}

## 3.4. Diagrama de clases UML

**Modelo persistente (generado).** El script `gen_entities_uml.py` lee las 34 entidades TypeORM y produce el
diagrama de clases; así no puede divergir del código.

![Diagrama de clases generado](../uml/out/diagrama_clases.png){width=100%}

**Clases de diseño.** Muestra el middleware de contexto, subscriber, guards y servicios principales y sus dependencias reales.

![Clases de diseño](../uml/out/05_clases_diseno.png){width=100%}

## 3.5. Diseño de la base de datos

PostgreSQL con el esquema generado por TypeORM. El aislamiento se refuerza en la base de datos con **claves foráneas
compuestas `(id, tenantId)`**, de modo que un registro no puede referenciar datos de otra empresa.
Entre las tablas nuevas o cambiadas: `cash_registers` (cajas; única por sucursal y nombre), `cash_sessions`
(sesión sobre una caja), `audit_logs` (bitácora), `offline_sync_operations` y conflictos, `ai_report_logs`,
y la columna `tenants.storeConfig` (jsonb) con la configuración de la tienda web.

![Modelo físico de la base de datos](../uml/out/diagrama_bd.png){width=100%}

El diccionario de datos completo (campos, tipos, PK, nulos) se genera en `docs/uml/generated/diccionario_datos.md` y se incluye en el Anexo B.

## 3.6. Diseño de interfaces de usuario

| Zona | Ruta | Descripción |
|---|---|---|
| Landing SaaS | `/` | Presentación del software, funciones, planes, registro y acceso por código de tienda. |
| Planes y registro de empresa | `/pricing`, `/saas/register` | Elección de plan y alta con verificación por correo. |
| Login | `/login` | Acceso universal; con `?tenant=` muestra la empresa. |
| Tienda de la empresa | `/t/<código>` | Portada personalizada, catálogo, detalle, vestidor, carrito, reservas, checkout. |
| Registro de cliente | `/register?tenant=<código>` | Alta del cliente dentro de la empresa. |
| Cuenta del cliente | `/account/*` | Perfil, reservas, compras. |
| Panel de personal | `/dashboard/*` | Menú lateral por rol: dashboard, ventas, reservas, cajas, productos, inventario, **Mi tienda web**, reportes, IA, analítica, sucursales, usuarios, conflictos, bitácora, configuración. |
| POS | `/dashboard/pos` | Terminal del cajero. |
| App móvil | Expo | Sin sesión: Login, Registro (con código de tienda), Activar cuenta. Con sesión: catálogo, carrito, reservas, compras, perfil, vestidor. |

Criterios de diseño: paleta verde/dorado, tipografía Outfit, tema claro/oscuro configurable, sidebar compacto opcional, diseño responsive y accesible.
