import { assignCluster, evaluateForecast, fitLinearRegression, forecastDemand, kmeans, labelRfmClusters, naiveMae, silhouette, standardize } from './ml';

describe('Regresión lineal (supervisado)', () => {
  it('recupera una tendencia lineal exacta', () => {
    const m = fitLinearRegression([2, 4, 6, 8, 10]);
    expect(m.slope).toBeCloseTo(2);
    expect(m.intercept).toBeCloseTo(2);
    expect(m.r2).toBeCloseTo(1);
  });

  it('pronostica demanda creciente y nunca negativa', () => {
    const f = forecastDemand([1, 2, 3, 4, 5, 6], 3);
    expect(f.trend).toBe('CRECIENTE');
    expect(f.forecast).toEqual([7, 8, 9]);
    const down = forecastDemand([10, 6, 2, 0], 4);
    expect(down.forecast.every((v) => v >= 0)).toBe(true);
    expect(down.trend).toBe('DECRECIENTE');
  });
});

describe('K-Means (no supervisado)', () => {
  const pts = [[0, 0], [0.1, 0.2], [0.2, 0.1], [10, 10], [10.1, 9.9], [9.8, 10.2]];

  it('separa dos grupos evidentes de forma determinista', () => {
    const r1 = kmeans(pts, 2, 7);
    const r2 = kmeans(pts, 2, 7);
    expect(r1.labels).toEqual(r2.labels);
    expect(new Set(r1.labels.slice(0, 3)).size).toBe(1);
    expect(new Set(r1.labels.slice(3)).size).toBe(1);
    expect(r1.labels[0]).not.toBe(r1.labels[3]);
    expect(silhouette(pts, r1.labels)!).toBeGreaterThan(0.9);
  });

  it('estandariza a media 0', () => {
    const { data } = standardize([[1, 10], [3, 30]]);
    expect(data[0][0] + data[1][0]).toBeCloseTo(0);
  });

  it('nombra los clusters según reglas RFM interpretables', () => {
    const names = labelRfmClusters([
      { recencyDays: 200, frequency: 1, monetary: 50 },   // inactivo hace mucho
      { recencyDays: 5, frequency: 10, monetary: 2000 },  // mejor cliente
      { recencyDays: 3, frequency: 1, monetary: 120 },    // compró una vez, reciente
    ], { recencyDays: 60, frequency: 4, monetary: 700 });
    expect(names).toEqual(['Perdidos', 'Campeones', 'Nuevos']);
  });

  it('no repite nombres de segmento', () => {
    const names = labelRfmClusters([
      { recencyDays: 10, frequency: 2, monetary: 300 },
      { recencyDays: 12, frequency: 2, monetary: 310 },
      { recencyDays: 1, frequency: 9, monetary: 3000 },
    ]);
    expect(names).toEqual(['Clientes leales', 'Potenciales', 'Campeones']);
  });
});

describe('Evaluación y persistencia de modelos', () => {
  const growing = Array.from({ length: 16 }, (_, i) => 10 + 3 * i);

  it('el baseline ingenuo falla en una tendencia creciente y el modelo lineal no', () => {
    const ev = evaluateForecast([growing]);
    expect(ev).not.toBeNull();
    expect(ev!.maeModel).toBeLessThan(ev!.maeNaive);
    expect(ev!.improvementPct).toBeGreaterThan(50);
  });

  it('series demasiado cortas no se evalúan', () => {
    expect(naiveMae([1, 2, 3], 2)).toBeNull();
    expect(evaluateForecast([[1, 2, 3]])).toBeNull();
  });

  it('un modelo K-Means guardado asigna nuevos puntos al centroide correcto', () => {
    // Dos grupos RFM claros: compradores recientes/frecuentes y clientes inactivos
    const raw = [
      [5, Math.log1p(20), Math.log1p(9000)], [8, Math.log1p(18), Math.log1p(8000)], [4, Math.log1p(22), Math.log1p(9500)],
      [300, Math.log1p(1), Math.log1p(100)], [280, Math.log1p(2), Math.log1p(150)], [320, Math.log1p(1), Math.log1p(90)],
    ];
    const { data, mean, std } = standardize(raw);
    const { centroids, labels } = kmeans(data, 2, 42);
    // Se guardan solo mean/std/centroids: una "reconstrucción" posterior debe dar las mismas etiquetas
    const again = raw.map((p) => assignCluster(p, mean, std, centroids));
    expect(again).toEqual(labels);
    const vip = assignCluster([6, Math.log1p(19), Math.log1p(8500)], mean, std, centroids);
    const lost = assignCluster([310, Math.log1p(1), Math.log1p(100)], mean, std, centroids);
    expect(vip).toBe(labels[0]);
    expect(lost).toBe(labels[3]);
    expect(vip).not.toBe(lost);
  });
});
