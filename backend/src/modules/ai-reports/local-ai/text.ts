/**
 * Utilidades de texto para la IA local.
 * Normalización, tokenización, stopwords, stemming ligero,
 * bigramas y corrección de errores tipográficos (Levenshtein).
 */

/** Elimina tildes y pasa a minúsculas */
export const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'un', 'una', 'unos', 'unas',
  'que', 'en', 'con', 'por', 'para', 'se', 'es', 'son', 'fue', 'han',
  'ha', 'al', 'lo', 'mi', 'su', 'sus', 'me', 'te', 'le', 'nos', 'les',
  'mas', 'pero', 'si', 'no', 'ya', 'yo', 'tu', 'el', 'era', 'este',
  'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'como', 'sobre', 'entre', 'hasta', 'desde', 'hacia', 'ante',
  'quiero', 'queres', 'quisiera', 'necesito', 'dame', 'muestra',
  'ver', 'mostrar', 'obtener', 'sacar', 'generar', 'hacer',
  'reporte', 'informe', 'reporte', 'analisis', 'detalle', 'resumen',
]);

/** Stemming ligero para español: quita sufijos comunes */
function stem(w: string): string {
  if (w.length <= 4) return w;
  for (const suf of ['ando', 'iendo', 'ados', 'idos', 'adas', 'idas', 'iones', 'cion', 'ados', 'amos', 'aron']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  for (const suf of ['es', 'os', 'as']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  if (w.endsWith('s') && w.length >= 4) return w.slice(0, -1);
  return w;
}

/** Tokeniza: separa en palabras, filtra stopwords y aplica stem */
export function tokenize(text: string): string[] {
  const words = normalize(text).split(/[^a-z0-9áéíóúñü]+/).filter((w) => w.length >= 2);
  return words.filter((w) => !STOPWORDS.has(w)).map(stem);
}

/** Genera bigramas de un array de tokens */
export function bigrams(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) result.push(`${tokens[i]}_${tokens[i + 1]}`);
  return result;
}

/** Features: tokens + bigramas */
export function features(text: string): string[] {
  const toks = tokenize(text);
  return [...toks, ...bigrams(toks)];
}

/** Distancia de Levenshtein (máx. length 30 para rendimiento) */
export function levenshtein(a: string, b: string): number {
  if (a.length > 30 || b.length > 30) return 99;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
      : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  }
  return dp[m][n];
}

/** Diccionario de correcciones tipográficas comunes en preguntas de reportes */
const TYPO_MAP: Record<string, string> = {
  ventsa: 'ventas', venats: 'ventas', ventas: 'ventas',
  prodcuto: 'producto', pruducto: 'producto', rpoducto: 'producto',
  canidad: 'cantidad', cantiad: 'cantidad',
  invnetario: 'inventario', inventaro: 'inventario',
  sucursl: 'sucursal', sucurales: 'sucursales',
  categori: 'categoria', catoegria: 'categoria',
  mensaul: 'mensual', mesnsual: 'mensual',
  proveedor: 'proveedor', proveedro: 'proveedor',
  resreva: 'reserva', rserva: 'reserva',
  clente: 'cliente', clientes: 'clientes',
};

/** Corrige errores tipográficos en texto normalizado */
export function correctTypos(text: string): string {
  return normalize(text).replace(/\b(\w+)\b/g, (w) => TYPO_MAP[w] ?? w);
}
