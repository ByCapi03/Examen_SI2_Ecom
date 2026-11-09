# CAPÍTULO II. ANÁLISIS DE REQUISITOS

## 2.1. Descripción del sistema propuesto

DRESSED publica en la raíz (`/`) una **página comercial** que presenta el software, sus planes y el registro de
empresas. Cada empresa registrada obtiene:

1. Un **panel de administración** (`/dashboard`) con menú según el rol del usuario.
2. Una **tienda en línea propia** en `/t/<código>` (por ejemplo `/t/luna`), compartible con sus clientes y
   personalizable por el administrador en *Mi tienda web*.
3. Una **aplicación móvil** donde el cliente debe iniciar sesión con su correo y ve el catálogo de la empresa a la que pertenece.

Operación típica: el administrador crea sucursales, personal y cajas; el encargado administra su sucursal; el cajero
abre una sesión de caja y vende en el POS (aun sin conexión, en efectivo); el cliente consulta el catálogo, prueba la
prenda en el vestidor virtual, la reserva o la compra y paga en línea o en sucursal.

## 2.2. Identificación de actores

| Actor | Tipo | Responsabilidad |
|---|---|---|
| SuperAdmin | Humano (plataforma) | Consulta y administra todas las empresas del SaaS. |
| Administrador | Humano (empresa) | Dueño: sucursales, personal, catálogo, plan, tienda web, reportes, auditoría. Administra cajas y sesiones desde su panel. |
| Encargado | Humano (sucursal) | Gestiona su sucursal: inventario, cajas, ventas, reservas, conflictos, reportes de su sucursal. |
| Cajero | Humano (sucursal) | Abre/cierra su sesión de caja, vende en POS, entrega reservas. |
| Cliente | Humano (externo) | Consulta el catálogo de **su** empresa, prueba, reserva, compra, ve su historial. |
| Stripe / pasarela | Sistema externo | Cobro en línea y webhook de confirmación. |
| Cloudinary | Sistema externo | Almacenamiento de imágenes de productos. |
| SMTP / Firebase | Sistema externo | Códigos por correo y notificaciones push. |
| LLM (opcional) | Sistema externo | Interpreta la pregunta del reporte en lenguaje natural. |

## 2.3. Requisitos funcionales y no funcionales

### Requisitos funcionales

| ID | Requisito | Módulo |
|---|---|---|
| RF-01 | Registrar una empresa con su administrador, elegir plan y verificar el correo con un código. | tenants |
| RF-02 | Mostrar planes y permitir al administrador cambiar de plan (con historial). | tenants |
| RF-03 | Iniciar sesión, cambiar contraseña y activar cuentas de clientes por código de correo. | auth |
| RF-04 | Administrar sucursales respetando el máximo del plan. | branches |
| RF-05 | Administrar personal con roles (Administrador, Encargado, Cajero); Encargado y Cajero pertenecen a una sucursal. | auth |
| RF-06 | Administrar catálogo: productos, variantes (talla/color), categorías, temporadas, colecciones, promociones. | catalog |
| RF-07 | Subir imágenes de producto (Cloudinary) y las partes para el vestidor virtual. | catalog |
| RF-08 | Gestionar inventario por sucursal, movimientos y proveedores. | inventory |
| RF-09 | **Crear cajas** por sucursal; luego abrir y cerrar sesiones de caja (un cajero, una caja abierta). | sales |
| RF-10 | Registrar ventas en POS (efectivo, tarjeta, QR) con cliente opcional. | sales |
| RF-11 | Registrar ventas en efectivo y reservas **sin conexión** y sincronizarlas sin duplicar. | sync |
| RF-12 | Detectar conflictos al sincronizar (stock, precio, caja cerrada, datos inválidos) y resolverlos. | sync |
| RF-13 | Publicar el catálogo de cada empresa en `/t/<código>`; sin código válido no se muestra nada. | store |
| RF-14 | Registro de clientes **dentro de una empresa**; en móvil el acceso al catálogo exige iniciar sesión. | auth, mobile |
| RF-15 | Reservar prendas en una sucursal y pagarlas en línea (Stripe) o por QR; entrega y cobro en sucursal. | reservations |
| RF-16 | Comprar en línea (checkout web) y consultar mis compras y reservas. | sales |
| RF-17 | Probar prendas con el vestidor virtual (cámara + detección de pose). | frontend |
| RF-18 | El administrador personaliza su tienda web (portada, logo, color, contacto, secciones, publicar) y la comparte por enlace. | tenants |
| RF-19 | Dashboard con indicadores y reportes de ventas, productos, inventario y reservas, con dictado por voz. | dashboard, reports |
| RF-20 | Reportes en lenguaje natural con IA (planes con IA). | ai-reports |
| RF-21 | Pronóstico de demanda y segmentación RFM de clientes (ML). | analytics |
| RF-22 | Bitácora de auditoría filtrable y exportable. | audit |
| RF-23 | Configuración de apariencia: tema, idioma, moneda, sidebar compacto. | frontend |
| RF-24 | Notificaciones internas y push: reservas (encargado/cliente) y **alerta de stock bajo** (encargado de la sucursal y administrador). | notifications |
| RF-25 | Generar datos demostrativos (2 empresas, personal, cajas, ventas, bitácora). | scripts |

### Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Aislamiento de datos en 3 capas: API (JWT + TenantGuard), ORM (`TenantSubscriber`) y BD (FKs compuestas). |
| RNF-02 | El `tenantId` nunca proviene del cliente en operaciones autenticadas: sale del JWT. En rutas públicas se resuelve por el slug de la tienda y no existe "empresa por defecto". |
| RNF-03 | Sincronización idempotente (UUID por operación) y atómica (transacción + bloqueo pesimista). |
| RNF-04 | La IA nunca genera SQL: produce una especificación validada contra listas blancas; consulta parametrizada, de solo lectura y con tiempo límite. |
| RNF-05 | La aplicación web es una PWA instalable y navegable sin conexión. |
| RNF-06 | Los datos históricos se preservan (migración idempotente). |
| RNF-07 | Interfaz adaptable (responsive) a móvil, tableta y escritorio. |
| RNF-08 | Las contraseñas se almacenan con hash; las acciones del personal se auditan. |
| RNF-09 | El procesamiento de pose del vestidor virtual ocurre en el dispositivo del cliente (privacidad). |
| RNF-10 | Los datos demo pueden regenerarse sin tocar empresas reales (`seed:demo:reset`). |
| RNF-11 | Control de acceso por rol y por plan en cada endpoint (`RolesGuard`, `PlanFeatureGuard`). |
| **RNF-12** | **Coherencia documental: los modelos UML deben representar la solución realmente implementada.** Se cumple generando los diagramas de clases/BD desde las entidades y verificando los demás contra el código. |

## 2.4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Toda entidad operativa pertenece a una sola empresa; ninguna consulta puede cruzar empresas. |
| RN-02 | Un correo electrónico solo puede pertenecer a una empresa. |
| RN-03 | El número de sucursales activas no puede superar el máximo del plan. |
| RN-04 | Plan Básico ($0): 1 sucursal, sin reportes. Starter ($29): 3 sucursales y reportes básicos. Profesional ($79): 10 sucursales, reportes con IA y analítica ML. Empresarial ($199): ilimitadas. |
| RN-05 | Encargado y Cajero deben estar asignados a una sucursal. |
| RN-06 | El administrador **no entra a una sucursal como espacio de trabajo aparte**: administra todo desde su propio panel lateral; el encargado tiene un panel equivalente, adaptado y limitado a su sucursal. |
| RN-07 | Primero se **crea** una caja (única por sucursal y nombre); después un cajero **abre una sesión** sobre ella. |
| RN-08 | Un cajero no puede tener dos cajas abiertas y una caja no puede estar abierta dos veces a la vez. |
| RN-09 | Sin conexión solo se aceptan ventas en **efectivo**; tarjeta y QR requieren conexión. |
| RN-10 | Una operación offline se aplica una sola vez (idempotencia por UUID). |
| RN-11 | Si lo vendido offline supera el stock real, se aplica y se registra un conflicto pendiente para el encargado. |
| RN-12 | Un cliente solo ve el catálogo de la empresa a la que pertenece; en móvil debe iniciar sesión. |
| RN-13 | Una tienda despublicada muestra «no disponible» a los clientes. |
| RN-14 | El reporte con IA solo está disponible en planes con `aiGenerativeReports`. |
| RN-15 | Las contraseñas de las cuentas demo son `123456`; los usuarios nuevos deben cambiar su contraseña temporal. |
| RN-16 | Toda acción de alta, cambio o baja del personal queda en la bitácora con usuario, IP y fecha. |

## 2.5. Diagrama UML de casos de uso

![Diagrama de casos de uso](../uml/out/01_casos_de_uso.png){width=100%}

Fuente: `docs/uml/src/01_casos_de_uso.puml`. Casos de uso: CU-01 Registrar empresa · CU-02 Gestionar plan ·
CU-03 Iniciar sesión · CU-04 Landing y planes · CU-05 Sucursales · CU-06 Personal y roles · CU-07 Catálogo ·
CU-08 Inventario · CU-09 Cajas · CU-10 Tienda web · CU-11 Bitácora · CU-12 Apariencia · CU-13 Sesión de caja ·
CU-14 Venta POS · CU-15 Entregar reserva · CU-16 Sincronizar · CU-17 Conflictos · CU-18 Dashboard/reportes ·
CU-19 Reporte IA · CU-20 Analítica ML · CU-21 Catálogo público · CU-22 Registro de cliente · CU-23 Vestidor ·
CU-24 Reservar · CU-25 Comprar · CU-26 Mis reservas/compras · CU-27 Notificaciones.

## 2.6. Especificación de casos de uso

### CU-09 Administrar cajas de la sucursal
**Actores:** Administrador, Encargado. **Precondición:** la sucursal existe.

*Curso básico:* 1) El actor abre «Sesiones de caja» y pulsa **Crear caja**. 2) Indica sucursal (el encargado solo la suya) y nombre.
3) El sistema valida que el nombre sea único en la sucursal y crea la caja activa. 4) La caja aparece como disponible para abrir.

