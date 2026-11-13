/**
 * REPORT SPEC — Lenguaje intermedio seguro entre la IA y la base de datos.
 *
 * La IA (o el intérprete por reglas) SOLO puede producir un objeto ReportSpec
 * cuyos valores pertenecen a listas blancas. El SQL se construye aquí con
 * fragmentos fijos y parámetros posicionales; el tenantId es SIEMPRE el
 * parámetro $1 y proviene del JWT, nunca del texto del usuario ni de la IA.
 */

export const METRICS = [
  'ventas_total', 'cantidad_ventas', 'unidades_vendidas', 'ticket_promedio',
  'stock_disponible', 'productos_stock_bajo', 'reservas', 'clientes_nuevos',
] as const;
export const DIMENSIONS = [
  'producto', 'categoria', 'sucursal', 'dia', 'semana', 'mes', 'canal', 'metodo_pago',
  'cliente', 'talla', 'color', 'temporada', 'estado', 'ninguna',
] as const;
export const CHARTS = ['bar', 'line', 'pie', 'table', 'kpi'] as const;

export type Metric = typeof METRICS[number];
export type Dimension = typeof DIMENSIONS[number];
export type ChartType = typeof CHARTS[number];

export interface ReportFilters {
  dateFrom?: string; // YYYY-MM-DD inclusive
  dateTo?: string;   // YYYY-MM-DD inclusive
  branchId?: number;
  category?: string;
  product?: string;
  channel?: 'WEB' | 'MOVIL' | 'POS';
}

export interface ReportSpec {
  title: string;
  metric: Metric;
  dimension: Dimension;
  /** Segunda agrupación opcional: el reporte pasa a ser una tabla cruzada (filas × columnas). */
  dimension2?: Dimension;
  filters: ReportFilters;
  sort: 'asc' | 'desc';
  limit: number;
  chart: ChartType;
}

type Source = 'SALES' | 'PAYMENTS' | 'INVENTORY' | 'RESERVATIONS' | 'CLIENTS';

const METRIC_SOURCE: Record<Metric, Source> = {
  ventas_total: 'SALES',
  cantidad_ventas: 'SALES',
  unidades_vendidas: 'SALES',
  ticket_promedio: 'SALES',
  stock_disponible: 'INVENTORY',
  productos_stock_bajo: 'INVENTORY',
  reservas: 'RESERVATIONS',
  clientes_nuevos: 'CLIENTS',
};

export const METRIC_LABEL: Record<Metric, string> = {
  ventas_total: 'Ventas (Bs)',
  cantidad_ventas: 'N.º de ventas',
  unidades_vendidas: 'Unidades vendidas',
  ticket_promedio: 'Ticket promedio (Bs)',
  stock_disponible: 'Stock disponible',
  productos_stock_bajo: 'Variantes con stock bajo',
  reservas: 'Reservas',
  clientes_nuevos: 'Clientes nuevos',
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  producto: 'Producto', categoria: 'Categoría', sucursal: 'Sucursal', dia: 'Día', semana: 'Semana',
  mes: 'Mes', canal: 'Canal', metodo_pago: 'Método de pago', cliente: 'Cliente', talla: 'Talla',
  color: 'Color', temporada: 'Temporada', estado: 'Estado', ninguna: 'Total',
};

const TIME_DIMS: Dimension[] = ['dia', 'semana', 'mes'];

/** Dimensiones válidas por fuente de datos. */
const ALLOWED_DIMS: Record<Source, Dimension[]> = {
  SALES: ['producto', 'categoria', 'sucursal', 'dia', 'semana', 'mes', 'canal', 'cliente', 'talla', 'color', 'temporada', 'ninguna'],
  PAYMENTS: ['metodo_pago', 'sucursal', 'canal', 'dia', 'semana', 'mes', 'ninguna'],
  INVENTORY: ['producto', 'categoria', 'sucursal', 'talla', 'color', 'ninguna'],
  RESERVATIONS: ['sucursal', 'dia', 'semana', 'mes', 'estado', 'ninguna'],
  CLIENTS: ['dia', 'semana', 'mes', 'ninguna'],
};

