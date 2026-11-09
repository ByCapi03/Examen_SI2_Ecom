/**
 * Motor de interpretación local.
 * Combina Naive Bayes + reglas + extracción de entidades fuzzy + fechas.
 */
import { DIMENSIONS, METRICS, ReportSpec, validateSpec, type Dimension, type Metric } from '../report-spec';
import { parseDateRange, ParserContext } from '../nl-parser';
import { getClassifier } from './naive-bayes';
import { normalize, levenshtein, correctTypos } from './text';

export interface LocalInterpretation {
  spec: ReportSpec;
  confidence: number;   // 0–1
  explanation: string;  // para debug / UI
  engine: 'IA_LOCAL';
}

/** Reglas de refuerzo: si coincide, suma boostScore a la clase (métrica, dimensión) */
const RULE_BOOSTS: { re: RegExp; metric: Metric; dimension: Dimension; boost: number }[] = [
  { re: /stock bajo|bajo stock|por agotarse|reponer|reposicion|agotad/, metric: 'productos_stock_bajo', dimension: 'ninguna', boost: 0.6 },
  { re: /stock|inventario|existencia/, metric: 'stock_disponible', dimension: 'ninguna', boost: 0.4 },
  { re: /reserva/, metric: 'reservas', dimension: 'ninguna', boost: 0.5 },
  { re: /clientes? nuevos?|nuevos clientes|registr/, metric: 'clientes_nuevos', dimension: 'ninguna', boost: 0.5 },
  { re: /ticket promedio|promedio por venta|venta promedio|monto medi/, metric: 'ticket_promedio', dimension: 'ninguna', boost: 0.6 },
  { re: /unidades|prendas? vendidas?|cuant[oa]s? prendas?|mas vendid|menos vendid/, metric: 'unidades_vendidas', dimension: 'ninguna', boost: 0.5 },
  { re: /(numero|cantidad|cuantas?) (de )?ventas?|transacciones?/, metric: 'cantidad_ventas', dimension: 'ninguna', boost: 0.5 },
  // Dimensión boosts
  { re: /por sucursal|cada sucursal|en cada tienda|ranking.*sucursal|sucursales/, metric: 'ventas_total', dimension: 'sucursal', boost: 0.4 },
  { re: /por categoria|por tipo de ropa|por rubro/, metric: 'ventas_total', dimension: 'categoria', boost: 0.4 },
  { re: /metodo de pago|forma de pago|medio de pago|efectivo vs|tarjeta vs|qr\b/, metric: 'ventas_total', dimension: 'metodo_pago', boost: 0.5 },
  { re: /por talla|por tallas/, metric: 'ventas_total', dimension: 'talla', boost: 0.4 },
  { re: /por color|colores/, metric: 'ventas_total', dimension: 'color', boost: 0.4 },
  { re: /por producto|por articulo|por prenda|top \d+ productos?|mas vendid/, metric: 'unidades_vendidas', dimension: 'producto', boost: 0.4 },
  { re: /por dia|diari|dia a dia|evolucion|tendencia.*dia/, metric: 'ventas_total', dimension: 'dia', boost: 0.4 },
  { re: /por semana|semanal/, metric: 'ventas_total', dimension: 'semana', boost: 0.4 },
  { re: /por mes|mensual/, metric: 'ventas_total', dimension: 'mes', boost: 0.4 },
  { re: /por canal|web.*pos|pos.*web|internet.*tienda/, metric: 'ventas_total', dimension: 'canal', boost: 0.5 },
  { re: /por cliente|mejores clientes|top clientes?|clientes que mas/, metric: 'ventas_total', dimension: 'cliente', boost: 0.4 },
  { re: /estado.*reserva|reserva.*estado|confirmada|cancelada|pendiente/, metric: 'reservas', dimension: 'estado', boost: 0.5 },
  { re: /clientes nuevos.*mes|captacion mensual|registro.*mensual/, metric: 'clientes_nuevos', dimension: 'mes', boost: 0.3 },
];

/** Dimensiones válidas por métrica (para elegir la mejor dimensión coherente) */
const VALID_DIMS: Record<Metric, Dimension[]> = {
  ventas_total: ['producto', 'categoria', 'sucursal', 'dia', 'semana', 'mes', 'canal', 'cliente', 'talla', 'color', 'temporada', 'metodo_pago', 'ninguna'],
  cantidad_ventas: ['sucursal', 'dia', 'semana', 'mes', 'canal', 'cliente', 'metodo_pago', 'ninguna'],
  unidades_vendidas: ['producto', 'categoria', 'sucursal', 'dia', 'semana', 'mes', 'canal', 'talla', 'color', 'ninguna'],
  ticket_promedio: ['sucursal', 'dia', 'semana', 'mes', 'canal', 'ninguna'],
  stock_disponible: ['producto', 'categoria', 'sucursal', 'talla', 'color', 'ninguna'],
  productos_stock_bajo: ['sucursal', 'ninguna'],
  reservas: ['sucursal', 'dia', 'semana', 'mes', 'estado', 'ninguna'],
  clientes_nuevos: ['dia', 'semana', 'mes', 'ninguna'],
};

