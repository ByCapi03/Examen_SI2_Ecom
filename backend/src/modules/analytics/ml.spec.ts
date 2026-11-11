import { forecastConfidence, daysOfStock, fitLinearRegression, forecastDemand, kmeans, labelRfmClusters, silhouette, standardize } from './ml';

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

describe('Confianza y días de stock del pronóstico', () => {
  it('serie estable con poco ruido tiene confianza ALTA', () => {
    const y = [20, 21, 19, 20, 22, 20, 19, 21, 20, 20, 21, 19];
    expect(forecastDemand(y).confidence).toBe('ALTA');
  });

  it('un solo pico entre ceros tiene confianza BAJA (pocas semanas con ventas)', () => {
    const y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0];
    expect(forecastDemand(y).confidence).toBe('BAJA');
  });

  it('ventas muy erráticas tienen confianza BAJA', () => {
    const y = [5, 40, 3, 38, 2, 45, 6, 30, 4, 50, 1, 35];
    expect(forecastConfidence(y, fitLinearRegression(y))).toBe('BAJA');
  });

  it('menos de 6 semanas nunca da confianza alta', () => {
    const y = [10, 10, 10, 10, 10];
    expect(forecastDemand(y).confidence).toBe('BAJA');
  });

  it('calcula el cambio semanal en porcentaje', () => {
    const y = [10, 12, 14, 16, 18, 20, 22, 24];
    const f = forecastDemand(y);
    expect(f.weeklyChangePct).toBeCloseTo((2 / 17) * 100, 0);
    expect(f.trend).toBe('CRECIENTE');
  });

  it('días de stock: stock / demanda diaria pronosticada', () => {
    expect(daysOfStock(70, 28, 4)).toBe(70); // 28 u. en 28 días = 1 u./día
    expect(daysOfStock(0, 28, 4)).toBe(0);
    expect(daysOfStock(50, 0, 4)).toBeNull();
  });
});