/** Los pagos son la fuente cuando se agrupa por método de pago una métrica de ventas. */
function sourceOf(metric: Metric, dimension: Dimension, dimension2?: Dimension): Source {
  const usesPaymentMethod = dimension === 'metodo_pago' || dimension2 === 'metodo_pago';
  if (usesPaymentMethod && (metric === 'ventas_total' || metric === 'cantidad_ventas')) return 'PAYMENTS';
  return METRIC_SOURCE[metric];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidSpecError extends Error {}

/** Valida y normaliza cualquier objeto (p. ej. JSON devuelto por la IA). */
export function validateSpec(raw: any): ReportSpec {
  if (!raw || typeof raw !== 'object') throw new InvalidSpecError('Especificación vacía');
  const metric = raw.metric as Metric;
  if (!METRICS.includes(metric)) throw new InvalidSpecError(`Métrica no permitida: ${raw.metric}`);
  let dimension = (raw.dimension ?? 'ninguna') as Dimension;
  if (!DIMENSIONS.includes(dimension)) throw new InvalidSpecError(`Dimensión no permitida: ${raw.dimension}`);

  let dimension2: Dimension | undefined;
  if (raw.dimension2 && raw.dimension2 !== 'ninguna') {
    dimension2 = raw.dimension2 as Dimension;
    if (!DIMENSIONS.includes(dimension2)) throw new InvalidSpecError(`Dimensión no permitida: ${raw.dimension2}`);
    if (dimension === 'ninguna') throw new InvalidSpecError('Para cruzar dos agrupaciones indica primero la principal');
    if (dimension2 === dimension) throw new InvalidSpecError('Las dos agrupaciones deben ser distintas');
    if (TIME_DIMS.includes(dimension) && TIME_DIMS.includes(dimension2)) {
      throw new InvalidSpecError('No se pueden cruzar dos agrupaciones de tiempo (día, semana, mes)');
    }
  }

  const source = sourceOf(metric, dimension, dimension2);
  for (const d of [dimension, dimension2]) {
    if (d && !ALLOWED_DIMS[source].includes(d)) {
      throw new InvalidSpecError(`La métrica ${metric} no puede agruparse por ${d}`);
    }
  }

  const f = raw.filters ?? {};
  const filters: ReportFilters = {};
  if (f.dateFrom) { if (!ISO_DATE.test(f.dateFrom)) throw new InvalidSpecError('dateFrom inválida'); filters.dateFrom = f.dateFrom; }
  if (f.dateTo) { if (!ISO_DATE.test(f.dateTo)) throw new InvalidSpecError('dateTo inválida'); filters.dateTo = f.dateTo; }
  if (f.branchId != null && f.branchId !== '') {
    const b = Number(f.branchId);
    if (!Number.isInteger(b) || b <= 0) throw new InvalidSpecError('branchId inválido');
    filters.branchId = b;
  }
  if (f.category) filters.category = String(f.category).slice(0, 60);
  if (f.product) filters.product = String(f.product).slice(0, 80);
  if (f.channel) {
    const ch = String(f.channel).toUpperCase();
    if (!['WEB', 'MOVIL', 'POS'].includes(ch)) throw new InvalidSpecError('Canal inválido');
    filters.channel = ch as any;
  }

  const limit = Math.min(Math.max(Number(raw.limit) || 10, 1), 50);
  const sort = raw.sort === 'asc' ? 'asc' : 'desc';
  let chart = (CHARTS.includes(raw.chart) ? raw.chart : null) as ChartType | null;
  if (!chart) chart = dimension === 'ninguna' ? 'kpi' : TIME_DIMS.includes(dimension) ? 'line' : 'bar';
  if (dimension === 'ninguna') chart = 'kpi';
  // Una tabla cruzada se dibuja como barras (agrupadas o apiladas) o como tabla; no como pastel, línea o KPI
  if (dimension2 && chart !== 'table') chart = 'bar';
  const by = dimension2
    ? `${DIMENSION_LABEL[dimension].toLowerCase()} y ${DIMENSION_LABEL[dimension2].toLowerCase()}`
    : DIMENSION_LABEL[dimension].toLowerCase();
  const title = String(raw.title || `${METRIC_LABEL[metric]} por ${by}`).slice(0, 120);
  return { title, metric, dimension, ...(dimension2 ? { dimension2 } : {}), filters, sort, limit, chart };
}

export interface BuiltQuery { sql: string; params: any[]; source: Source }

interface Prepared {
  params: any[];
  from: string;
  where: string[];
  metricExpr: string;
  dims: Partial<Record<Dimension, string>>;
  source: Source;
}

/** Arma FROM, WHERE y expresiones comunes. tenantId SIEMPRE es $1. */
function prepare(spec: ReportSpec, tenantId: number): Prepared {
  if (!Number.isInteger(tenantId) || tenantId <= 0) throw new InvalidSpecError('tenantId inválido');
  const params: any[] = [tenantId];
  const p = (v: any) => { params.push(v); return `$${params.length}`; };
  const where: string[] = [];
  let from = '';
  let dateCol = '';
  let metricExpr = '';
  const dims: Partial<Record<Dimension, string>> = {};
  const source = sourceOf(spec.metric, spec.dimension, spec.dimension2);

  switch (source) {
    case 'SALES':
      from = `sales s
        JOIN sale_items si ON si."saleId" = s.id
        JOIN variants v ON v.id = si."variantId"
        JOIN products p ON p.id = v."productId" AND p."tenantId" = s."tenantId"
        LEFT JOIN categories cat ON cat.id = p."categoryId"
        LEFT JOIN sizes sz ON sz.id = v."sizeId"
        LEFT JOIN colors co ON co.id = v."colorId"
        LEFT JOIN collections col ON col.id = p."collectionId"
        LEFT JOIN seasons se ON se.id = col."seasonId"
        JOIN branches b ON b.id = s."branchId" AND b."tenantId" = s."tenantId"
        LEFT JOIN clients cl ON cl.id = s."clientId"`;
      where.push(`s."tenantId" = $1`, `s.status IN ('PAGADA', 'COMPLETADA')`);
      dateCol = 's.date';
      metricExpr = {
        ventas_total: 'ROUND(SUM(si.subtotal)::numeric, 2)',
        cantidad_ventas: 'COUNT(DISTINCT s.id)',
        unidades_vendidas: 'SUM(si.quantity)',
        ticket_promedio: 'ROUND((SUM(si.subtotal) / NULLIF(COUNT(DISTINCT s.id), 0))::numeric, 2)',
      }[spec.metric as 'ventas_total']!;
      Object.assign(dims, {
        producto: 'p.name', categoria: `COALESCE(cat.name, 'Sin categoría')`, sucursal: 'b.name',
        canal: 's.channel::text', cliente: `COALESCE(cl.name || ' ' || cl."lastName", 'Cliente general')`,
        talla: `COALESCE(sz.name, '-')`, color: `COALESCE(co.name, '-')`, temporada: `COALESCE(se.name, 'Sin temporada')`,
      });
      if (spec.filters.category) where.push(`cat.name ILIKE ${p('%' + spec.filters.category + '%')}`);
      if (spec.filters.product) where.push(`p.name ILIKE ${p('%' + spec.filters.product + '%')}`);
      if (spec.filters.channel) where.push(`s.channel::text = ${p(spec.filters.channel)}`);
      if (spec.filters.branchId) where.push(`s."branchId" = ${p(spec.filters.branchId)}`);
      break;
    case 'PAYMENTS':
      from = `payments pay
        JOIN sales s ON s.id = pay."saleId" AND s."tenantId" = pay."tenantId"
        JOIN branches b ON b.id = s."branchId" AND b."tenantId" = s."tenantId"`;
      where.push(`pay."tenantId" = $1`, `pay.status = 'APROBADO'`);
      dateCol = 'pay.date';
      metricExpr = spec.metric === 'cantidad_ventas' ? 'COUNT(DISTINCT s.id)' : 'ROUND(SUM(pay.amount)::numeric, 2)';
      Object.assign(dims, { metodo_pago: 'pay.method::text', sucursal: 'b.name', canal: 's.channel::text' });
      if (spec.filters.channel) where.push(`s.channel::text = ${p(spec.filters.channel)}`);
      if (spec.filters.branchId) where.push(`s."branchId" = ${p(spec.filters.branchId)}`);
      break;
    case 'INVENTORY':
      from = `inventory i
        JOIN variants v ON v.id = i."variantId"
        JOIN products p ON p.id = v."productId" AND p."tenantId" = i."tenantId"
        LEFT JOIN categories cat ON cat.id = p."categoryId"
        LEFT JOIN sizes sz ON sz.id = v."sizeId"
        LEFT JOIN colors co ON co.id = v."colorId"
        JOIN branches b ON b.id = i."branchId" AND b."tenantId" = i."tenantId"`;
      where.push(`i."tenantId" = $1`);
      metricExpr = spec.metric === 'stock_disponible'
        ? 'SUM(i.stock - i.reserved)'
        : 'COUNT(*) FILTER (WHERE (i.stock - i.reserved) <= i."stockMin")';
      Object.assign(dims, {
        producto: 'p.name', categoria: `COALESCE(cat.name, 'Sin categoría')`, sucursal: 'b.name',
        talla: `COALESCE(sz.name, '-')`, color: `COALESCE(co.name, '-')`,
      });
      if (spec.filters.category) where.push(`cat.name ILIKE ${p('%' + spec.filters.category + '%')}`);
      if (spec.filters.product) where.push(`p.name ILIKE ${p('%' + spec.filters.product + '%')}`);
      if (spec.filters.branchId) where.push(`i."branchId" = ${p(spec.filters.branchId)}`);
      break;
    case 'RESERVATIONS':
      from = `reservations r JOIN branches b ON b.id = r."branchId" AND b."tenantId" = r."tenantId"`;
      where.push(`r."tenantId" = $1`);
      dateCol = 'r."registrationDate"';
      metricExpr = 'COUNT(*)';
      Object.assign(dims, { sucursal: 'b.name', estado: 'r.status::text' });
      if (spec.filters.branchId) where.push(`r."branchId" = ${p(spec.filters.branchId)}`);
      break;
    case 'CLIENTS':
      from = 'clients c';
      where.push(`c."tenantId" = $1`);
      dateCol = 'c."registrationDate"';
      metricExpr = 'COUNT(*)';
      break;
  }

  if (dateCol) {
    Object.assign(dims, {
      dia: `to_char(date_trunc('day', ${dateCol}), 'YYYY-MM-DD')`,
      semana: `to_char(date_trunc('week', ${dateCol}), 'YYYY-MM-DD')`,
      mes: `to_char(date_trunc('month', ${dateCol}), 'YYYY-MM')`,
    });
    if (spec.filters.dateFrom) where.push(`${dateCol} >= ${p(spec.filters.dateFrom)}::date`);
    if (spec.filters.dateTo) where.push(`${dateCol} < (${p(spec.filters.dateTo)}::date + INTERVAL '1 day')`);
  }
  return { params, from, where, metricExpr, dims, source };
}

const exprOf = (dims: Prepared['dims'], d: Dimension, metric: Metric) => {
  const e = d === 'ninguna' ? `'Total'` : dims[d];
  if (!e) throw new InvalidSpecError(`Dimensión ${d} no disponible para ${metric}`);
  return e;
};

/**
 * Consulta principal. Con una sola agrupación devuelve (etiqueta, valor). Con dos agrupaciones devuelve los
 * TOTALES por la agrupación principal (orden y límite de las filas de la tabla cruzada); las celdas se piden
 * aparte con buildPivotCellsQuery.
 */
export function buildReportQuery(spec: ReportSpec, tenantId: number): BuiltQuery {
  const { params, from, where, metricExpr, dims, source } = prepare(spec, tenantId);
  const dimExpr = exprOf(dims, spec.dimension, spec.metric);
  const isTime = TIME_DIMS.includes(spec.dimension);
  const order = isTime ? 'label ASC' : `value ${spec.sort === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
  const limit = isTime ? 120 : spec.limit;

  const sql = `SELECT ${dimExpr} AS label, ${metricExpr} AS value
    FROM ${from}
    WHERE ${where.join(' AND ')}
    GROUP BY 1
    ORDER BY ${order}
    LIMIT ${Number(limit)}`;
  return { sql, params, source };
}

/** Celdas (agrupación 1 × agrupación 2) limitadas a las filas ya elegidas por la consulta de totales. */
export function buildPivotCellsQuery(spec: ReportSpec, tenantId: number, rowLabels: string[]): BuiltQuery {
  if (!spec.dimension2) throw new InvalidSpecError('La consulta cruzada necesita dimension2');
  const { params, from, where, metricExpr, dims, source } = prepare(spec, tenantId);
  const d1 = exprOf(dims, spec.dimension, spec.metric);
  const d2 = exprOf(dims, spec.dimension2, spec.metric);
  params.push(rowLabels);
  const sql = `SELECT ${d1} AS label, ${d2} AS label2, ${metricExpr} AS value
    FROM ${from}
    WHERE ${where.join(' AND ')} AND ${d1} = ANY($${params.length}::text[])
    GROUP BY 1, 2
    ORDER BY 1, 2
    LIMIT 2000`;
  return { sql, params, source };
}