/** Extrae entidad (sucursal o categoría) con tolerancia a errores tipográficos */
function fuzzyMatch(query: string, candidates: string[]): string | null {
  const q = normalize(query);
  for (const c of candidates) {
    const cn = normalize(c);
    if (q.includes(cn)) return c;
    if (cn.length >= 4 && q.includes(cn.slice(0, cn.length - 1))) return c;
    if (cn.length >= 5 && levenshtein(q.split(/\s+/).find((w) => levenshtein(w, cn) <= 2) ?? '', cn) <= 2) return c;
  }
  return null;
}

/** Extrae número de "top N" de la pregunta */
function extractLimit(q: string): number {
  const m = q.match(/\b(?:top|los|las|primer[oa]s)\s+(\d+)\b/i);
  if (m) return Math.min(Number(m[1]), 50);
  const words: Record<string, number> = { cinco: 5, diez: 10, tres: 3, veinte: 20, quince: 15 };
  const m2 = q.match(/\b(cinco|diez|tres|veinte|quince)\b/i);
  return m2 ? words[m2[1].toLowerCase()] : 10;
}

export function interpretLocal(question: string, ctx: ParserContext): LocalInterpretation {
  const corrected = correctTypos(question);
  const q = normalize(corrected);

  const classifier = getClassifier();
  const results = classifier.classify(corrected);

  // Mapa de log-odds para aplicar boosts
  const scoreMap = new Map<string, number>();
  for (const r of results) scoreMap.set(`${r.label.metric}::${r.label.dimension}`, r.prob);

  // Aplicar boosts de reglas
  for (const rule of RULE_BOOSTS) {
    if (rule.re.test(q)) {
      const key = `${rule.metric}::${rule.dimension}`;
      scoreMap.set(key, (scoreMap.get(key) ?? 0) + rule.boost);
    }
  }

  // Renormalizar
  const total = Array.from(scoreMap.values()).reduce((a, b) => a + b, 0);
  for (const [k, v] of scoreMap) scoreMap.set(k, v / total);

  // Mejor clase global
  let bestKey = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let [bestMetric, bestDim] = bestKey.split('::') as [Metric, Dimension];

  // Si la dimensión no es válida para la métrica elegida, buscar la mejor dimensión válida
  if (!VALID_DIMS[bestMetric].includes(bestDim)) {
    const validEntries = [...scoreMap.entries()]
      .filter(([k]) => {
        const [m, d] = k.split('::') as [Metric, Dimension];
        return m === bestMetric && VALID_DIMS[bestMetric].includes(d);
      })
      .sort((a, b) => b[1] - a[1]);
    if (validEntries.length) [bestKey] = validEntries[0];
    else bestKey = `${bestMetric}::ninguna`;
    [bestMetric, bestDim] = bestKey.split('::') as [Metric, Dimension];
  }

  const confidence = Math.min(scoreMap.get(bestKey) ?? 0, 1);

  // Construir filtros
  const filters: any = { ...parseDateRange(q, ctx.now) };

  // Extracción fuzzy de sucursal
  const branchNames = ctx.branches.map((b) => b.name);
  const matchedBranch = fuzzyMatch(q, branchNames);
  if (matchedBranch) {
    const branch = ctx.branches.find((b) => normalize(b.name) === normalize(matchedBranch));
    if (branch) {
      filters.branchId = branch.id;
      if (bestDim === 'sucursal') bestDim = 'ninguna';
    }
  }

  // Extracción fuzzy de categoría
  const matchedCat = fuzzyMatch(q, ctx.categories);
  if (matchedCat) filters.category = matchedCat;

  // Canal explícito
  if (/\bweb\b/.test(q) && bestDim !== 'canal') filters.channel = 'WEB';
  else if (/\b(movil|app)\b/.test(q) && bestDim !== 'canal') filters.channel = 'MOVIL';
  else if (/\b(pos|tienda fisica|caja)\b/.test(q) && bestDim !== 'canal') filters.channel = 'POS';

  // Stock no usa fechas ni canal
  if (bestMetric === 'stock_disponible' || bestMetric === 'productos_stock_bajo') {
    delete filters.dateFrom; delete filters.dateTo; delete filters.channel;
  }

  const sort: 'asc' | 'desc' = /menos|peor|menor/.test(q) ? 'asc' : 'desc';
  const limit = extractLimit(q);

  const spec = validateSpec({ title: question.trim().slice(0, 120), metric: bestMetric, dimension: bestDim, filters, sort, limit });

  const explanation = `NB+Reglas: métrica=${bestMetric}, dim=${bestDim}, confianza=${(confidence * 100).toFixed(1)}%`;
  return { spec, confidence, explanation, engine: 'IA_LOCAL' };
}