*Alternos:* 3a) Nombre repetido → se rechaza. 4a) Se desactiva una caja → ya no se ofrece al abrir turno.

### CU-13 Abrir y cerrar sesión de caja
**Actor:** Cajero. **Precondición:** su sucursal tiene al menos una caja activa y libre.

*Curso básico:* 1) El cajero abre su caja con un monto inicial; si hay una sola libre, el sistema la elige. 2) Vende (CU-14).
3) Al terminar cierra e informa el efectivo contado. 4) El sistema calcula esperado vs. reportado y registra la diferencia.

*Alternos:* 1a) Ya tiene una caja abierta → rechazo. 1b) La caja está en uso → rechazo. 1c) No hay cajas creadas → mensaje para pedir a la administración que cree una.

### CU-14 Registrar venta en POS (efectivo / tarjeta / QR)
**Actor:** Cajero. **Precondición:** caja abierta.

*Curso básico:* 1) Busca productos y los agrega al carrito. 2) Opcionalmente asocia o crea un cliente. 3) Elige método de pago y cobra.
4) El sistema registra venta, ítems y pago, descuenta inventario y asocia la venta a la sesión de caja. 5) Muestra el comprobante.

*Alternos:* 3a) Sin conexión y efectivo → se guarda en la cola local (CU-16). 3b) Sin conexión y tarjeta/QR → se informa que solo se acepta efectivo.
4a) Stock insuficiente → se rechaza la línea.

### CU-16 Sincronizar operaciones offline
**Actor:** sistema (sin intervención). **Disparador:** vuelve la conexión.

*Curso básico:* 1) El gestor de sincronización lee las operaciones pendientes. 2) Las envía en lote. 3) El servidor las ordena y, por cada una,
verifica si su UUID ya fue aplicado; si es nueva, la ejecuta en una transacción con bloqueo de inventario. 4) Devuelve el resultado por operación.
5) El cliente elimina las aplicadas. *Alternos:* 3a) Detecta stock/precio/caja cerrada → aplica con conflicto pendiente (CU-17).

### CU-21 Consultar catálogo público de la empresa
**Actor:** Cliente (web). **Precondición:** conoce el enlace o el código de la tienda.

*Curso básico:* 1) Abre `/t/<código>`. 2) El sistema valida la empresa y la tienda publicada. 3) Muestra portada personalizada, productos destacados y sucursales.
4) El cliente navega al catálogo y al detalle de cada producto. *Alternos:* 2a) Código inexistente → «Tienda no encontrada». 2b) Tienda despublicada → «no disponible».
2c) Sesión de otra empresa → aviso para cerrar sesión o volver a su tienda.

### CU-22 Registrarse como cliente de una tienda
**Actor:** Cliente. **Precondición:** conoce el código de su tienda.

*Curso básico:* 1) Abre `/register?tenant=<código>` (en móvil escribe el código de tienda). 2) Completa sus datos. 3) El sistema crea usuario y cliente **dentro de esa empresa**.
4) Inicia sesión y es llevado a su tienda. *Alternos:* 1a) Sin código → se le pide. 3a) Correo ya existente sin cuenta digital → se le ofrece activar su cuenta por código.
3b) Código inexistente → error 404.

### CU-10 Personalizar y compartir mi tienda web
**Actor:** Administrador.

*Curso básico:* 1) Abre «Mi tienda web». 2) Edita frase, título, descripción, logo (URL https), color de acento, WhatsApp, Instagram y qué secciones mostrar. 3) Guarda; el sistema sanea los valores.
4) Revisa la vista previa. 5) Copia o comparte el enlace por WhatsApp/menú del dispositivo. *Alternos:* 2a) Desactiva «Tienda publicada» → el enlace muestra «no disponible».

### CU-23 Probar prenda en el vestidor virtual
**Actor:** Cliente. **Precondición:** el producto tiene realidad aumentada habilitada.

*Curso básico:* 1) Abre el vestidor desde el detalle. 2) Autoriza la cámara. 3) El sistema detecta la pose en el propio dispositivo.
4) Recorta el espacio transparente de la prenda y la ajusta a hombros/caderas/rodillas. *Alternos:* 2a) Permiso denegado → mensaje. 3a) Cuerpo no detectado → se pide alejarse.

### CU-19 Solicitar reporte con IA
**Actor:** Administrador / Encargado. **Precondición:** el plan incluye IA.

*Curso básico:* 1) Escribe la pregunta. 2) El sistema la convierte en una especificación JSON (LLM o intérprete local). 3) La valida contra listas blancas.
4) Ejecuta una consulta parametrizada de solo lectura para su empresa. 5) Muestra tabla y resumen; registra el reporte. *Alternos:* 3a) Especificación inválida → se rechaza.

*Los casos de uso restantes (CU-01…CU-08, CU-11, CU-12, CU-15, CU-17, CU-18, CU-20, CU-24…CU-27) siguen el mismo patrón y se trazan en el Anexo A.*
