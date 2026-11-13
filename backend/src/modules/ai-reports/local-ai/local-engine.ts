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
    // Tolerancia a errores de tipeo: 1 letra (2 solo en palabras largas). Con 2 letras "vendidos" se confundía con "Vestidos".
    const tol = cn.length >= 9 ? 2 : 1;
    if (cn.length >= 5 && q.split(/\s+/).some((w) => w.length >= 5 && Math.abs(w.length - cn.length) <= 1 && levenshtein(w, cn) <= tol)) return c;
  }
  return null;
}

/** Palabras que nombran una agrupación en la pregunta (el texto ya viene sin acentos y en minúsculas). */
const DIM_WORDS: [Dimension, RegExp][] = [
  ['sucursal', /\bsucursal(?:es)?\b|\btiendas?\b/g],
  ['canal', /\bcanal(?:es)?\b/g],
  ['metodo_pago', /\bmetodos? de pago\b|\bformas? de pago\b|\bmedios? de pago\b/g],
  ['categoria', /\bcategori(?:a|as)\b|\btipos? de (?:ropa|prendas?)\b/g],
  ['producto', /\bproductos?\b|\bprendas?\b|\barticulos?\b/g],
  ['talla', /\btallas?\b/g],
  ['color', /\bcolor(?:es)?\b/g],
  ['temporada', /\btemporadas?\b/g],
  ['cliente', /\bpor clientes?\b|\bcada cliente\b/g],
  ['estado', /\bestados?\b/g],
  ['dia', /\bpor dias?\b|\bdiari[oa]s?\b|\bcada dia\b|\bdia a dia\b/g],
  ['semana', /\bpor semanas?\b|\bsemanal(?:es)?\b|\bcada semana\b/g],
  ['mes', /\bpor mes(?:es)?\b|\bmensual(?:es)?\b|\bcada mes\b/g],
];

/** "en el canal web", "del canal pos", "solo la sucursal X": ahí la palabra filtra, no agrupa. */
const FILTER_PREFIX = /\b(?:en|del|de|con|solo|solamente|unicamente|para|al)\s+(?:el|la|los|las)?\s*$/;

/**
 * Detecta una segunda agrupación ("ventas por sucursal y por canal", "categorizado por", "desglosado por"):
 * devuelve [principal, secundaria] en el orden en que aparecen, o null si solo hay una agrupación.
 */
