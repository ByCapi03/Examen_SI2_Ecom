# HU-22: Reporte de ventas (diagrama de secuencia)

**Como:** usuario autorizado
**Quiero:** generar reportes de ventas filtrados por fecha
**Para:** analizar el rendimiento del negocio

## Diagrama de secuencia

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario autorizado
    participant UI as Pantalla Reportes de ventas
    participant API as Servicio de reportes
    participant DB as Base de datos (facturas)

    U->>UI: Ingresa a "Reportes de ventas"
    UI-->>U: Muestra filtros obligatorios SIN datos
    Note over UI: Tabla y totalizador ocultos hasta configurar al menos 1 filtro

    U->>UI: Configura filtros (ej. rango de fechas)
    alt Ningún filtro configurado
        UI-->>U: Botón "Generar" deshabilitado + mensaje "Configure al menos un filtro"
    else Al menos un filtro configurado
        U->>UI: Solicita generar reporte
        UI->>API: Solicita ventas con filtros
        API->>API: Valida filtros
        alt Filtros inválidos (ej. fecha inicio > fecha fin)
            API-->>UI: Error de validación
            UI-->>U: Muestra mensaje de error, sin datos
        else Filtros válidos
            API->>DB: Consulta facturas que cumplen los filtros
            DB-->>API: Facturas (fecha, nº factura, cliente, total)
            API->>API: Calcula totalizador "Ventas netas"
            API-->>UI: Filas + totalizador
            alt Sin resultados
                UI-->>U: Mensaje "No hay ventas para el criterio"
            else Con resultados
                UI-->>U: Tabla (fecha, nº factura, cliente, total) + ventas netas
            end
        end
    end
```

## Criterios de aceptación

- Pantalla "Reportes de ventas" con filtros obligatorios.
- La pantalla no muestra datos hasta que el usuario configure al menos un filtro.
- Tabla con columnas: fecha, nº factura, cliente, total.
- Totalizador: ventas netas.
- Reportes estáticos y dinámicos.

## Supuestos (por confirmar)

- Basta con un filtro para habilitar la consulta.
- Ventas netas = suma de los totales de las facturas filtradas (no descuenta devoluciones ni anulaciones).
- Reportes estáticos y dinámicos no están detallados en la historia; el diagrama no los modela todavía.
