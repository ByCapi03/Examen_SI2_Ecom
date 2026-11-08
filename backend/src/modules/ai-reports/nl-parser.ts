/**
 * INTÉRPRETE DE LENGUAJE NATURAL POR REGLAS (respaldo sin LLM)
 * Convierte preguntas en español a un ReportSpec. Se usa cuando no hay API
 * de IA configurada o cuando la respuesta del modelo no supera la validación.
 */
import { Dimension, Metric, ReportSpec, validateSpec } from './report-spec';

export interface ParserContext {
  now: Date;
  branches: { id: number; name: string }[];
  categories: string[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NUMBER_WORDS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20 };

export function parseDateRange(q: string, now: Date): { dateFrom?: string; dateTo?: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  if (/\bhoy\b/.test(q)) return { dateFrom: iso(today), dateTo: iso(today) };
  if (/\bayer\b/.test(q)) { const y = addDays(today, -1); return { dateFrom: iso(y), dateTo: iso(y) }; }
  const lastN = q.match(/ultim[oa]s?\s+(\d+|\w+)\s+(dias|semanas|meses)/);
  if (lastN) {
    const n = Number(lastN[1]) || NUMBER_WORDS[lastN[1]] || 7;
    const unit = lastN[2];
    const from = unit === 'dias' ? addDays(today, -(n - 1)) : unit === 'semanas' ? addDays(today, -(7 * n - 1))
      : new Date(today.getFullYear(), today.getMonth() - n, today.getDate() + 1);
    return { dateFrom: iso(from), dateTo: iso(today) };
  }
  if (/(esta|la presente) semana/.test(q)) {
    const dow = (today.getDay() + 6) % 7; // lunes = 0
    return { dateFrom: iso(addDays(today, -dow)), dateTo: iso(today) };
  }
  if (/semana pasada/.test(q)) {
    const dow = (today.getDay() + 6) % 7;
    return { dateFrom: iso(addDays(today, -dow - 7)), dateTo: iso(addDays(today, -dow - 1)) };
  }
  if (/(mes pasado|mes anterior)/.test(q)) {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { dateFrom: iso(from), dateTo: iso(to) };
  }
  if (/(este|el presente|del) mes\b/.test(q)) {
    return { dateFrom: iso(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: iso(today) };
  }
  if (/(este|el presente) ano|en lo que va del ano/.test(q)) {
    return { dateFrom: iso(new Date(today.getFullYear(), 0, 1)), dateTo: iso(today) };
  }
  if (/ano pasado/.test(q)) {
    return { dateFrom: `${today.getFullYear() - 1}-01-01`, dateTo: `${today.getFullYear() - 1}-12-31` };
  }
  for (let m = 0; m < 12; m++) {
    if (new RegExp(`\\b${MONTHS[m]}\\b`).test(q)) {
      const yearMatch = q.match(/\b(20\d{2})\b/);
      let year = yearMatch ? Number(yearMatch[1]) : today.getFullYear();
      if (!yearMatch && m > today.getMonth()) year -= 1;
      return { dateFrom: iso(new Date(year, m, 1)), dateTo: iso(new Date(year, m + 1, 0)) };
    }
  }
  return {};
}

function detectMetric(q: string): Metric {
  if (/stock bajo|bajo stock|por agotarse|reponer|reposicion|agotad/.test(q)) return 'productos_stock_bajo';
  if (/stock|inventario|existencia/.test(q)) return 'stock_disponible';
  if (/reserva/.test(q)) return 'reservas';
  if (/clientes? nuevos?|nuevos clientes|registr/.test(q)) return 'clientes_nuevos';
  if (/ticket promedio|promedio por venta|venta promedio/.test(q)) return 'ticket_promedio';
  if (/unidades|prendas vendidas|cuant[oa]s? (prendas|productos|unidades)|mas vendid|menos vendid/.test(q)) return 'unidades_vendidas';
  if (/(numero|cantidad|cuantas) (de )?ventas|transacciones/.test(q)) return 'cantidad_ventas';
  return 'ventas_total';
}

function detectDimension(q: string, metric: Metric): Dimension {
  const rules: [RegExp, Dimension][] = [
    [/metodo de pago|forma de pago|medio de pago|efectivo|tarjeta|qr\b/, 'metodo_pago'],
    [/por categoria|categorias|que categoria/, 'categoria'],
    [/por talla|tallas|que talla/, 'talla'],
    [/por color|colores|que color/, 'color'],
    [/temporada/, 'temporada'],
    [/por sucursal|sucursales|cada sucursal|que sucursal|tiendas/, 'sucursal'],
    [/por canal|canales|web o pos|pos o web/, 'canal'],
    [/por cliente|mejores clientes|clientes que mas|top clientes/, 'cliente'],
    [/por estado|estados/, 'estado'],
    [/por dia|diari|cada dia|dia a dia|evolucion|tendencia/, 'dia'],
    [/por semana|semanal/, 'semana'],
    [/por mes|mensual|cada mes/, 'mes'],
    [/producto|prenda|articulo|mas vendid|menos vendid|vestido|camisa|pantalon|blusa|chaqueta|polera|falda/, 'producto'],
  ];
  for (const [re, dim] of rules) if (re.test(q)) {
    if (dim === 'metodo_pago' && !['ventas_total', 'cantidad_ventas'].includes(metric)) continue;
    return dim;
  }
  return 'ninguna';
}

export function parseQuestion(question: string, ctx: ParserContext): ReportSpec {
  const q = norm(question);
  const metric = detectMetric(q);
  let dimension = detectDimension(q, metric);
  const filters: any = { ...parseDateRange(q, ctx.now) };

  for (const b of ctx.branches) {
    const bn = norm(b.name);
    const short = bn.replace(/^sucursal\s+/, '');
    if (q.includes(bn) || (short.length >= 4 && new RegExp(`\\b${short.replace(/[.*+?^${}()|[\]\\]/g, '')}\\b`).test(q))) {
      filters.branchId = b.id;
      if (dimension === 'sucursal') dimension = 'ninguna';
      break;
    }
  }
  for (const c of ctx.categories) {
    const cn = norm(c);
    const singular = cn.replace(/(es|s)$/, '');
    if (cn.length >= 3 && (q.includes(cn) || (singular.length >= 4 && q.includes(singular)))) {
      filters.category = c;
      break;
    }
  }
  if (/\bweb\b/.test(q) && dimension !== 'canal') filters.channel = 'WEB';
  else if (/\b(movil|app)\b/.test(q) && dimension !== 'canal') filters.channel = 'MOVIL';
  else if (/\b(pos|tienda fisica|caja)\b/.test(q) && dimension !== 'canal') filters.channel = 'POS';

  const topMatch = q.match(/\b(?:top|los|las|primer[oa]s)\s+(\d+|\w+)\b/);
  let limit = 10;
  if (topMatch) limit = Number(topMatch[1]) || NUMBER_WORDS[topMatch[1]] || 10;
  const sort = /menos|peor|menor/.test(q) ? 'asc' : 'desc';

  // Si la consulta es de stock no aplican filtros de fecha ni canal
  if (metric === 'stock_disponible' || metric === 'productos_stock_bajo') {
    delete filters.dateFrom; delete filters.dateTo; delete filters.channel;
    if (['dia', 'semana', 'mes', 'canal', 'cliente', 'temporada', 'estado', 'metodo_pago'].includes(dimension)) dimension = 'producto';
  }
  if (metric === 'reservas' && !['sucursal', 'dia', 'semana', 'mes', 'estado', 'ninguna'].includes(dimension)) dimension = 'estado';
  if (metric === 'clientes_nuevos' && !['dia', 'semana', 'mes', 'ninguna'].includes(dimension)) dimension = 'mes';

  return validateSpec({ title: question.trim().slice(0, 120), metric, dimension, filters, sort, limit });
}
