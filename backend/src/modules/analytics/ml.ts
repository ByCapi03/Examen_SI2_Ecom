/**
 * ALGORITMOS DE MACHINE LEARNING (sin dependencias externas, deterministas)
 *
 *  - Aprendizaje SUPERVISADO: regresión lineal por mínimos cuadrados (OLS)
 *    sobre la serie semanal de unidades vendidas → pronóstico de demanda.
 *  - Aprendizaje NO SUPERVISADO: K-Means con inicialización k-means++ sobre
 *    variables RFM estandarizadas → segmentación de clientes.
 */

// ----------------------------------------------------------------- Regresión
export interface LinearModel { intercept: number; slope: number; r2: number; residualStd: number }

export function fitLinearRegression(y: number[]): LinearModel {
  const n = y.length;
  if (n === 0) return { intercept: 0, slope: 0, r2: 0, residualStd: 0 };
  if (n === 1) return { intercept: y[0], slope: 0, r2: 0, residualStd: 0 };
  const xs = y.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - meanX) * (y[i] - meanY); sxx += (xs[i] - meanX) ** 2; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const residualStd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  return { intercept, slope, r2, residualStd };
}

export function predict(model: LinearModel, fromIndex: number, horizon: number): number[] {
  return Array.from({ length: horizon }, (_, h) => Math.max(0, model.intercept + model.slope * (fromIndex + h)));
}

/** Error absoluto medio en validación "holdout" (últimos `test` puntos). */
export function holdoutMae(y: number[], test = 2): number | null {
  if (y.length < test + 3) return null;
  const train = y.slice(0, y.length - test);
  const model = fitLinearRegression(train);
  const preds = predict(model, train.length, test);
  const actual = y.slice(y.length - test);
  return preds.reduce((a, p, i) => a + Math.abs(p - actual[i]), 0) / test;
}

export type Confidence = 'ALTA' | 'MEDIA' | 'BAJA';

export interface DemandForecast {
  history: number[];
  forecast: number[];
  forecastTotal: number;
  trend: 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';
  model: LinearModel;
  mae: number | null;
  safetyStock: number;
  /** Variación semanal de las ventas respecto al promedio (pendiente / promedio). */
  weeklyChangePct: number;
  /** Qué tan confiable es el pronóstico, según cuánto se alejan las ventas reales de la recta. */
  confidence: Confidence;
}

/**
 * Confianza del pronóstico: error típico del modelo sobre el promedio de ventas (coeficiente de variación del residuo).
 * Con pocas semanas con ventas no se puede confiar en una recta, sin importar cuánto ajuste.
 */
export function forecastConfidence(weekly: number[], model: LinearModel): Confidence {
  const n = weekly.length;
  const active = weekly.filter((v) => v > 0).length;
  const mean = n ? weekly.reduce((a, b) => a + b, 0) / n : 0;
  if (n < 6 || active < 4 || mean <= 0) return 'BAJA';
  const cv = model.residualStd / mean;
  return cv <= 0.2 ? 'ALTA' : cv <= 0.4 ? 'MEDIA' : 'BAJA';
}

/** Días que dura el stock disponible al ritmo de ventas pronosticado (null si no se espera demanda). */
export function daysOfStock(available: number, forecastTotal: number, horizonWeeks: number): number | null {
  const perDay = forecastTotal / (horizonWeeks * 7);
  if (!(perDay > 0)) return null;
  return Number((Math.max(0, available) / perDay).toFixed(1));
}

export function forecastDemand(weekly: number[], horizon = 4, serviceZ = 1.65): DemandForecast {
  const model = fitLinearRegression(weekly);
  const forecast = predict(model, weekly.length, horizon).map((v) => Number(v.toFixed(2)));
  const forecastTotal = Number(forecast.reduce((a, b) => a + b, 0).toFixed(2));
  const mean = weekly.length ? weekly.reduce((a, b) => a + b, 0) / weekly.length : 0;
  const relSlope = mean > 0 ? model.slope / mean : model.slope;
  // Hay tendencia si las ventas cambian más de 3 % por semana Y la recta explica al menos el 25 % de la variación;
  // si no, el cambio es ruido y se considera estable.
  const trend = model.r2 >= 0.25 && relSlope > 0.03 ? 'CRECIENTE' : model.r2 >= 0.25 && relSlope < -0.03 ? 'DECRECIENTE' : 'ESTABLE';
  const safetyStock = Math.ceil(serviceZ * model.residualStd * Math.sqrt(horizon));
  return {
    history: weekly, forecast, forecastTotal, trend, model, mae: holdoutMae(weekly), safetyStock,
    weeklyChangePct: Number((relSlope * 100).toFixed(1)),
    confidence: forecastConfidence(weekly, model),
  };
}

