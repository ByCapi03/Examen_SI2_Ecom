import { buildPivotCellsQuery, buildReportQuery, InvalidSpecError, validateSpec } from './report-spec';
import { buildPivot, isAdditive, pivotInsights } from './pivot';
import { detectCrossDimensions, interpretLocal } from './local-ai/local-engine';

const base = { title: 't', metric: 'ventas_total', dimension: 'sucursal', dimension2: 'canal', filters: {}, sort: 'desc', limit: 10 };
const ctx = {
  now: new Date('2026-11-13T12:00:00'),
  branches: [{ id: 1, name: 'Luna Centro' }, { id: 2, name: 'Luna Norte' }],
  categories: ['Vestidos', 'Faldas', 'Blusas'],
};

describe('validateSpec con dos agrupaciones', () => {
  it('acepta sucursal × canal y fuerza gráfico de barras', () => {
    const s = validateSpec({ ...base, chart: 'pie' });
    expect(s.dimension2).toBe('canal');
    expect(s.chart).toBe('bar');
    expect(s.title).toBe('t');
  });

  it('rechaza dimensiones repetidas, cruce de tiempos y dimension2 sin principal', () => {
    expect(() => validateSpec({ ...base, dimension2: 'sucursal' })).toThrow(InvalidSpecError);
    expect(() => validateSpec({ ...base, dimension: 'mes', dimension2: 'dia' })).toThrow(InvalidSpecError);
    expect(() => validateSpec({ ...base, dimension: 'ninguna' })).toThrow(InvalidSpecError);
    expect(() => validateSpec({ ...base, dimension2: 'no_existe' })).toThrow(InvalidSpecError);
  });

  it('método de pago × sucursal usa la tabla de pagos; ticket promedio por método de pago sigue prohibido', () => {
    const ok = validateSpec({ ...base, dimension: 'metodo_pago', dimension2: 'sucursal' });
    expect(buildReportQuery(ok, 5).source).toBe('PAYMENTS');
    expect(() => validateSpec({ ...base, metric: 'ticket_promedio', dimension: 'metodo_pago', dimension2: 'sucursal' })).toThrow(InvalidSpecError);
  });

  it('stock bajo no se puede cruzar por canal', () => {
    expect(() => validateSpec({ ...base, metric: 'productos_stock_bajo', dimension: 'sucursal', dimension2: 'canal' })).toThrow(InvalidSpecError);
  });
});

describe('consultas SQL cruzadas', () => {
  it('los totales usan solo la agrupación principal y el tenant es $1', () => {
    const q = buildReportQuery(validateSpec(base), 7);
    expect(q.params[0]).toBe(7);
    expect(q.sql).toMatch(/GROUP BY 1\s/);
    expect(q.sql).not.toMatch(/label2/);
  });

  it('las celdas agrupan por 2 columnas, filtran por las filas elegidas y no interpolan texto del usuario', () => {
    const q = buildPivotCellsQuery(validateSpec({ ...base, filters: { category: "x'; DROP TABLE sales; --" } }), 7, ['Luna Centro', 'Luna Norte']);
    expect(q.sql).toMatch(/GROUP BY 1, 2/);
    expect(q.sql).toMatch(/= ANY\(\$\d+::text\[\]\)/);
    expect(q.sql).not.toMatch(/DROP TABLE/);
    expect(q.params[0]).toBe(7);
    expect(q.params[q.params.length - 1]).toEqual(['Luna Centro', 'Luna Norte']);
  });
});

describe('buildPivot', () => {
  const spec = validateSpec(base);
  const totals = [{ label: 'Centro', value: 100 }, { label: 'Norte', value: 50 }];
  const cells = [
    { label: 'Centro', label2: 'WEB', value: 30 }, { label: 'Centro', label2: 'POS', value: 70 },
    { label: 'Norte', label2: 'WEB', value: 50 },
  ];

  it('ordena columnas por peso, completa con ceros y calcula totales', () => {
    const p = buildPivot(spec, totals, cells);
    expect(p.series).toEqual(['WEB', 'POS']); // WEB 80 > POS 70
    expect(p.rows[0].cells).toEqual([30, 70]);
    expect(p.rows[1].cells).toEqual([50, 0]);
    expect(p.columnTotals).toEqual([80, 70]);
    expect(p.grandTotal).toBe(150);
    expect(p.additive).toBe(true);
  });

  it('limita las columnas y avisa cuántas quedaron fuera', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: 'Centro', label2: `c${i}`, value: i + 1 }));
    const p = buildPivot(spec, [{ label: 'Centro', value: 78 }], many, 8);
    expect(p.series).toHaveLength(8);
    expect(p.truncatedSeries).toBe(4);
  });

  it('con tiempo en las columnas las ordena cronológicamente', () => {
    const t = validateSpec({ ...base, dimension2: 'mes' });
    const p = buildPivot(t, totals.slice(0, 1), [
      { label: 'Centro', label2: '2026-10', value: 5 }, { label: 'Centro', label2: '2026-09', value: 50 },
    ]);
    expect(p.series).toEqual(['2026-09', '2026-10']);
  });

  it('el ticket promedio no se suma; contar ventas por producto tampoco', () => {
    expect(isAdditive({ metric: 'ticket_promedio', dimension: 'sucursal', dimension2: 'canal' })).toBe(false);
    expect(isAdditive({ metric: 'cantidad_ventas', dimension: 'producto', dimension2: 'sucursal' })).toBe(false);
    expect(isAdditive({ metric: 'cantidad_ventas', dimension: 'sucursal', dimension2: 'canal' })).toBe(true);
    const p = buildPivot(validateSpec({ ...base, metric: 'ticket_promedio' }), totals, cells);
    expect(p.columnTotals).toBeNull();
    expect(p.grandTotal).toBeNull();
  });

  it('las lecturas automáticas nombran la mayor combinación y quién predomina', () => {
    const texts = pivotInsights(spec, buildPivot(spec, totals, cells)).map((i) => i.text).join(' | ');
    expect(texts).toContain('Mayor combinación: "Centro" en "POS" con 70');
    expect(texts).toContain('En "Norte" predomina "WEB" (100.0%');
  });
});

