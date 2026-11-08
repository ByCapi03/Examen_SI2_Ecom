import { buildReportQuery, InvalidSpecError, validateSpec } from './report-spec';
import { parseDateRange, parseQuestion } from './nl-parser';

const ctx = {
  now: new Date(2026, 10, 8), // 8 nov 2026
  branches: [{ id: 1, name: 'Sucursal Central' }, { id: 2, name: 'Sucursal Norte' }],
  categories: ['Vestidos', 'Pantalones'],
};

describe('ReportSpec: validación de lista blanca', () => {
  it('rechaza métricas y dimensiones no permitidas', () => {
    expect(() => validateSpec({ metric: 'DROP TABLE users', dimension: 'producto' })).toThrow(InvalidSpecError);
    expect(() => validateSpec({ metric: 'ventas_total', dimension: 'password' })).toThrow(InvalidSpecError);
  });

  it('rechaza combinaciones incompatibles', () => {
    expect(() => validateSpec({ metric: 'stock_disponible', dimension: 'mes' })).toThrow(InvalidSpecError);
  });

  it('rechaza fechas o sucursales con formato inválido', () => {
    expect(() => validateSpec({ metric: 'ventas_total', filters: { dateFrom: "2026-01-01'; --" } })).toThrow();
    expect(() => validateSpec({ metric: 'ventas_total', filters: { branchId: '1 OR 1=1' } })).toThrow();
  });

  it('acota el límite a 50', () => {
    expect(validateSpec({ metric: 'ventas_total', dimension: 'producto', limit: 9999 }).limit).toBe(50);
  });
});

describe('buildReportQuery: SQL parametrizado y aislado por tenant', () => {
  it('el tenantId siempre es $1 y los textos viajan como parámetros', () => {
    const spec = validateSpec({ metric: 'ventas_total', dimension: 'producto', filters: { category: "x' OR '1'='1" } });
    const { sql, params } = buildReportQuery(spec, 7);
    expect(params[0]).toBe(7);
    expect(sql).toContain('s."tenantId" = $1');
    expect(sql).not.toContain("OR '1'='1");
    expect(params).toContain("%x' OR '1'='1%");
  });

  it('usa la tabla de pagos para la dimensión método de pago', () => {
    const { sql } = buildReportQuery(validateSpec({ metric: 'ventas_total', dimension: 'metodo_pago' }), 1);
    expect(sql).toContain('payments pay');
    expect(sql).toContain('pay."tenantId" = $1');
  });

  it('rechaza tenantId inválido', () => {
    expect(() => buildReportQuery(validateSpec({ metric: 'reservas' }), 0)).toThrow();
  });
});

describe('Intérprete de lenguaje natural (español)', () => {
  it('top N productos más vendidos este mes en una sucursal', () => {
    const s = parseQuestion('¿Cuáles fueron los 3 vestidos más vendidos este mes en mi sucursal central?', ctx);
    expect(s.metric).toBe('unidades_vendidas');
    expect(s.dimension).toBe('producto');
    expect(s.limit).toBe(3);
    expect(s.filters.branchId).toBe(1);
    expect(s.filters.category).toBe('Vestidos');
    expect(s.filters.dateFrom).toBe('2026-11-01');
    expect(s.filters.dateTo).toBe('2026-11-08');
  });

  it('ventas por método de pago del mes pasado', () => {
    const s = parseQuestion('Ventas por método de pago del mes pasado', ctx);
    expect(s.metric).toBe('ventas_total');
    expect(s.dimension).toBe('metodo_pago');
    expect(s.filters).toMatchObject({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  });

  it('stock bajo ignora fechas', () => {
    const s = parseQuestion('¿Qué productos tienen stock bajo este mes?', ctx);
    expect(s.metric).toBe('productos_stock_bajo');
    expect(s.filters.dateFrom).toBeUndefined();
  });

  it('rangos relativos', () => {
    expect(parseDateRange('ultimos 7 dias', ctx.now)).toEqual({ dateFrom: '2026-11-02', dateTo: '2026-11-08' });
    expect(parseDateRange('en marzo', ctx.now)).toEqual({ dateFrom: '2026-03-01', dateTo: '2026-03-31' });
  });
});
