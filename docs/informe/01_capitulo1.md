# CAPÍTULO I. ASPECTOS GENERALES

## 1.1. Introducción

DRESSED es una plataforma **SaaS multitenant** para negocios de venta de ropa. Una sola instalación del
sistema atiende a varias empresas; cada una administra sus sucursales, personal, catálogo, inventario,
cajas, reservas y ventas, y obtiene **su propia tienda en línea** accesible por un enlace compartible
(`/t/<código-de-empresa>`). Los clientes finales compran y reservan desde la web o desde la aplicación móvil.

El sistema se compone de tres productos que comparten una única API:

| Producto | Tecnología | Usuarios |
|---|---|---|
| API | NestJS, TypeORM, PostgreSQL | Todos |
| Aplicación web (PWA) | React + Vite | Personal de la empresa y clientes |
| Aplicación móvil | Expo / React Native | Clientes |

## 1.2. Planteamiento del problema

Los comercios de ropa pequeños y medianos controlan inventario, ventas y reservas con hojas de cálculo o
sistemas aislados; no pueden mostrar su catálogo en línea ni operar si se cae la conexión; no saben qué
prendas reponer ni quiénes son sus mejores clientes; y los clientes no pueden probar una prenda antes de
reservarla. Las empresas con varias sucursales además pierden el control de quién abre cada caja, quién
vende y quién modificó qué dato.

Un software hecho a la medida de una sola tienda no resuelve el problema del proveedor del software: necesita
vender **el mismo sistema a muchas empresas** garantizando que los datos de una nunca sean visibles para otra.

## 1.3. Objetivos del proyecto

### 1.3.1. Objetivo general

Desarrollar una plataforma SaaS multitenant, modelada con ICONIX y UML, que permita a cada empresa de ropa
gestionar su operación comercial y publicar su catálogo en línea para sus clientes, con aislamiento total de datos.

### 1.3.2. Objetivos específicos

1. Modelar el sistema con ICONIX (requisitos, casos de uso, robustez, secuencia y clases) manteniendo los
   modelos coherentes con el código (RNF12).
2. Implementar el aislamiento multitenant en tres capas: API, ORM y base de datos.
3. Ofrecer planes de suscripción mensuales o anuales, con límites (sucursales, productos, usuarios) y funciones (IA, ML, reportes) según el plan, y un panel de plataforma para administrarlas.
4. Implementar el flujo operativo de la tienda: sucursales, personal con roles, catálogo, inventario, cajas,
   sesiones de caja, POS y reservas.
5. Permitir operar sin conexión (ventas en efectivo y reservas) con sincronización idempotente y gestión de conflictos.
6. Dar a cada empresa una tienda web propia, personalizable y compartible, y una app móvil donde el cliente
   inicia sesión y ve solo el catálogo de su empresa.
7. Incorporar analítica: dashboard, reportes, reportes en lenguaje natural con IA y modelos de ML.
8. Registrar una bitácora de auditoría de las acciones del personal.

## 1.4. Justificación

- **Técnica:** una sola base de código y una sola base de datos sirven a todas las empresas, reduciendo el costo de operación.
- **Económica:** el plan Básico es gratuito; las empresas crecen de plan sin migrar datos.
- **Social/comercial:** las tiendas pequeñas acceden a herramientas de punto de venta, catálogo en línea y analítica que antes solo tenían las grandes.
- **Académica:** aplica ICONIX de punta a punta con trazabilidad requisito → caso de uso → clase → prueba.

## 1.5. Alcance y limitaciones

**Alcance.** Plataforma SaaS (alta de empresas y planes), panel de administración por rol, POS con cajas,
reservas, tienda pública por empresa, vestidor virtual, PWA offline, app móvil de clientes, reportes, IA y ML,
bitácora, datos demo.

**Limitaciones conocidas.**

- Un **correo electrónico pertenece a una sola empresa** (`users.email` y `clients.email` son únicos globalmente).
- Categorías, tallas, colores, temporadas, ciudades, colecciones, promociones y proveedores son catálogos globales compartidos.
- La app móvil es de clientes; las ventas offline se hacen en el POS web. El cliente móvil debe conocer el **código de tienda** al registrarse por primera vez.
- Sin `AI_API_KEY`, los reportes con IA usan un intérprete local en español (no lenguaje libre arbitrario).
- La personalización de la tienda web cubre portada, color, logo, contacto y secciones; no es un constructor de páginas libre ni admite dominio propio.
- El vestidor virtual depende de la cámara y de que la imagen de la prenda permita acceso desde el navegador (CORS).

## 1.6. Metodología de desarrollo ICONIX

ICONIX es un proceso **dirigido por casos de uso** y ligero, que usa un subconjunto de UML. Las etapas aplicadas:

| Etapa ICONIX | Producto en este proyecto | Capítulo |
|---|---|---|
| Requisitos | Requisitos funcionales / no funcionales, reglas de negocio | II |
| Modelo de dominio | `docs/uml/src/02_modelo_dominio.puml` | III |
| Casos de uso | `01_casos_de_uso.puml` y especificaciones | II |
| Diagramas de robustez | `03a…03e_robustez_*.puml` | III |
| Diagramas de secuencia | `04a…04g_sec_*.puml` | III |
| Diagrama de clases | generado desde las entidades + `05_clases_diseno.puml` | III |
| Implementación y pruebas | Código, pruebas Jest y E2E | IV, V |

Se utiliza **PlantUML** como lenguaje de modelado: los modelos son texto versionable en Git y se
renderizan con un script (`docs/uml/scripts/build_uml.sh`).
