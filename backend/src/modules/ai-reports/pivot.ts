/**
 * Tabla cruzada (filas × columnas) de un reporte con dos agrupaciones.
 * Funciones puras: reciben los totales por fila y las celdas que devolvió la base de datos.
 */
import { DIMENSION_LABEL, type Dimension, type Metric, type ReportSpec } from './report-spec';

export interface PivotRow { label: string; cells: number[]; total: number }

export interface Pivot {
  rowLabel: string;
  columnLabel: string;
  /** Valores de la segunda agrupación (una columna cada uno). */
  series: string[];
  rows: PivotRow[];
  /** Total por columna; null cuando la métrica no se puede sumar (p. ej. ticket promedio). */
  columnTotals: number[] | null;
  grandTotal: number | null;
  /** Columnas que no se muestran por superar el máximo. */
  truncatedSeries: number;
  /** ¿Se puede sumar la métrica entre celdas? (decide el gráfico apilado y los totales de columna) */
  additive: boolean;
}

const TIME_DIMS: Dimension[] = ['dia', 'semana', 'mes'];
const ADDITIVE_METRICS: Metric[] = ['ventas_total', 'unidades_vendidas', 'stock_disponible', 'productos_stock_bajo', 'reservas', 'clientes_nuevos'];
/** Una venta puede tener varios valores de estas agrupaciones: contar ventas por ellas repetiría la misma venta. */
const MULTI_VALUED: Dimension[] = ['producto', 'categoria', 'talla', 'color', 'temporada', 'metodo_pago'];

export function isAdditive(spec: Pick<ReportSpec, 'metric' | 'dimension' | 'dimension2'>): boolean {
  if (ADDITIVE_METRICS.includes(spec.metric)) return true;
  if (spec.metric === 'cantidad_ventas') {
    return ![spec.dimension, spec.dimension2].some((d) => d && MULTI_VALUED.includes(d));
  }
  return false;
}

export function buildPivot(
  spec: ReportSpec,
  totals: { label: string; value: number }[],
  cells: { label: string; label2: string; value: number }[],
  maxSeries = 8,
): Pivot {
  const dim2 = spec.dimension2 as Dimension;
  const bySeries = new Map<string, number>();
  const cellMap = new Map<string, number>();
  for (const c of cells) {
    cellMap.set(`${c.label}\u0000${c.label2}`, c.value);
    bySeries.set(c.label2, (bySeries.get(c.label2) ?? 0) + c.value);
  }

  let series = [...bySeries.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const truncatedSeries = Math.max(0, series.length - maxSeries);
  series = series.slice(0, maxSeries);
  if (TIME_DIMS.includes(dim2)) series.sort();

  const rows: PivotRow[] = totals.map((t) => ({
    label: t.label,
    cells: series.map((sName) => cellMap.get(`${t.label}\u0000${sName}`) ?? 0),
    total: t.value,
  }));

  const additive = isAdditive(spec);
  const columnTotals = additive ? series.map((_, i) => Number(rows.reduce((a, r) => a + r.cells[i], 0).toFixed(2))) : null;
  const grandTotal = additive ? Number(rows.reduce((a, r) => a + r.total, 0).toFixed(2)) : null;

  return {
    rowLabel: DIMENSION_LABEL[spec.dimension],
    columnLabel: DIMENSION_LABEL[dim2],
    series,
    rows,
    columnTotals,
    grandTotal,
    truncatedSeries,
    additive,
  };
}

const fmt = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });

/** Lectura automática de la tabla cruzada: mayor combinación, quién predomina en cada fila y concentración. */
export function pivotInsights(spec: ReportSpec, pivot: Pivot): { type: 'top' | 'pareto' | 'avg'; text: string }[] {
  const out: { type: 'top' | 'pareto' | 'avg'; text: string }[] = [];
  if (!pivot.rows.length || !pivot.series.length) return out;

  let best = { r: '', c: '', v: -Infinity };
  for (const row of pivot.rows) row.cells.forEach((v, i) => { if (v > best.v) best = { r: row.label, c: pivot.series[i], v }; });
  if (best.v > 0) out.push({ type: 'top', text: `Mayor combinación: "${best.r}" en "${best.c}" con ${fmt(best.v)}.` });

  for (const row of pivot.rows.slice(0, 3)) {
    const sum = row.cells.reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    const idx = row.cells.indexOf(Math.max(...row.cells));
    const share = (row.cells[idx] / sum) * 100;
    out.push({
      type: share >= 70 ? 'pareto' : 'avg',
      text: `En "${row.label}" predomina "${pivot.series[idx]}" (${share.toFixed(1)}% de lo mostrado en esa fila).`,
    });
  }

  if (pivot.columnTotals) {
    const max = Math.max(...pivot.columnTotals);
    const total = pivot.columnTotals.reduce((a, b) => a + b, 0);
    if (total > 0) out.push({ type: 'top', text: `Por ${pivot.columnLabel.toLowerCase()}, lidera "${pivot.series[pivot.columnTotals.indexOf(max)]}" con ${fmt(max)} (${((max / total) * 100).toFixed(1)}% del total).` });
  }
  if (pivot.truncatedSeries > 0) out.push({ type: 'avg', text: `Se muestran las ${pivot.series.length} columnas principales; ${pivot.truncatedSeries} más quedaron fuera.` });
  return out;
}