export function detectDimensionMentions(q: string): Dimension[] {
  const found: { dim: Dimension; idx: number }[] = [];
  for (const [dim, re] of DIM_WORDS) {
    for (const m of q.matchAll(re)) {
      const idx = m.index ?? 0;
      // Solo el singular tras "en el / del / de la" filtra ("en el canal web"); el plural agrupa ("de las sucursales")
      const singular = !/s\b/.test(m[0].trim()) || /^por /.test(m[0]);
      if (singular && FILTER_PREFIX.test(q.slice(Math.max(0, idx - 14), idx))) continue;
      found.push({ dim, idx });
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  const ordered: Dimension[] = [];
  for (const f of found) if (!ordered.includes(f.dim)) ordered.push(f.dim);
  // Dos agrupaciones de tiempo no se cruzan: se queda con la primera de cada tipo
  const time = ['dia', 'semana', 'mes'];
  const picked: Dimension[] = [];
  for (const d of ordered) {
    if (time.includes(d) && picked.some((x) => time.includes(x))) continue;
    picked.push(d);
  }
  return picked;
}

/** Las dos primeras agrupaciones mencionadas (sin validar contra la métrica). */
export function detectCrossDimensions(q: string): [Dimension, Dimension] | null {
  const m = detectDimensionMentions(q);
  return m.length >= 2 ? [m[0], m[1]] : null;
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

  const classes = getClassifier().classify(corrected);

  // ── 1) MÉTRICA: probabilidad marginal de Naive Bayes + reglas de palabras clave
  const metricScore = new Map<Metric, number>(METRICS.map((m) => [m, 0]));
  for (const r of classes) metricScore.set(r.label.metric, (metricScore.get(r.label.metric) ?? 0) + r.prob);
  let metricRuleHit = false;
  for (const rule of RULE_BOOSTS) {
    if (rule.dimension === 'ninguna' && rule.re.test(q)) {
      metricScore.set(rule.metric, (metricScore.get(rule.metric) ?? 0) + rule.boost);
      metricRuleHit = true;
    }
  }
  // "ventas", "vendimos", "ingresos"… sin otra pista de métrica: monto vendido
  if (!metricRuleHit && /\b(ventas?|vendimos|vendi|vendio|ingresos?|facturacion|monto|recaudado)\b/.test(q)) {
    metricScore.set('ventas_total', (metricScore.get('ventas_total') ?? 0) + 0.4);
  }
  const metricTotal = [...metricScore.values()].reduce((a, b) => a + b, 0) || 1;
  const bestMetric = [...metricScore.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const confidence = Math.min((metricScore.get(bestMetric) ?? 0) / metricTotal, 1);
  const validDims = VALID_DIMS[bestMetric];

  // ── 2) FILTROS (fechas, sucursal, categoría) para no confundirlos con agrupaciones
  const filters: any = { ...parseDateRange(q, ctx.now) };
  const branchNames = ctx.branches.map((b) => b.name);
  const matchedBranch = fuzzyMatch(q, branchNames);
  if (matchedBranch) {
    const branch = ctx.branches.find((b) => normalize(b.name) === normalize(matchedBranch));
    if (branch) filters.branchId = branch.id;
  }
  const matchedCat = fuzzyMatch(q, ctx.categories);
  if (matchedCat) filters.category = matchedCat;

  // ── 3) AGRUPACIONES: lo que la frase nombra ("por sucursal y por canal"); si no nombra ninguna, Naive Bayes + reglas
  let qDims = q;
  for (const name of [matchedBranch, matchedCat]) if (name) qDims = qDims.split(normalize(name)).join(' ');
  const mentioned = detectDimensionMentions(qDims).filter((d) => validDims.includes(d));

  let dimension: Dimension;
  let dimension2: Dimension | undefined;
  if (mentioned.length) {
    dimension = mentioned[0];
    dimension2 = mentioned[1];
  } else {
    const dimScore = new Map<Dimension, number>();
    for (const r of classes) if (r.label.metric === bestMetric) dimScore.set(r.label.dimension, (dimScore.get(r.label.dimension) ?? 0) + r.prob);
    for (const rule of RULE_BOOSTS) {
      if (rule.dimension !== 'ninguna' && rule.re.test(q)) dimScore.set(rule.dimension, (dimScore.get(rule.dimension) ?? 0) + rule.boost);
    }
    const ranked = [...dimScore.entries()].filter(([d]) => validDims.includes(d)).sort((a, b) => b[1] - a[1]);
    dimension = ranked.length ? ranked[0][0] : 'ninguna';
    // Un solo día ("hoy", "ayer"): un total, no una serie
    if (/\b(hoy|ayer)\b/.test(q)) dimension = 'ninguna';
  }

  // Si ya se filtra por una sucursal concreta, no se agrupa por sucursal
  if (filters.branchId) {
    if (dimension2 === 'sucursal') dimension2 = undefined;
    if (dimension === 'sucursal') { dimension = dimension2 ?? 'ninguna'; dimension2 = undefined; }
  }

  // Canal explícito como filtro (solo si no se agrupa por canal)
  const groupsByChannel = dimension === 'canal' || dimension2 === 'canal';
  if (!groupsByChannel) {
    if (/\bweb\b/.test(q)) filters.channel = 'WEB';
    else if (/\b(movil|app)\b/.test(q)) filters.channel = 'MOVIL';
    else if (/\b(pos|tienda fisica|caja)\b/.test(q)) filters.channel = 'POS';
  }

  // El stock no usa fechas ni canal
  if (bestMetric === 'stock_disponible' || bestMetric === 'productos_stock_bajo') {
    delete filters.dateFrom; delete filters.dateTo; delete filters.channel;
  }

  const sort: 'asc' | 'desc' = /menos|peor|menor/.test(q) ? 'asc' : 'desc';
  const limit = extractLimit(q);

  const base = { title: question.trim().slice(0, 120), metric: bestMetric, filters, sort, limit };
  let spec: ReportSpec;
  try {
    spec = validateSpec({ ...base, dimension, dimension2 });
  } catch {
    // La combinación no es válida: se intenta con una sola agrupación y, en último caso, sin agrupar
    try { spec = validateSpec({ ...base, dimension }); } catch { spec = validateSpec({ ...base, dimension: 'ninguna' }); }
  }

  const explanation = `NB+Reglas: métrica=${bestMetric}, dim=${spec.dimension}${spec.dimension2 ? `×${spec.dimension2}` : ''}, confianza=${(confidence * 100).toFixed(1)}%`;
  return { spec, confidence, explanation, engine: 'IA_LOCAL' };
}
