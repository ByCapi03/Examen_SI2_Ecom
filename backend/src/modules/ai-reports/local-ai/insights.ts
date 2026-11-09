/**
 * Generación de insights deterministas a partir de los datos del reporte.
 * Incluye: total/promedio, top/bottom, concentración Pareto, tendencia lineal
 * (solo para dimensiones temporales), detección de outliers (z-score) y
 * recomendaciones por métrica.
 */
import { DIMENSION_LABEL, METRIC_LABEL, type Dimension, type Metric, type ReportSpec } from '../report-spec';

export interface Insight {
  type: 'total' | 'avg' | 'top' | 'bottom' | 'pareto' | 'trend' | 'outlier' | 'recommendation';
  text: string;
}

const TIME_DIMS: Dimension[] = ['dia', 'semana', 'mes'];
const fmt = (n: number, dec = 2) => n.toLocaleString('es-BO', { maximumFractionDigits: dec });

/** Regresión lineal simple: devuelve pendiente e intercepto */
function linearRegression(values: number[]): { slope: number; pct: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, pct: 0 };
  const xs = values.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((a, x, i) => a + (x - meanX) * (values[i] - meanY), 0);
  const den = xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const pct = meanY === 0 ? 0 : (slope * (n - 1)) / meanY * 100;
  return { slope, pct };
}

/** Detección de outliers por z-score (umbral ≥ 2) */
function findOutliers(values: number[], labels: string[]): { label: string; z: number }[] {
  const n = values.length;
  if (n < 4) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  if (std === 0) return [];
  return values
    .map((v, i) => ({ label: labels[i], z: (v - mean) / std }))
    .filter((o) => Math.abs(o.z) >= 2)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 3);
}

/** Variación porcentual entre primera y última fila (series temporales) */
function trendPct(values: number[]): number | null {
  const first = values[0], last = values[values.length - 1];
  if (values.length < 2 || first === 0) return null;
  return ((last - first) / first) * 100;
}

export function generateInsights(
  spec: ReportSpec,
  rows: { label: string; value: number }[],
): Insight[] {
  if (!rows.length) return [{ type: 'total', text: `No hay datos disponibles para esta consulta.` }];

  const metric = METRIC_LABEL[spec.metric];
  const dim = DIMENSION_LABEL[spec.dimension];
  const values = rows.map((r) => r.value);
  const labels = rows.map((r) => r.label);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const isTime = TIME_DIMS.includes(spec.dimension);
  const isCurrency = ['ventas_total', 'ticket_promedio'].includes(spec.metric);
  const unit = isCurrency ? 'Bs.' : '';

  const insights: Insight[] = [];

  // --- TOTAL / KPI ---
  if (spec.dimension === 'ninguna') {
    insights.push({ type: 'total', text: `${metric}: ${fmt(total)} ${unit}`.trim() });
    return insights;
  }

  insights.push({ type: 'total', text: `${metric} total (${rows.length} ${dim.toLowerCase()}): ${fmt(total)} ${unit}`.trim() });

  // --- PROMEDIO ---
  if (spec.metric !== 'ticket_promedio') {
    insights.push({ type: 'avg', text: `Promedio por ${dim.toLowerCase()}: ${fmt(avg)} ${unit}`.trim() });
  }

  // --- TOP / BOTTOM ---
  insights.push({ type: 'top', text: `Mayor: "${top.label}" con ${fmt(top.value)} ${unit}`.trim() });
  if (rows.length > 1) {
    insights.push({ type: 'bottom', text: `Menor: "${bottom.label}" con ${fmt(bottom.value)} ${unit}`.trim() });
  }

  // --- PARETO / CONCENTRACIÓN ---
  if (!isTime && rows.length >= 3) {
    const top3Sum = sorted.slice(0, 3).reduce((a, r) => a + r.value, 0);
    const shareTop3 = total > 0 ? (top3Sum / total) * 100 : 0;
    if (shareTop3 >= 60) {
      insights.push({
        type: 'pareto',
        text: `Concentración: los 3 principales (${sorted.slice(0, 3).map((r) => `"${r.label}"`).join(', ')}) representan el ${shareTop3.toFixed(1)}% del total.`,
      });
    }
    // Pareto clásico 80%
    let cumSum = 0, pareto80Count = 0;
    for (const r of sorted) {
      cumSum += r.value; pareto80Count++;
      if (total > 0 && cumSum / total >= 0.8) break;
    }
    if (pareto80Count <= Math.ceil(rows.length * 0.3) && pareto80Count >= 1) {
      insights.push({
        type: 'pareto',
        text: `Regla 80/20: solo ${pareto80Count} de ${rows.length} ${dim.toLowerCase()}(s) generan el 80% del total.`,
      });
    }
  }

  // --- TENDENCIA (series temporales) ---
  if (isTime && values.length >= 3) {
    const { pct } = linearRegression(values);
    const changePct = trendPct(values);
    const dir = pct >= 1 ? 'creciente' : pct <= -1 ? 'decreciente' : 'estable';
    insights.push({
      type: 'trend',
      text: `Tendencia ${dir} en el período (regresión lineal: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%${changePct !== null ? `; cambio inicio→fin: ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : ''}).`,
    });
  }

  // --- OUTLIERS ---
  const outliers = findOutliers(values, labels);
  for (const o of outliers) {
    insights.push({
      type: 'outlier',
      text: `Valor atípico: "${o.label}" (z=${o.z >= 0 ? '+' : ''}${o.z.toFixed(1)}) — ${Math.abs(o.z) > 0 ? (o.z > 0 ? 'muy por encima' : 'muy por debajo') : 'cerca'} del promedio.`,
    });
  }

  // --- RECOMENDACIONES POR MÉTRICA ---
  const recs = getRecommendations(spec.metric, top, bottom, total, rows.length, isTime);
  for (const rec of recs) insights.push({ type: 'recommendation', text: rec });

  return insights;
}

function getRecommendations(
  metric: Metric,
  top: { label: string; value: number },
  bottom: { label: string; value: number },
  total: number,
  count: number,
  isTime: boolean,
): string[] {
  const recs: string[] = [];
  switch (metric) {
    case 'ventas_total':
      if (!isTime && count > 1) {
        const shareTop = total > 0 ? (top.value / total) * 100 : 0;
        if (shareTop > 50) recs.push(`"${top.label}" concentra más del 50% de las ventas; considere diversificar o proteger esa fuente de ingresos.`);
        if (bottom.value < top.value * 0.1) recs.push(`"${bottom.label}" tiene muy pocas ventas; evalúe su posición en el catálogo.`);
      }
      break;
    case 'unidades_vendidas':
      if (count > 1 && !isTime) recs.push(`Revise la disponibilidad de "${top.label}" para evitar desabastecimiento.`);
      break;
    case 'stock_disponible':
      recs.push('Compare el stock disponible con la velocidad de ventas para optimizar la reposición.');
      break;
    case 'productos_stock_bajo':
      if (top.value > 0) recs.push(`Priorice la reposición en "${top.label}" que concentra la mayor cantidad de variantes con stock crítico.`);
      break;
    case 'ticket_promedio':
      if (count > 1) recs.push(`Implemente estrategias de upselling en "${bottom.label}" para elevar el ticket promedio.`);
      break;
    case 'reservas':
      recs.push('Analice la tasa de conversión de reservas a ventas para detectar fricciones en el proceso.');
      break;
    case 'clientes_nuevos':
      if (isTime) recs.push('Cruce los picos de captación con sus campañas de marketing para identificar las más efectivas.');
      break;
  }
  return recs;
}
