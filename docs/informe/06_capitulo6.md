# CAPÍTULO VI. CONCLUSIONES Y RECOMENDACIONES

## 6.1. Conclusiones

1. La plataforma pasó de una tienda única a un **SaaS multitenant** operativo: cada empresa tiene su panel, su tienda en `/t/<código>` y su configuración, y ningún dato cruza de una empresa a otra (pruebas E2E T01–T13 y P01–P12).
2. El aislamiento en tres capas (API, ORM y base de datos) resultó suficiente: incluso un cliente que envía la cabecera de otra empresa recibe solo el catálogo de la suya (P08).
3. La metodología **ICONIX** permitió llegar a la implementación con trazabilidad: requisitos → casos de uso → robustez → secuencia → clases → código → pruebas.
4. El requisito **RNF-12** se cumplió con automatización: los diagramas de clases y de base de datos se generan desde las entidades, y los demás se verifican contra los controladores y servicios reales; un diagrama que cite un endpoint o clase inexistente hace fallar la verificación.
5. La operación offline con sincronización idempotente y gestión de conflictos permite vender en efectivo y reservar sin conexión sin duplicar ni perder dinero (T14–T26).
6. El modelo de **cajas** (crear → abrir sesión → vender → cerrar) y la bitácora dieron control operativo y de auditoría al personal de cada sucursal.
7. El vestidor virtual, la IA en lenguaje natural y la analítica ML aportan diferenciación, con salvaguardas: la IA nunca genera SQL y el procesamiento de pose ocurre en el dispositivo.

## 6.2. Recomendaciones

1. **Correo por empresa.** Hoy un correo pertenece a una sola empresa; para permitir que una persona compre en varias, modelar la pertenencia como relación usuario–empresa.
2. **Catálogos compartidos.** Evaluar volver por empresa las categorías, tallas, colores y colecciones si las empresas necesitan catálogos propios.
3. **Constructor de tienda.** Ampliar *Mi tienda web* con banners, orden de secciones, categorías destacadas y dominio propio.
4. **Migraciones.** Pasar de `synchronize` a migraciones versionadas en producción.
5. **App móvil.** Ejecutar pruebas en dispositivos reales (Android/iOS) y publicar la compilación; permitir ingresar a la tienda con un enlace (deep link) en lugar del código manual.
6. **IA.** Configurar `AI_API_KEY` en producción para lenguaje libre; mantener el intérprete local como respaldo.
7. **Seguridad y operación.** Rotación de secretos, límite de intentos de inicio de sesión, copias de seguridad programadas y monitoreo.
8. **Vestidor.** Subir imágenes de prenda con fondo transparente y accesibles por CORS para el mejor ajuste.

# BIBLIOGRAFÍA

- Chakraborty, S., Hoque, M. S., Jeem, N. R., Biswas, M. C., Bardhan, D., & Lobaton, E. (2021). *Fashion recommendation systems, models and methods: A review*. Informatics, 8(3), 49. https://doi.org/10.3390/informatics8030049
- Chen, C., Ni, J., & Zhang, P. (2024). *Virtual try-on systems in fashion consumption: A systematic review*. Applied Sciences, 14(24), 11839. https://doi.org/10.3390/app142411839
- Shirkhani, S., Mokayed, H., Saini, R., et al. (2023). *Study of AI-driven fashion recommender systems*. SN Computer Science, 4, 514. https://doi.org/10.1007/s42979-023-01932-9
- UNCTAD. (2025). *E-commerce*. SDG Pulse 2025.
- PrestaShop Project. (s. f.). *About the PrestaShop Project*.
- WooCommerce. (s. f.). *About WooCommerce*.
- Rosenberg, D., & Stephens, M. (2007). *Use Case Driven Object Modeling with UML: Theory and Practice*. Apress.
- Rosenberg, D., Stephens, M., & Collins-Cope, M. (2005). *Agile Development with ICONIX Process: People, Process, and Pragmatism*. Apress.
- Object Management Group. (s. f.). *Unified Modeling Language (UML) Specification*.
- NestJS. (s. f.). *NestJS documentation*. https://docs.nestjs.com
- TypeORM. (s. f.). *TypeORM documentation*. https://typeorm.io
- The PostgreSQL Global Development Group. (s. f.). *PostgreSQL documentation*. https://www.postgresql.org/docs/
- PlantUML. (s. f.). *PlantUML Language Reference Guide*. https://plantuml.com
- TensorFlow. (s. f.). *Pose detection (MoveNet)*. https://github.com/tensorflow/tfjs-models/tree/master/pose-detection
- Stripe. (s. f.). *Stripe Checkout and webhooks documentation*. https://docs.stripe.com