// ------------------------------------------------------------------ K-Means
/** PRNG determinista (mulberry32) para resultados reproducibles. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

export function standardize(rows: number[][]): { data: number[][]; mean: number[]; std: number[] } {
  if (!rows.length) return { data: [], mean: [], std: [] };
  const d = rows[0].length;
  const mean = Array.from({ length: d }, (_, j) => rows.reduce((a, r) => a + r[j], 0) / rows.length);
  const std = Array.from({ length: d }, (_, j) => {
    const v = rows.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / rows.length;
    return Math.sqrt(v) || 1;
  });
  return { data: rows.map((r) => r.map((v, j) => (v - mean[j]) / std[j])), mean, std };
}

export interface KMeansResult { centroids: number[][]; labels: number[]; inertia: number; iterations: number }

export function kmeans(data: number[][], k: number, seed = 42, maxIter = 100): KMeansResult {
  const n = data.length;
  if (n === 0) return { centroids: [], labels: [], inertia: 0, iterations: 0 };
  k = Math.max(1, Math.min(k, n));
  const rand = seededRandom(seed);
  // Inicialización k-means++
  const centroids: number[][] = [data[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const d = data.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    if (sum === 0) { centroids.push(data[Math.floor(rand() * n)].slice()); continue; }
    let r = rand() * sum, idx = 0;
    while (idx < n - 1 && (r -= d[idx]) > 0) idx++;
    centroids.push(data[idx].slice());
  }
  let labels = new Array(n).fill(0);
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    const next = data.map((p) => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, j) => { const dd = dist2(p, c); if (dd < bestD) { bestD = dd; best = j; } });
      return best;
    });
    const changed = next.some((l, i) => l !== labels[i]);
    labels = next;
    for (let j = 0; j < k; j++) {
      const members = data.filter((_, i) => labels[i] === j);
      if (members.length) centroids[j] = members[0].map((_, dIdx) => members.reduce((a, m) => a + m[dIdx], 0) / members.length);
    }
    if (!changed && iterations > 0) break;
  }
  const inertia = data.reduce((a, p, i) => a + dist2(p, centroids[labels[i]]), 0);
  return { centroids, labels, inertia, iterations };
}

/** Coeficiente de silueta medio (calidad del agrupamiento, -1..1). */
export function silhouette(data: number[][], labels: number[]): number | null {
  const k = new Set(labels).size;
  if (k < 2 || data.length < 3) return null;
  const s = data.map((p, i) => {
    const byCluster = new Map<number, number[]>();
    data.forEach((q, j) => { if (i !== j) { const arr = byCluster.get(labels[j]) ?? []; arr.push(Math.sqrt(dist2(p, q))); byCluster.set(labels[j], arr); } });
    const own = byCluster.get(labels[i]);
    if (!own?.length) return 0;
    const a = own.reduce((x, y) => x + y, 0) / own.length;
    let b = Infinity;
    byCluster.forEach((arr, c) => { if (c !== labels[i]) b = Math.min(b, arr.reduce((x, y) => x + y, 0) / arr.length); });
    return b === Infinity ? 0 : (b - a) / Math.max(a, b);
  });
  return s.reduce((a, b) => a + b, 0) / s.length;
}

export interface RfmPoint { recencyDays: number; frequency: number; monetary: number }

/**
 * Asigna nombres de negocio a cada cluster comparando su centroide RFM con la
 * media de toda la población (reglas interpretables, no solo el ranking):
 *  - Perdidos / En riesgo de abandono: recencia muy superior a la media.
 *  - Nuevos: compraron hace poco y una sola vez.
 *  - Clusters activos restantes, por valor (frecuencia + gasto − recencia):
 *    Campeones → Clientes leales → Potenciales → Ocasionales de bajo valor.
 */
export function labelRfmClusters(centroids: RfmPoint[], population?: RfmPoint): string[] {
  const n = centroids.length || 1;
  const pop = population ?? {
    recencyDays: centroids.reduce((a, c) => a + c.recencyDays, 0) / n,
    frequency: centroids.reduce((a, c) => a + c.frequency, 0) / n,
    monetary: centroids.reduce((a, c) => a + c.monetary, 0) / n,
  };
  const value = (c: RfmPoint) => c.frequency / (pop.frequency || 1) + c.monetary / (pop.monetary || 1) - c.recencyDays / ((pop.recencyDays || 1) * 2);
  const names: string[] = new Array(centroids.length).fill('');
  const active: number[] = [];
  centroids.forEach((c, i) => {
    if (c.recencyDays > Math.max(pop.recencyDays * 2, 120)) names[i] = 'Perdidos';
    else if (c.recencyDays > Math.max(pop.recencyDays * 1.5, 45)) names[i] = 'En riesgo de abandono';
    else if (c.frequency <= 1.2 && c.recencyDays <= 30 && centroids.length > 2) names[i] = 'Nuevos';
    else active.push(i);
  });
  // Clusters activos: se nombran por valor relativo (mayor valor primero)
  const ranked = ['Campeones', 'Clientes leales', 'Potenciales', 'Ocasionales de bajo valor'];
  active.sort((x, y) => value(centroids[y]) - value(centroids[x]))
    .forEach((idx, rank) => { names[idx] = ranked[Math.min(rank, ranked.length - 1)]; });
  // Evitar nombres repetidos (p. ej. dos clusters "Potenciales")
  const seen = new Map<string, number>();
  return names.map((nm) => {
    const k = (seen.get(nm) ?? 0) + 1;
    seen.set(nm, k);
    return k > 1 ? `${nm} ${k}` : nm;
  });
}
