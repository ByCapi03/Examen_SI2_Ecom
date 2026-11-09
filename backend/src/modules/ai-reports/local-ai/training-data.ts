/**
 * Datos de entrenamiento etiquetados manualmente.
 * ~200 preguntas en español de negocios de ropa → {metric, dimension}
 */
import type { Metric, Dimension } from '../report-spec';

export interface TrainingExample {
  text: string;
  metric: Metric;
  dimension: Dimension;
}

export const TRAINING_DATA: TrainingExample[] = [
  // === VENTAS_TOTAL ===
  { text: 'cuanto vendimos en total este mes', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'total de ventas del mes pasado', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'ingresos totales de esta semana', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'cuantos bolivianos generamos ayer', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'facturacion del ultimo trimestre', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'monto total vendido en enero', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'resumen de ingresos de la empresa', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'ventas totales de este año', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'cuanto dinero entro por ventas este mes', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'revenue de los ultimos 7 dias', metric: 'ventas_total', dimension: 'ninguna' },

  { text: 'ventas por sucursal este mes', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'cuanto vende cada sucursal', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'ingresos por tienda del mes pasado', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'comparar ventas entre sucursales', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'que sucursal genera mas dinero', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'ranking de sucursales por ingresos', metric: 'ventas_total', dimension: 'sucursal' },

  { text: 'ventas por categoria', metric: 'ventas_total', dimension: 'categoria' },
  { text: 'ingresos por categoria de ropa', metric: 'ventas_total', dimension: 'categoria' },
  { text: 'que categoria de ropa vendio mas', metric: 'ventas_total', dimension: 'categoria' },
  { text: 'ventas desglosadas por categoria', metric: 'ventas_total', dimension: 'categoria' },
  { text: 'cuanto aporta cada categoria', metric: 'ventas_total', dimension: 'categoria' },

  { text: 'ventas diarias de esta semana', metric: 'ventas_total', dimension: 'dia' },
  { text: 'evolucion de ventas dia a dia', metric: 'ventas_total', dimension: 'dia' },
  { text: 'tendencia de ventas por dia', metric: 'ventas_total', dimension: 'dia' },
  { text: 'ventas de cada dia de la semana pasada', metric: 'ventas_total', dimension: 'dia' },

  { text: 'ventas mensuales del año', metric: 'ventas_total', dimension: 'mes' },
  { text: 'ingresos por mes en 2026', metric: 'ventas_total', dimension: 'mes' },
  { text: 'evolucion mensual de ventas', metric: 'ventas_total', dimension: 'mes' },
  { text: 'tendencia de ventas por mes', metric: 'ventas_total', dimension: 'mes' },
  { text: 'comparar ventas mes a mes', metric: 'ventas_total', dimension: 'mes' },

  { text: 'ventas semanales de los ultimos 3 meses', metric: 'ventas_total', dimension: 'semana' },
  { text: 'ingresos por semana', metric: 'ventas_total', dimension: 'semana' },
  { text: 'evolucion semanal de las ventas', metric: 'ventas_total', dimension: 'semana' },

  { text: 'ventas por canal web o tienda', metric: 'ventas_total', dimension: 'canal' },
  { text: 'cuanto se vende por internet vs pos', metric: 'ventas_total', dimension: 'canal' },
  { text: 'ingresos por canal de venta', metric: 'ventas_total', dimension: 'canal' },
  { text: 'ventas web versus tienda fisica', metric: 'ventas_total', dimension: 'canal' },

  { text: 'ventas por talla este mes', metric: 'ventas_total', dimension: 'talla' },
  { text: 'que talla genera mas ingresos', metric: 'ventas_total', dimension: 'talla' },
  { text: 'ingresos desglosados por talla', metric: 'ventas_total', dimension: 'talla' },

  { text: 'ventas por color de prenda', metric: 'ventas_total', dimension: 'color' },
  { text: 'que colores se venden mas por dinero', metric: 'ventas_total', dimension: 'color' },
  { text: 'ingresos por color', metric: 'ventas_total', dimension: 'color' },

  { text: 'ventas por temporada', metric: 'ventas_total', dimension: 'temporada' },
  { text: 'ingresos de cada temporada', metric: 'ventas_total', dimension: 'temporada' },
  { text: 'que temporada genero mas ventas', metric: 'ventas_total', dimension: 'temporada' },

  { text: 'ventas por cliente', metric: 'ventas_total', dimension: 'cliente' },
  { text: 'cuanto gasto cada cliente', metric: 'ventas_total', dimension: 'cliente' },
  { text: 'top clientes por monto de compra', metric: 'ventas_total', dimension: 'cliente' },
  { text: 'clientes que mas compraron en monto', metric: 'ventas_total', dimension: 'cliente' },

  // === CANTIDAD_VENTAS ===
  { text: 'cuantas ventas se hicieron hoy', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'numero de transacciones de este mes', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'cantidad de ventas del mes pasado', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'total de pedidos en la semana', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'cuantas transacciones hubo ayer', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'conteo de ventas del trimestre', metric: 'cantidad_ventas', dimension: 'ninguna' },

  { text: 'numero de ventas por sucursal', metric: 'cantidad_ventas', dimension: 'sucursal' },
  { text: 'cuantas transacciones por tienda', metric: 'cantidad_ventas', dimension: 'sucursal' },
  { text: 'conteo de ventas en cada sucursal', metric: 'cantidad_ventas', dimension: 'sucursal' },

  { text: 'cantidad de ventas por metodo de pago', metric: 'cantidad_ventas', dimension: 'metodo_pago' },
  { text: 'cuantas ventas en efectivo vs tarjeta', metric: 'cantidad_ventas', dimension: 'metodo_pago' },
  { text: 'transacciones por forma de pago', metric: 'cantidad_ventas', dimension: 'metodo_pago' },
  { text: 'uso de qr versus efectivo en ventas', metric: 'cantidad_ventas', dimension: 'metodo_pago' },

  { text: 'ventas diarias cantidad esta semana', metric: 'cantidad_ventas', dimension: 'dia' },
  { text: 'cuantas ventas por dia', metric: 'cantidad_ventas', dimension: 'dia' },
  { text: 'pedidos por dia de la semana pasada', metric: 'cantidad_ventas', dimension: 'dia' },

  // === UNIDADES_VENDIDAS ===
  { text: 'cuantas prendas vendimos este mes', metric: 'unidades_vendidas', dimension: 'ninguna' },
  { text: 'total de unidades vendidas', metric: 'unidades_vendidas', dimension: 'ninguna' },
  { text: 'cuantos articulos se vendieron', metric: 'unidades_vendidas', dimension: 'ninguna' },
  { text: 'prendas despachadas este mes', metric: 'unidades_vendidas', dimension: 'ninguna' },

  { text: 'productos mas vendidos en unidades', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'cuantas unidades por producto', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'top 5 productos mas vendidos', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'ranking de productos por cantidad', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'cuales son los articulos mas vendidos', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'prendas mas populares en ventas', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'vestidos mas vendidos', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'camisas con mas salida', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'que articulos se vendieron menos', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'productos con menos ventas', metric: 'unidades_vendidas', dimension: 'producto' },

  { text: 'unidades vendidas por talla', metric: 'unidades_vendidas', dimension: 'talla' },
  { text: 'que talla se vende mas en cantidad', metric: 'unidades_vendidas', dimension: 'talla' },
  { text: 'cuantas prendas por talla', metric: 'unidades_vendidas', dimension: 'talla' },

  { text: 'prendas vendidas por color', metric: 'unidades_vendidas', dimension: 'color' },
  { text: 'que colores se venden mas en piezas', metric: 'unidades_vendidas', dimension: 'color' },
  { text: 'unidades por color de ropa', metric: 'unidades_vendidas', dimension: 'color' },

  { text: 'unidades por categoria', metric: 'unidades_vendidas', dimension: 'categoria' },
  { text: 'cuantas prendas por categoria', metric: 'unidades_vendidas', dimension: 'categoria' },
  { text: 'articulos mas vendidos por rubro', metric: 'unidades_vendidas', dimension: 'categoria' },

  // === TICKET_PROMEDIO ===
  { text: 'cual es el ticket promedio', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'promedio de venta por transaccion', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'cuanto gasta en promedio cada cliente', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'venta promedio este mes', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'monto medio por compra', metric: 'ticket_promedio', dimension: 'ninguna' },

  { text: 'ticket promedio por sucursal', metric: 'ticket_promedio', dimension: 'sucursal' },
  { text: 'promedio de venta en cada tienda', metric: 'ticket_promedio', dimension: 'sucursal' },
  { text: 'donde se gasta mas por compra', metric: 'ticket_promedio', dimension: 'sucursal' },

  // === STOCK_DISPONIBLE ===
  { text: 'cuanto stock tenemos disponible', metric: 'stock_disponible', dimension: 'ninguna' },
  { text: 'inventario total disponible', metric: 'stock_disponible', dimension: 'ninguna' },
  { text: 'existencias actuales', metric: 'stock_disponible', dimension: 'ninguna' },
  { text: 'cuantas unidades hay en inventario', metric: 'stock_disponible', dimension: 'ninguna' },

  { text: 'stock por producto', metric: 'stock_disponible', dimension: 'producto' },
  { text: 'cuantas unidades hay de cada producto', metric: 'stock_disponible', dimension: 'producto' },
  { text: 'inventario desglosado por articulo', metric: 'stock_disponible', dimension: 'producto' },
  { text: 'stock disponible de cada prenda', metric: 'stock_disponible', dimension: 'producto' },
  { text: 'existencias por producto', metric: 'stock_disponible', dimension: 'producto' },

  { text: 'inventario por sucursal', metric: 'stock_disponible', dimension: 'sucursal' },
  { text: 'stock en cada tienda', metric: 'stock_disponible', dimension: 'sucursal' },
  { text: 'cuantas prendas hay en cada sucursal', metric: 'stock_disponible', dimension: 'sucursal' },

  { text: 'stock por categoria', metric: 'stock_disponible', dimension: 'categoria' },
  { text: 'inventario por tipo de ropa', metric: 'stock_disponible', dimension: 'categoria' },
  { text: 'cuantas prendas por categoria en stock', metric: 'stock_disponible', dimension: 'categoria' },

  { text: 'stock por talla', metric: 'stock_disponible', dimension: 'talla' },
  { text: 'cuantas prendas hay por talla', metric: 'stock_disponible', dimension: 'talla' },
  { text: 'inventario desglosado por talla', metric: 'stock_disponible', dimension: 'talla' },

  { text: 'stock por color', metric: 'stock_disponible', dimension: 'color' },
  { text: 'inventario por color de prenda', metric: 'stock_disponible', dimension: 'color' },

  // === PRODUCTOS_STOCK_BAJO ===
  { text: 'productos con stock bajo', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'que productos estan por agotarse', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'articulos que necesitan reposicion', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'stock critico de prendas', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'cuales prendas estan agotandose', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'productos que se estan acabando', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'alerta de stock bajo', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'que hay que reponer urgente', metric: 'productos_stock_bajo', dimension: 'ninguna' },

  { text: 'productos con bajo inventario por sucursal', metric: 'productos_stock_bajo', dimension: 'sucursal' },
  { text: 'donde hay mas articulos por agotarse', metric: 'productos_stock_bajo', dimension: 'sucursal' },

  // === RESERVAS ===
  { text: 'cuantas reservas tenemos activas', metric: 'reservas', dimension: 'ninguna' },
  { text: 'total de reservas de esta semana', metric: 'reservas', dimension: 'ninguna' },
  { text: 'numero de reservas del mes', metric: 'reservas', dimension: 'ninguna' },
  { text: 'reservas pendientes', metric: 'reservas', dimension: 'ninguna' },

  { text: 'reservas por estado', metric: 'reservas', dimension: 'estado' },
  { text: 'cuantas reservas confirmadas vs canceladas', metric: 'reservas', dimension: 'estado' },
  { text: 'estado de las reservas', metric: 'reservas', dimension: 'estado' },
  { text: 'reservas pendientes vs completadas', metric: 'reservas', dimension: 'estado' },

  { text: 'reservas por sucursal', metric: 'reservas', dimension: 'sucursal' },
  { text: 'cuantas reservas en cada tienda', metric: 'reservas', dimension: 'sucursal' },
  { text: 'donde se hacen mas reservas', metric: 'reservas', dimension: 'sucursal' },

  { text: 'evolucion de reservas por dia', metric: 'reservas', dimension: 'dia' },
  { text: 'reservas diarias esta semana', metric: 'reservas', dimension: 'dia' },

  { text: 'reservas mensuales', metric: 'reservas', dimension: 'mes' },
  { text: 'tendencia de reservas por mes', metric: 'reservas', dimension: 'mes' },

  // === CLIENTES_NUEVOS ===
  { text: 'cuantos clientes nuevos tuvimos este mes', metric: 'clientes_nuevos', dimension: 'ninguna' },
  { text: 'nuevos registros de clientes', metric: 'clientes_nuevos', dimension: 'ninguna' },
  { text: 'clientes registrados esta semana', metric: 'clientes_nuevos', dimension: 'ninguna' },
  { text: 'captacion de nuevos clientes', metric: 'clientes_nuevos', dimension: 'ninguna' },
  { text: 'cuantos clientes se unieron al sistema', metric: 'clientes_nuevos', dimension: 'ninguna' },

  { text: 'clientes nuevos por mes', metric: 'clientes_nuevos', dimension: 'mes' },
  { text: 'evolucion de clientes nuevos mensual', metric: 'clientes_nuevos', dimension: 'mes' },
  { text: 'tendencia de captacion mensual', metric: 'clientes_nuevos', dimension: 'mes' },

  { text: 'clientes nuevos por semana', metric: 'clientes_nuevos', dimension: 'semana' },
  { text: 'registro de nuevos clientes semanal', metric: 'clientes_nuevos', dimension: 'semana' },

  { text: 'clientes nuevos por dia', metric: 'clientes_nuevos', dimension: 'dia' },
  { text: 'cuantos clientes se registran cada dia', metric: 'clientes_nuevos', dimension: 'dia' },

  // === VENTAS por METODO_PAGO ===
  { text: 'ventas por metodo de pago', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'ingresos por forma de pago', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'cuanto se pago en efectivo vs tarjeta', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'uso de qr en ventas', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'medios de pago mas usados por monto', metric: 'ventas_total', dimension: 'metodo_pago' },

  // === VENTAS por PRODUCTO ===
  { text: 'ingresos por producto', metric: 'ventas_total', dimension: 'producto' },
  { text: 'que producto genera mas dinero', metric: 'ventas_total', dimension: 'producto' },
  { text: 'ventas desglosadas por articulo', metric: 'ventas_total', dimension: 'producto' },
];
