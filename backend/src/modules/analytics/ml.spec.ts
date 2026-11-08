import { fitLinearRegression, forecastDemand, kmeans, labelRfmClusters, silhouette, standardize } from './ml';

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

  it('nombra como Campeones al cluster más reciente, frecuente y de mayor gasto', () => {
    const names = labelRfmClusters([
      { recencyDays: 200, frequency: 1, monetary: 50 },
      { recencyDays: 5, frequency: 10, monetary: 2000 },
    ]);
    expect(names[1]).toBe('Campeones');
  });
});
