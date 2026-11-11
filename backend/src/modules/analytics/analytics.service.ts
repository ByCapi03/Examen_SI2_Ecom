/**
 * ANALYTICS SERVICE — Analítica predictiva por tenant
 *  - Pronóstico de demanda (supervisado) y sugerencia de reposición.
 *  - Segmentación RFM de clientes con K-Means (no supervisado).
 * Los modelos se ENTRENAN con las ventas de la empresa, se PERSISTEN por versión
 * (tabla ml_models, con métricas y procedencia real/sintética de los datos) y las
 * consultas posteriores los usan para predecir. Sin modelo entrenado, se ajusta en línea.
 * Todas las consultas están acotadas por tenantId ($1) del JWT.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  assignCluster, evaluateForecast, fitLinearRegression, forecastDemand, holdoutMae, kmeans, labelRfmClusters,
  LinearModel, predict, silhouette, standardize,
} from './ml';
import { MlModel } from './ml-model.entity';

const SALE_OK = `('PAGADA','COMPLETADA')`;
const SYNTHETIC_DOMAIN = '@sintetico.local';
const WEEK_MS = 7 * 24 * 3600 * 1000;

const SEGMENT_ACTIONS: Record<string, string> = {
  'Campeones': 'Programa VIP, acceso anticipado a colecciones.',
  'Clientes leales': 'Recompensas por fidelidad y venta cruzada.',
  'Potenciales': 'Promociones personalizadas para aumentar frecuencia.',
  'Ocasionales de bajo valor': 'Descuentos por volumen y combos para elevar el ticket.',
  'En riesgo de abandono': 'Campaña de reactivación con descuento limitado.',
  'Perdidos': 'Encuesta de satisfacción y oferta de regreso.',
  'Nuevos': 'Bienvenida y recomendación de productos.',
};

interface StoredProductModel { name: string; model: LinearModel; mean: number; mae: number | null }
interface RfmRow { id: number; name: string; email: string; recency: number; frequency: number; monetary: number }

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  private scopeBranch(user: any, branchId?: number): number | null {
    if (!user.roles?.includes('ADMIN')) return user.branchId ?? null;
    return branchId ? Number(branchId) : null;
  }

  // ------------------------------------------------------------------ datos
  /** Serie semanal de unidades por producto (índice 0 = semana más antigua). */
  private async loadWeeklySeries(tenantId: number, weeks: number, branchId: number | null) {
    const params: any[] = [tenantId, weeks];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = `AND s."branchId" = $3`; }

    const rows: { productId: number; name: string; week: number; units: string }[] = await this.dataSource.query(
      `SELECT p.id AS "productId", p.name,
              FLOOR(EXTRACT(EPOCH FROM (date_trunc('week', now()) - date_trunc('week', s.date))) / 604800)::int AS week,
              SUM(si.quantity) AS units
         FROM sales s
         JOIN sale_items si ON si."saleId" = s.id
         JOIN variants v ON v.id = si."variantId"
         JOIN products p ON p.id = v."productId" AND p."tenantId" = s."tenantId"
        WHERE s."tenantId" = $1 AND s.status IN ${SALE_OK}
          AND s.date >= date_trunc('week', now()) - ($2::int - 1) * INTERVAL '1 week'
          ${branchFilter}
        GROUP BY p.id, p.name, week`,
      params,
    );

    const series = new Map<number, { name: string; weekly: number[] }>();
    for (const r of rows) {
      const id = Number(r.productId);
      if (!series.has(id)) series.set(id, { name: r.name, weekly: new Array(weeks).fill(0) });
      const idx = weeks - 1 - Number(r.week);
      if (idx >= 0 && idx < weeks) series.get(id)!.weekly[idx] += Number(r.units);
    }
    return series;
  }

  private async loadRfm(tenantId: number): Promise<RfmRow[]> {
    return this.dataSource.query(
      `SELECT c.id, c.name || ' ' || c."lastName" AS name, c.email,
              EXTRACT(DAY FROM now() - MAX(s.date))::int AS recency,
              COUNT(DISTINCT s.id)::int AS frequency,
              COALESCE(SUM(s.total), 0)::float AS monetary
         FROM clients c
         JOIN sales s ON s."clientId" = c.id AND s."tenantId" = c."tenantId"
        WHERE c."tenantId" = $1 AND s.status IN ${SALE_OK}
        GROUP BY c.id`,
      [tenantId],
    );
  }

  /** Procedencia de los datos de entrenamiento: ventas reales vs. sintéticas (usuario @sintetico.local). */
  private async dataProvenance(tenantId: number, weeks: number) {
    const [r] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS sales,
              COUNT(*) FILTER (WHERE u.email LIKE $3)::int AS "syntheticSales"
         FROM sales s LEFT JOIN users u ON u.id = s."userId"
        WHERE s."tenantId" = $1 AND s.status IN ${SALE_OK}
          AND s.date >= date_trunc('week', now()) - ($2::int - 1) * INTERVAL '1 week'`,
      [tenantId, weeks, `%${SYNTHETIC_DOMAIN}`],
    );
    return { windowWeeks: weeks, sales: r.sales, syntheticSales: r.syntheticSales, realSales: r.sales - r.syntheticSales };
  }

  private async activeModel(tenantId: number, name: MlModel['name'], em?: EntityManager) {
    return (em ?? this.dataSource.manager).findOne(MlModel, { where: { tenantId, name, active: true }, order: { version: 'DESC' } });
  }

  private async persistModel(em: EntityManager, data: Omit<MlModel, 'id' | 'tenant' | 'trainedAt' | 'version' | 'active'>) {
    const [{ v }] = await em.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ml_models WHERE "tenantId" = $1 AND name = $2`,
      [data.tenantId, data.name],
    );
    await em.update(MlModel, { tenantId: data.tenantId, name: data.name }, { active: false });
    return em.save(MlModel, em.create(MlModel, { ...data, version: Number(v), active: true }));
  }

  // --------------------------------------------------------------- entrenar
  /** Entrena y persiste una nueva versión de ambos modelos con las ventas actuales de la empresa. */
  async train(user: any, opts: { weeks?: number; k?: number }) {
    const tenantId = Number(user.tenantId);
    const weeks = Math.min(Math.max(Number(opts.weeks) || 26, 8), 104);
    const k = Math.min(Math.max(Number(opts.k) || 4, 2), 6);
    const provenance = await this.dataProvenance(tenantId, weeks);
    if (provenance.sales === 0) {
      throw new BadRequestException('No hay ventas en el período para entrenar. Registra ventas o genera datos sintéticos (npm run seed:synthetic).');
    }

    // ---- Supervisado: regresión lineal por producto + validación holdout
    const series = await this.loadWeeklySeries(tenantId, weeks, null);
    const products: Record<string, StoredProductModel> = {};
    for (const [id, s] of series) {
      const model = fitLinearRegression(s.weekly);
      const meanY = s.weekly.reduce((a, b) => a + b, 0) / s.weekly.length;
      products[id] = { name: s.name, model, mean: meanY, mae: holdoutMae(s.weekly) };
    }
    const evaluation = evaluateForecast([...series.values()].map((s) => s.weekly));

    // ---- No supervisado: K-Means sobre RFM estandarizado
    const rfm = await this.loadRfm(tenantId);
    let segmentParams: any = null;
    let segmentMetrics: any = { clients: rfm.length };
    if (rfm.length >= Math.max(k, 4)) {
      const feats = rfm.map((r) => [Number(r.recency), Math.log1p(Number(r.frequency)), Math.log1p(Number(r.monetary))]);
      const { data, mean, std } = standardize(feats);
      const result = kmeans(data, k, 42);
      const groups = Array.from({ length: result.centroids.length }, () => [] as RfmRow[]);
      rfm.forEach((r, i) => groups[result.labels[i]].push(r));
      const centroidsRfm = groups.map((g) => ({
        recencyDays: g.length ? g.reduce((a, r) => a + Number(r.recency), 0) / g.length : 0,
        frequency: g.length ? g.reduce((a, r) => a + Number(r.frequency), 0) / g.length : 0,
        monetary: g.length ? g.reduce((a, r) => a + Number(r.monetary), 0) / g.length : 0,
      }));
      const population = {
        recencyDays: rfm.reduce((a, r) => a + Number(r.recency), 0) / rfm.length,
        frequency: rfm.reduce((a, r) => a + Number(r.frequency), 0) / rfm.length,
        monetary: rfm.reduce((a, r) => a + Number(r.monetary), 0) / rfm.length,
      };
      const sil = silhouette(data, result.labels);
      segmentParams = { k: result.centroids.length, mean, std, centroids: result.centroids, names: labelRfmClusters(centroidsRfm, population) };
      segmentMetrics = {
        clients: rfm.length,
        inertia: Number(result.inertia.toFixed(3)),
        iterations: result.iterations,
        silhouette: sil == null ? null : Number(sil.toFixed(3)),
      };
    }

    const saved = await this.dataSource.transaction(async (em) => {
      const out: MlModel[] = [];
      out.push(await this.persistModel(em, {
        tenantId, name: 'DEMAND_FORECAST', learningType: 'SUPERVISADO', trainedBy: user.sub,
        trainingRows: provenance.sales, dataSource: provenance,
        params: { windowWeeks: weeks, products },
        metrics: { products: Object.keys(products).length, evaluation, algorithm: 'Regresión lineal OLS por producto (holdout 2 semanas vs. baseline ingenuo)' },
      }));
      if (segmentParams) {
        out.push(await this.persistModel(em, {
          tenantId, name: 'CUSTOMER_SEGMENTS', learningType: 'NO_SUPERVISADO', trainedBy: user.sub,
          trainingRows: rfm.length, dataSource: provenance,
          params: segmentParams, metrics: { ...segmentMetrics, algorithm: 'K-Means++ sobre RFM estandarizado (log en F y M)' },
        }));
      }
      return out;
    });

    return {
      trainedAt: new Date().toISOString(),
      dataSource: provenance,
      models: saved.map((m) => this.summarize(m)),
      warnings: segmentParams ? [] : ['No hay suficientes clientes con compras para entrenar la segmentación (mínimo 4).'],
    };
  }

  private summarize(m: MlModel) {
    return {
      id: m.id, name: m.name, learningType: m.learningType, version: m.version, active: m.active,
      trainedAt: m.trainedAt, trainingRows: m.trainingRows, dataSource: m.dataSource, metrics: m.metrics,
    };
  }

  async listModels(user: any) {
    const models = await this.dataSource.manager.find(MlModel, {
      where: { tenantId: Number(user.tenantId) }, order: { trainedAt: 'DESC' }, take: 30,
    });
    return models.map((m) => this.summarize(m));
  }

  // ------------------------------------------------------ pronóstico demanda
  async demandForecast(user: any, opts: { weeks?: number; horizon?: number; branchId?: number; limit?: number }) {
    const tenantId = Number(user.tenantId);
    const weeks = Math.min(Math.max(Number(opts.weeks) || 12, 4), 52);
    const horizon = Math.min(Math.max(Number(opts.horizon) || 4, 1), 12);
    const limit = Math.min(Math.max(Number(opts.limit) || 15, 1), 100);
    const branchId = this.scopeBranch(user, opts.branchId);

    const series = await this.loadWeeklySeries(tenantId, weeks, branchId);

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

    // El modelo persistido es de toda la empresa; con filtro de sucursal se ajusta en línea.
    const stored = branchId ? null : await this.activeModel(tenantId, 'DEMAND_FORECAST');
    const storedProducts: Record<string, StoredProductModel> = stored?.params?.products ?? {};
    const elapsedWeeks = stored ? Math.max(0, Math.floor((Date.now() - new Date(stored.trainedAt).getTime()) / WEEK_MS)) : 0;
    let usedStored = 0;

    const products = [...series.entries()].map(([productId, s]) => {
      const available = stock.get(productId) ?? 0;
      const sp = storedProducts[productId];
      let forecast: number[], forecastTotal: number, trend: string, model: LinearModel, mae: number | null, safetyStock: number, source: string;
      if (sp) {
        usedStored++;
        model = sp.model;
        forecast = predict(model, stored!.params.windowWeeks + elapsedWeeks, horizon).map((v) => Number(v.toFixed(2)));
        forecastTotal = Number(forecast.reduce((a, b) => a + b, 0).toFixed(2));
        const relSlope = sp.mean > 0 ? model.slope / sp.mean : model.slope;
        trend = relSlope > 0.05 ? 'CRECIENTE' : relSlope < -0.05 ? 'DECRECIENTE' : 'ESTABLE';
        mae = sp.mae;
        safetyStock = Math.ceil(1.65 * model.residualStd * Math.sqrt(horizon));
        source = 'MODELO_ENTRENADO';
      } else {
        const f = forecastDemand(s.weekly, horizon);
        ({ forecast, forecastTotal, trend, model, mae, safetyStock } = f);
        source = 'AJUSTE_EN_LINEA';
      }
      const reorder = Math.max(0, Math.ceil(forecastTotal + safetyStock - available));
      return {
        productId,
        productName: s.name,
        history: s.weekly,
        forecast,
        forecastTotal,
        trend,
        slope: Number(model.slope.toFixed(3)),
        r2: Number(model.r2.toFixed(3)),
        mae: mae == null ? null : Number(mae.toFixed(2)),
        safetyStock,
        availableStock: available,
        suggestedReorder: reorder,
        risk: available <= 0 && forecastTotal > 0 ? 'QUIEBRE' : reorder > 0 ? 'REPONER' : 'OK',
        source,
      };
    }).sort((a, b) => b.forecastTotal - a.forecastTotal).slice(0, limit);

    return {
      model: 'Regresión lineal (mínimos cuadrados) sobre ventas semanales',
      learningType: 'SUPERVISADO',
      weeks, horizon, branchId,
      generatedAt: new Date().toISOString(),
      trainedModel: stored && usedStored > 0
        ? { version: stored.version, trainedAt: stored.trainedAt, dataSource: stored.dataSource, evaluation: stored.metrics?.evaluation ?? null }
        : null,
      products,
    };
  }

  // ----------------------------------------------------- segmentación clientes
  async customerSegments(user: any, opts: { k?: number }) {
    const tenantId = Number(user.tenantId);
    const rows = await this.loadRfm(tenantId);
    const stored = await this.activeModel(tenantId, 'CUSTOMER_SEGMENTS');
    // Sin k explícito (o igual al entrenado) se usa el modelo persistido; con otro k se explora en línea.
    const useStored = !!stored && (!opts.k || Number(opts.k) === stored.params.k);
    const k = useStored ? stored!.params.k : Math.min(Math.max(Number(opts.k) || 4, 2), 6);

    if (rows.length < 2) {
      return { model: 'K-Means (RFM)', learningType: 'NO_SUPERVISADO', k, clients: rows.length, segments: [], silhouette: null,
        message: 'Se necesitan al menos 2 clientes con compras para segmentar.' };
    }

    // Log-transform de F y M para reducir el sesgo de compradores extremos
    const features = rows.map((r) => [Number(r.recency), Math.log1p(Number(r.frequency)), Math.log1p(Number(r.monetary))]);

    let labels: number[], names: string[], effectiveK: number, inertia: number | null, iterations: number | null, sil: number | null;
    if (useStored) {
      const p = stored!.params;
      labels = features.map((f) => assignCluster(f, p.mean, p.std, p.centroids));
      names = p.names;
      effectiveK = p.k;
      inertia = stored!.metrics?.inertia ?? null;
      iterations = stored!.metrics?.iterations ?? null;
      sil = stored!.metrics?.silhouette ?? null;
    } else {
      const { data } = standardize(features);
      const result = kmeans(data, k, 42);
      effectiveK = result.centroids.length;
      labels = result.labels;
      inertia = Number(result.inertia.toFixed(3));
      iterations = result.iterations;
      const s = silhouette(data, result.labels);
      sil = s == null ? null : Number(s.toFixed(3));
      const groupsTmp = Array.from({ length: effectiveK }, () => [] as RfmRow[]);
      rows.forEach((r, i) => groupsTmp[labels[i]].push(r));
      const cen = groupsTmp.map((g) => ({
        recencyDays: g.length ? g.reduce((a, r) => a + Number(r.recency), 0) / g.length : 0,
        frequency: g.length ? g.reduce((a, r) => a + Number(r.frequency), 0) / g.length : 0,
        monetary: g.length ? g.reduce((a, r) => a + Number(r.monetary), 0) / g.length : 0,
      }));
      const pop = {
        recencyDays: rows.reduce((a, r) => a + Number(r.recency), 0) / rows.length,
        frequency: rows.reduce((a, r) => a + Number(r.frequency), 0) / rows.length,
        monetary: rows.reduce((a, r) => a + Number(r.monetary), 0) / rows.length,
      };
      names = labelRfmClusters(cen, pop);
    }

    const groups = Array.from({ length: effectiveK }, () => [] as RfmRow[]);
    rows.forEach((r, i) => groups[labels[i]].push(r));
    const avg = (g: RfmRow[], f: (r: RfmRow) => number) => (g.length ? g.reduce((a, r) => a + f(r), 0) / g.length : 0);

    const segments = groups.map((g, j) => ({
      cluster: j,
      name: names[j],
      size: g.length,
      avgRecencyDays: Number(avg(g, (r) => Number(r.recency)).toFixed(1)),
      avgFrequency: Number(avg(g, (r) => Number(r.frequency)).toFixed(2)),
      avgMonetary: Number(avg(g, (r) => Number(r.monetary)).toFixed(2)),
      suggestedAction: SEGMENT_ACTIONS[names[j].replace(/ \d+$/, '')] ?? '',
      clients: [...g].sort((a, b) => b.monetary - a.monetary).slice(0, 50).map((r) => ({
        id: r.id, name: r.name, email: r.email, recencyDays: Number(r.recency), frequency: Number(r.frequency), monetary: Number(r.monetary),
      })),
    })).filter((s) => s.size > 0).sort((a, b) => b.avgMonetary - a.avgMonetary);

    return {
      model: 'K-Means++ sobre variables RFM estandarizadas',
      learningType: 'NO_SUPERVISADO',
      k: effectiveK,
      clients: rows.length,
      inertia,
      iterations,
      silhouette: sil,
      generatedAt: new Date().toISOString(),
      trainedModel: useStored
        ? { version: stored!.version, trainedAt: stored!.trainedAt, dataSource: stored!.dataSource }
        : null,
      segments,
    };
  }
}