describe('detección de dos agrupaciones en lenguaje natural', () => {
  const d = (q: string) => detectCrossDimensions(q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

  it('reconoce los cruces típicos', () => {
    expect(d('Ventas por sucursal y por sus diferentes canales dentro de los últimos 30 días')).toEqual(['sucursal', 'canal']);
    expect(d('Ventas por sucursal de los últimos 30 días categorizado por sus diferentes canales')).toEqual(['sucursal', 'canal']);
    expect(d('Los 10 productos más vendidos agrupado por sucursal')).toEqual(['producto', 'sucursal']);
    expect(d('Unidades vendidas por talla y color')).toEqual(['talla', 'color']);
    expect(d('Ventas por método de pago y sucursal')).toEqual(['metodo_pago', 'sucursal']);
    expect(d('Reservas por estado y sucursal este mes')).toEqual(['estado', 'sucursal']);
    expect(d('Ventas por sucursal y por mes')).toEqual(['sucursal', 'mes']);
  });

  it('un filtro ("en el canal web", "del canal pos") no cuenta como agrupación', () => {
    expect(d('Unidades vendidas por talla en el canal web')).toBeNull();
    expect(d('Ventas por sucursal del canal pos')).toBeNull();
    expect(d('Ventas por sucursal de los últimos 30 días')).toBeNull();
    expect(d('Clientes nuevos por mes')).toBeNull();
  });

  it('interpretLocal genera el cruce y respeta filtros por nombre de sucursal', () => {
    const r = interpretLocal('Ventas por sucursal y por sus diferentes canales dentro de los ultimos 30 dias', ctx);
    expect(r.spec.dimension).toBe('sucursal');
    expect(r.spec.dimension2).toBe('canal');
    expect(r.spec.filters.dateFrom).toBeDefined();

    const f = interpretLocal('Ventas de Luna Centro por canal', ctx);
    expect(f.spec.filters.branchId).toBe(1);
    expect(f.spec.dimension2).toBeUndefined();
    expect(f.spec.dimension).toBe('canal');
  });

  it('descarta agrupaciones que la métrica no admite (el stock no se agrupa por canal)', () => {
    const r = interpretLocal('Stock por sucursal y por canal', ctx);
    expect(r.spec.metric).toMatch(/stock/);
    expect(r.spec.dimension2).not.toBe('canal');
    expect(r.spec.dimension).not.toBe('canal');
  });
});

describe('correcciones del intérprete', () => {
  it('"vendidos" no se confunde con la categoría "Vestidos"', () => {
    const r = interpretLocal('Los 10 productos más vendidos de los últimos 3 meses', ctx);
    expect(r.spec.filters.category).toBeUndefined();
    expect(r.spec.dimension).toBe('producto');
    expect(r.spec.limit).toBe(10);
  });

  it('sigue reconociendo la categoría escrita con un error de tipeo', () => {
    expect(interpretLocal('Ventas de vestdos este mes', ctx).spec.filters.category).toBe('Vestidos');
    expect(interpretLocal('Ventas de vestidos este mes', ctx).spec.filters.category).toBe('Vestidos');
  });

  it('entiende "el último mes", "la última semana" y "el último año"', () => {
    const mes = interpretLocal('Ventas por canal y por semana del último mes', ctx).spec.filters;
    expect(mes.dateFrom).toBe('2026-10-14');
    expect(mes.dateTo).toBe('2026-11-13');
    expect(interpretLocal('Ventas de la última semana', ctx).spec.filters.dateFrom).toBe('2026-11-07');
    expect(interpretLocal('Ventas del último año', ctx).spec.filters.dateFrom).toBe('2025-11-14');
  });
});
