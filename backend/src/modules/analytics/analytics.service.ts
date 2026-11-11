/**
 * ANALYTICS SERVICE — Analítica predictiva por tenant
 *  - Pronóstico de demanda (supervisado) y sugerencia de reposición.
 *  - Segmentación RFM de clientes con K-Means (no supervisado).
 * Todas las consultas están acotadas por tenantId ($1) del JWT.
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { daysOfStock, forecastDemand, kmeans, labelRfmClusters, silhouette, standardize } from './ml';

/** Orden de la tabla: primero lo más urgente. */
const URGENCY: Record<string, number> = { QUIEBRE: 0, REPONER: 1, OK: 2 };

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  private scopeBranch(user: any, branchId?: number): number | null {
    if (!user.roles?.includes('ADMIN')) return user.branchId ?? null;
    return branchId ? Number(branchId) : null;
  }

  async demandForecast(user: any, opts: { weeks?: number; horizon?: number; branchId?: number; limit?: number }) {
    const tenantId = Number(user.tenantId);
    const weeks = Math.min(Math.max(Number(opts.weeks) || 12, 4), 52);
    const horizon = Math.min(Math.max(Number(opts.horizon) || 4, 1), 12);
    const limit = Math.min(Math.max(Number(opts.limit) || 15, 1), 100);
    const branchId = this.scopeBranch(user, opts.branchId);

    const params: any[] = [tenantId, weeks];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = `AND s."branchId" = $3`; }

    // Solo semanas COMPLETAS: la semana en curso se excluye porque está a medias y haría ver una caída falsa.
    // week = 1 es la última semana completa; ROUND (no FLOOR) evita desfases de una semana por cambios de horario.
    const rows: { productId: number; name: string; week: number; units: string }[] = await this.dataSource.query(
      `SELECT p.id AS "productId", p.name,
              ROUND(EXTRACT(EPOCH FROM (date_trunc('week', now()) - date_trunc('week', s.date))) / 604800)::int AS week,
              SUM(si.quantity) AS units
         FROM sales s
         JOIN sale_items si ON si."saleId" = s.id
         JOIN variants v ON v.id = si."variantId"
         JOIN products p ON p.id = v."productId" AND p."tenantId" = s."tenantId"
        WHERE s."tenantId" = $1 AND s.status IN ('PAGADA','COMPLETADA')
          AND s.date >= date_trunc('week', now()) - $2::int * INTERVAL '1 week'
          AND s.date < date_trunc('week', now())
          ${branchFilter}
        GROUP BY p.id, p.name, week`,
      params,
    );

    const stockParams: any[] = [tenantId];
    let stockBranch = '';
    if (branchId) { stockParams.push(branchId); stockBranch = `AND i."branchId" = $2`; }
    const stockRows: { productId: number; available: string }[] = await this.dataSource.query(
      `SELECT v."productId", SUM(i.stock - i.reserved) AS available
         FROM inventory i JOIN variants v ON v.id = i."variantId"
        WHERE i."tenantId" = $1 ${stockBranch}
        GROUP BY v."productId"`,
      stockParams,
    );
    const stock = new Map(stockRows.map((r) => [Number(r.productId), Number(r.available)]));

    const series = new Map<number, { name: string; weekly: number[] }>();
    for (const r of rows) {
      const id = Number(r.productId);
      if (!series.has(id)) series.set(id, { name: r.name, weekly: new Array(weeks).fill(0) });
      const idx = weeks - Number(r.week); // índice 0 = semana más antigua; weeks-1 = última semana completa
      if (idx >= 0 && idx < weeks) series.get(id)!.weekly[idx] += Number(r.units);
    }

    const products = [...series.entries()].map(([productId, s]) => {
      const f = forecastDemand(s.weekly, horizon);
      const available = stock.get(productId) ?? 0;
      const reorder = Math.max(0, Math.ceil(f.forecastTotal + f.safetyStock - available));
      const risk = available <= 0 && f.forecastTotal > 0 ? 'QUIEBRE' : reorder > 0 ? 'REPONER' : 'OK';
      const days = daysOfStock(available, f.forecastTotal, horizon);
      const avg = f.history.reduce((a, b) => a + b, 0) / (f.history.length || 1);
      const lowConf = f.confidence === 'BAJA' ? ' Ojo: el pronóstico es poco confiable (ventas muy variables o pocas semanas con ventas); tómalo como orientación.' : '';
      const action = risk === 'QUIEBRE'
        ? `Sin stock y se esperan ~${Math.round(f.forecastTotal)} u. en ${horizon} semana(s). Repón al menos ${reorder} u.${lowConf}`
        : risk === 'REPONER'
          ? `Compra ${reorder} u.: se venderían ~${Math.round(f.forecastTotal)} u. en ${horizon} semana(s), tienes ${available} y conviene guardar ${f.safetyStock} de seguridad.${lowConf}`
          : `No hace falta reponer: tienes ${available} u. y se esperan ~${Math.round(f.forecastTotal)} u. en ${horizon} semana(s)${days != null ? ` (te duran ≈ ${Math.round(days)} días)` : ''}.${lowConf}`;
      return {
        productId,
        productName: s.name,
        history: f.history,
        forecast: f.forecast,
        forecastTotal: f.forecastTotal,
        trend: f.trend,
        slope: Number(f.model.slope.toFixed(3)),
        r2: Number(f.model.r2.toFixed(3)),
        mae: f.mae == null ? null : Number(f.mae.toFixed(2)),
        safetyStock: f.safetyStock,
        availableStock: available,
        suggestedReorder: reorder,
        risk,
        confidence: f.confidence,
        weeklyChangePct: f.weeklyChangePct,
        avgWeeklyUnits: Number(avg.toFixed(1)),
        daysOfStock: days,
        action,
      };
    }).sort((a, b) => URGENCY[a.risk] - URGENCY[b.risk] || (a.daysOfStock ?? Infinity) - (b.daysOfStock ?? Infinity) || b.forecastTotal - a.forecastTotal).slice(0, limit);

    return {
      model: 'Regresión lineal (mínimos cuadrados) sobre ventas semanales',
      learningType: 'SUPERVISADO',
      weeks, horizon, branchId,
      includesCurrentWeek: false,
      generatedAt: new Date().toISOString(),
      products,
    };
  }

  async customerSegments(user: any, opts: { k?: number }) {
    const tenantId = Number(user.tenantId);
    const k = Math.min(Math.max(Number(opts.k) || 4, 2), 6);
    const rows: any[] = await this.dataSource.query(
      `SELECT c.id, c.name || ' ' || c."lastName" AS name, c.email,
              EXTRACT(DAY FROM now() - MAX(s.date))::int AS recency,
              COUNT(DISTINCT s.id)::int AS frequency,
              COALESCE(SUM(s.total), 0)::float AS monetary
         FROM clients c
         JOIN sales s ON s."clientId" = c.id AND s."tenantId" = c."tenantId"
        WHERE c."tenantId" = $1 AND s.status IN ('PAGADA','COMPLETADA')
        GROUP BY c.id`,
      [tenantId],
    );

    if (rows.length < 2) {
      return { model: 'K-Means (RFM)', learningType: 'NO_SUPERVISADO', k, clients: rows.length, segments: [], silhouette: null,
        message: 'Se necesitan al menos 2 clientes con compras para segmentar.' };
    }

    // Log-transform de F y M para reducir el sesgo de compradores extremos
    const features = rows.map((r) => [Number(r.recency), Math.log1p(Number(r.frequency)), Math.log1p(Number(r.monetary))]);
    const { data } = standardize(features);
    const result = kmeans(data, k, 42);
    const effectiveK = result.centroids.length;

    const groups = Array.from({ length: effectiveK }, () => [] as any[]);
    rows.forEach((r, i) => groups[result.labels[i]].push(r));
    const centroidsRfm = groups.map((g) => ({
      recencyDays: g.length ? g.reduce((a, r) => a + Number(r.recency), 0) / g.length : 0,
      frequency: g.length ? g.reduce((a, r) => a + Number(r.frequency), 0) / g.length : 0,
      monetary: g.length ? g.reduce((a, r) => a + Number(r.monetary), 0) / g.length : 0,
    }));
    const population = {
      recencyDays: rows.reduce((a, r) => a + Number(r.recency), 0) / rows.length,
      frequency: rows.reduce((a, r) => a + Number(r.frequency), 0) / rows.length,
      monetary: rows.reduce((a, r) => a + Number(r.monetary), 0) / rows.length,
    };
    const names = labelRfmClusters(centroidsRfm, population);
    const actions: Record<string, string> = {
      'Campeones': 'Programa VIP, acceso anticipado a colecciones.',
      'Clientes leales': 'Recompensas por fidelidad y venta cruzada.',
      'Potenciales': 'Promociones personalizadas para aumentar frecuencia.',
      'Ocasionales de bajo valor': 'Descuentos por volumen y combos para elevar el ticket.',
      'En riesgo de abandono': 'Campaña de reactivación con descuento limitado.',
      'Perdidos': 'Encuesta de satisfacción y oferta de regreso.',
      'Nuevos': 'Bienvenida y recomendación de productos.',
    };

    const segments = groups.map((g, j) => ({
      cluster: j,
      name: names[j],
      size: g.length,
      avgRecencyDays: Number(centroidsRfm[j].recencyDays.toFixed(1)),
      avgFrequency: Number(centroidsRfm[j].frequency.toFixed(2)),
      avgMonetary: Number(centroidsRfm[j].monetary.toFixed(2)),
      suggestedAction: actions[names[j].replace(/ \d+$/, '')] ?? '',
      clients: g.sort((a, b) => b.monetary - a.monetary).slice(0, 50).map((r) => ({
        id: r.id, name: r.name, email: r.email, recencyDays: Number(r.recency), frequency: Number(r.frequency), monetary: Number(r.monetary),
      })),
    })).filter((s) => s.size > 0).sort((a, b) => b.avgMonetary - a.avgMonetary);

    const sil = silhouette(data, result.labels);
    return {
      model: 'K-Means++ sobre variables RFM estandarizadas',
      learningType: 'NO_SUPERVISADO',
      k: effectiveK,
      clients: rows.length,
      inertia: Number(result.inertia.toFixed(3)),
      iterations: result.iterations,
      silhouette: sil == null ? null : Number(sil.toFixed(3)),
      generatedAt: new Date().toISOString(),
      segments,
    };
  }
}
