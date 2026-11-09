/**
 * Tests unitarios de la IA local:
 *   1. Precisión del clasificador NB (≥85% en ejemplos de validación)
 *   2. Motor de interpretación: entidades, typos, fechas, dimensiones
 *   3. Generación de insights
 *   4. Proveedor Ollama (fetch mockeado) — via providers.ts (sin NestJS)
 *   5. Fallback al motor local cuando el LLM falla — via providers.ts
 */

import { getClassifier } from './naive-bayes';
import { interpretLocal } from './local-engine';
import { generateInsights } from './insights';
import { interpretWithOllama } from './providers';

// ─── Datos de prueba para precisión ──────────────────────────────────────────

const VALIDATION_SET: { text: string; metric: string; dimension: string }[] = [
  // ventas_total
  { text: 'resumen de ingresos del mes', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'facturacion de esta semana', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'cuanto dinero generamos', metric: 'ventas_total', dimension: 'ninguna' },
  { text: 'ventas por sucursal', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'ingresos en cada tienda', metric: 'ventas_total', dimension: 'sucursal' },
  { text: 'ventas por metodo de pago', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'ingresos por forma de pago este mes', metric: 'ventas_total', dimension: 'metodo_pago' },
  { text: 'evolucion mensual de ventas', metric: 'ventas_total', dimension: 'mes' },
  { text: 'ventas cada mes del año', metric: 'ventas_total', dimension: 'mes' },
  { text: 'ventas diarias de la semana pasada', metric: 'ventas_total', dimension: 'dia' },
  { text: 'ingresos por categoria de producto', metric: 'ventas_total', dimension: 'categoria' },
  { text: 'ventas por talla de prenda', metric: 'ventas_total', dimension: 'talla' },
  { text: 'ingresos por color de ropa', metric: 'ventas_total', dimension: 'color' },
  { text: 'ventas web versus tienda fisica', metric: 'ventas_total', dimension: 'canal' },
  { text: 'clientes que mas compraron en monto', metric: 'ventas_total', dimension: 'cliente' },
  // cantidad_ventas
  { text: 'cuantas ventas hicimos hoy', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'numero de transacciones del mes', metric: 'cantidad_ventas', dimension: 'ninguna' },
  { text: 'conteo de ventas por tienda', metric: 'cantidad_ventas', dimension: 'sucursal' },
  { text: 'uso de qr versus efectivo', metric: 'cantidad_ventas', dimension: 'metodo_pago' },
  // unidades_vendidas
  { text: 'cuantas prendas vendimos', metric: 'unidades_vendidas', dimension: 'ninguna' },
  { text: 'articulos mas vendidos en cantidad', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'top 5 productos mas vendidos', metric: 'unidades_vendidas', dimension: 'producto' },
  { text: 'prendas vendidas por talla', metric: 'unidades_vendidas', dimension: 'talla' },
  { text: 'unidades por color de ropa', metric: 'unidades_vendidas', dimension: 'color' },
  { text: 'cuantas prendas por categoria', metric: 'unidades_vendidas', dimension: 'categoria' },
  // ticket_promedio
  { text: 'cual es el ticket promedio', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'promedio de compra por cliente', metric: 'ticket_promedio', dimension: 'ninguna' },
  { text: 'promedio de venta en cada tienda', metric: 'ticket_promedio', dimension: 'sucursal' },
  // stock_disponible
  { text: 'inventario disponible actual', metric: 'stock_disponible', dimension: 'ninguna' },
  { text: 'cuantas unidades hay de cada prenda', metric: 'stock_disponible', dimension: 'producto' },
  { text: 'stock por sucursal', metric: 'stock_disponible', dimension: 'sucursal' },
  { text: 'inventario por categoria', metric: 'stock_disponible', dimension: 'categoria' },
  // productos_stock_bajo
  { text: 'que productos se estan agotando', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'articulos que hay que reponer', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  { text: 'alerta de inventario critico', metric: 'productos_stock_bajo', dimension: 'ninguna' },
  // reservas
  { text: 'cuantas reservas hay activas', metric: 'reservas', dimension: 'ninguna' },
  { text: 'reservas confirmadas versus canceladas', metric: 'reservas', dimension: 'estado' },
  { text: 'reservas por tienda este mes', metric: 'reservas', dimension: 'sucursal' },
  // clientes_nuevos
  { text: 'clientes que se registraron este mes', metric: 'clientes_nuevos', dimension: 'ninguna' },
  { text: 'captacion mensual de clientes nuevos', metric: 'clientes_nuevos', dimension: 'mes' },
  { text: 'registro diario de nuevos clientes', metric: 'clientes_nuevos', dimension: 'dia' },
];

// ─── 1. Precisión del clasificador ───────────────────────────────────────────

describe('NaiveBayes – precisión del clasificador', () => {
  const classifier = getClassifier();

  test('acierto en métrica ≥ 85%', () => {
    let correct = 0;
    const wrong: string[] = [];
    for (const ex of VALIDATION_SET) {
      const top = classifier.classify(ex.text)[0];
      if (top.label.metric === ex.metric) correct++;
      else wrong.push(`"${ex.text}": esperado ${ex.metric}, obtenido ${top.label.metric}`);
    }
    const accuracy = correct / VALIDATION_SET.length;
    if (accuracy < 0.85) console.error('Fallos métrica:', wrong.join('\n'));
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });

  test('acierto en dimensión ≥ 70% (dado que la métrica es correcta)', () => {
    let metricOk = 0, dimOk = 0;
    for (const ex of VALIDATION_SET) {
      const top = classifier.classify(ex.text)[0];
      if (top.label.metric === ex.metric) {
        metricOk++;
        if (top.label.dimension === ex.dimension) dimOk++;
      }
    }
    const dimAccuracy = metricOk > 0 ? dimOk / metricOk : 0;
    expect(dimAccuracy).toBeGreaterThanOrEqual(0.70);
  });
});

// ─── 2. Motor local: interpretación ──────────────────────────────────────────

const CTX = {
  now: new Date('2026-11-09'),
  branches: [
    { id: 1, name: 'Sucursal Centro' },
    { id: 2, name: 'Sucursal Sur' },
  ],
  categories: ['Vestidos', 'Camisas', 'Pantalones', 'Chaquetas'],
};

describe('interpretLocal – motor NB+Reglas', () => {
  test('pregunta de stock bajo → metric=productos_stock_bajo', () => {
    const r = interpretLocal('que productos estan por agotarse', CTX);
    expect(r.spec.metric).toBe('productos_stock_bajo');
    expect(r.engine).toBe('IA_LOCAL');
  });

  test('pregunta de ventas → metric=ventas_total', () => {
    const r = interpretLocal('cuanto vendimos este mes', CTX);
    expect(r.spec.metric).toBe('ventas_total');
  });

  test('extrae sucursal por nombre fuzzy', () => {
    const r = interpretLocal('ventas de la sucursal centro este mes', CTX);
    expect(r.spec.filters.branchId).toBe(1);
  });

  test('extrae categoría por nombre', () => {
    const r = interpretLocal('ventas de vestidos en enero', CTX);
    expect(r.spec.filters.category).toBe('Vestidos');
  });

  test('top N se extrae correctamente', () => {
    const r = interpretLocal('top 7 productos mas vendidos', CTX);
    expect(r.spec.limit).toBe(7);
  });

  test('sort asc cuando dice "menos"', () => {
    const r = interpretLocal('los 5 productos que menos se venden', CTX);
    expect(r.spec.sort).toBe('asc');
  });

  test('pregunta con typo se corrige (ventsa→ventas)', () => {
    const r = interpretLocal('ventsa por sucursal este mes', CTX);
    expect(r.spec.metric).toBe('ventas_total');
  });

  test('fecha "hoy" se parsea correctamente', () => {
    const r = interpretLocal('cuanto vendimos hoy', CTX);
    expect(r.spec.filters.dateFrom).toBe('2026-11-09');
    expect(r.spec.filters.dateTo).toBe('2026-11-09');
  });

  test('stock no incluye fechas', () => {
    const r = interpretLocal('stock disponible este mes', CTX);
    expect(r.spec.filters.dateFrom).toBeUndefined();
    expect(r.spec.filters.dateTo).toBeUndefined();
  });

  test('confianza es un número entre 0 y 1', () => {
    const r = interpretLocal('ventas de hoy', CTX);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  test('reservas con "estado" → dimension=estado', () => {
    const r = interpretLocal('reservas confirmadas versus canceladas', CTX);
    expect(r.spec.metric).toBe('reservas');
    expect(r.spec.dimension).toBe('estado');
  });

  test('clientes nuevos → metric=clientes_nuevos', () => {
    const r = interpretLocal('cuantos clientes nuevos se registraron este mes', CTX);
    expect(r.spec.metric).toBe('clientes_nuevos');
  });
});

// ─── 3. Insights ─────────────────────────────────────────────────────────────

describe('generateInsights', () => {
  const baseSpec = {
    title: '', metric: 'ventas_total' as const, dimension: 'sucursal' as const,
    filters: {}, sort: 'desc' as const, limit: 10, chart: 'bar' as const,
  };

  test('sin datos devuelve insight de "no hay datos"', () => {
    const insights = generateInsights(baseSpec, []);
    expect(insights[0].type).toBe('total');
    expect(insights[0].text).toContain('No hay datos');
  });

  test('devuelve top y bottom con múltiples filas', () => {
    const rows = [
      { label: 'Centro', value: 5000 },
      { label: 'Sur', value: 1000 },
      { label: 'Norte', value: 3000 },
    ];
    const insights = generateInsights(baseSpec, rows);
    const types = insights.map((i) => i.type);
    expect(types).toContain('top');
    expect(types).toContain('bottom');
    expect(types).toContain('total');
  });

  test('detecta concentración Pareto cuando top-3 > 60%', () => {
    const rows = [
      { label: 'A', value: 8000 },
      { label: 'B', value: 7000 },
      { label: 'C', value: 6000 },
      { label: 'D', value: 100 },
      { label: 'E', value: 100 },
    ];
    const insights = generateInsights(baseSpec, rows);
    const pareto = insights.find((i) => i.type === 'pareto');
    expect(pareto).toBeDefined();
  });

  test('detecta tendencia creciente en serie temporal', () => {
    const timeSpec = { ...baseSpec, dimension: 'mes' as const };
    const rows = [
      { label: '2026-07', value: 1000 },
      { label: '2026-08', value: 1500 },
      { label: '2026-09', value: 2000 },
      { label: '2026-10', value: 2800 },
    ];
    const insights = generateInsights(timeSpec, rows);
    const trend = insights.find((i) => i.type === 'trend');
    expect(trend).toBeDefined();
    expect(trend!.text).toContain('creciente');
  });

  test('detecta outlier claro (1 dato muy separado)', () => {
    // 6 valores normales + 1 extreme → z(E) ≈ 2.5
    const rows = [
      { label: 'A', value: 90 },
      { label: 'B', value: 100 },
      { label: 'C', value: 95 },
      { label: 'D', value: 105 },
      { label: 'F', value: 98 },
      { label: 'G', value: 92 },
      { label: 'E', value: 2000 }, // claramente outlier
    ];
    const insights = generateInsights(baseSpec, rows);
    const outlier = insights.find((i) => i.type === 'outlier');
    expect(outlier).toBeDefined();
    expect(outlier!.text).toContain('E');
  });

  test('dimension=ninguna devuelve solo KPI total', () => {
    const kpiSpec = { ...baseSpec, dimension: 'ninguna' as const };
    const rows = [{ label: 'Total', value: 12345 }];
    const insights = generateInsights(kpiSpec, rows);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('total');
  });
});

// ─── 4. Ollama provider (fetch mockeado, via providers.ts sin NestJS) ─────────

describe('Proveedor Ollama (fetch mockeado)', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.AI_PROVIDER = 'ollama';
    process.env.AI_API_URL = 'http://localhost:11434';
    process.env.AI_MODEL = 'qwen2.5:3b';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_URL;
    delete process.env.AI_MODEL;
  });

  test('parsea respuesta JSON de Ollama para spec válido', async () => {
    const fakeSpec = { title: 'Ventas por mes', metric: 'ventas_total', dimension: 'mes', filters: {}, sort: 'desc', limit: 12, chart: 'line' };
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: JSON.stringify(fakeSpec) } }),
    });
    const spec = await interpretWithOllama('ventas por mes', CTX);
    expect(spec.metric).toBe('ventas_total');
    expect(spec.dimension).toBe('mes');
  });

  test('lanza error si Ollama devuelve status no-OK', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(interpretWithOllama('test', CTX)).rejects.toThrow('Ollama HTTP 503');
  });

  test('respuesta Ollama envuelta en markdown se limpia', async () => {
    const fakeSpec = { title: 'x', metric: 'reservas', dimension: 'estado', filters: {}, sort: 'desc', limit: 10, chart: 'bar' };
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '```json\n' + JSON.stringify(fakeSpec) + '\n```' } }),
    });
    const spec = await interpretWithOllama('reservas por estado', CTX);
    expect(spec.metric).toBe('reservas');
    expect(spec.dimension).toBe('estado');
  });
});

// ─── 5. Fallback al motor local ───────────────────────────────────────────────

describe('Fallback al motor local cuando Ollama falla', () => {
  test('si interpretWithOllama lanza error, interpretLocal produce spec válido de igual forma', async () => {
    // Simula el flujo de fallback: Ollama falla → usamos interpretLocal
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
    await expect(interpretWithOllama('ventas de esta semana', CTX, fetchMock as any)).rejects.toThrow('Network error');
    // El fallback es interpretLocal, que debe funcionar
    const fallback = interpretLocal('ventas de esta semana', CTX);
    expect(fallback.spec.metric).toBe('ventas_total');
    expect(fallback.engine).toBe('IA_LOCAL');
  });
});
