/**
 * VERIFICACIÓN INDEPENDIENTE DEL PRONÓSTICO DE DEMANDA
 * Lee las ventas directamente de PostgreSQL, vuelve a calcular el modelo con otra formulación (ecuaciones normales)
 * y lo compara con lo que devuelve GET /analytics/demand-forecast. Si coinciden, la serie semanal, la regresión,
 * el pronóstico, el stock de seguridad, la reposición, los días de stock, la tendencia y la confianza son correctos.
 *
 * Uso (con el backend corriendo y los datos demo cargados):
 *   API_URL=http://localhost:3000 DB_HOST=localhost DB_PORT=5432 DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... node scripts/verify-forecast.js
 */
const { Client } = require('pg');

const API = process.env.API_URL || 'http://localhost:3000';
const WEEKS = 12;
const HORIZON = 4;
const Z = 1.65;
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) ok++; else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;

async function main() {
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'luna' }, body: JSON.stringify({ email: 'admin@luna.com', password: '123456' }) }).then((r) => r.json());
  const res = await fetch(`${API}/analytics/demand-forecast?weeks=${WEEKS}&horizon=${HORIZON}&limit=100`, { headers: { Authorization: `Bearer ${login.accessToken}` } }).then((r) => r.json());
  const db = new Client({ host: process.env.DB_HOST || 'localhost', port: +(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();

  const tz = (await db.query('SHOW timezone')).rows[0].TimeZone;
  if (tz !== 'UTC' && tz !== 'Etc/UTC') throw new Error(`La verificación asume zona horaria UTC en PostgreSQL (es ${tz})`);
  const tenantId = (await db.query(`SELECT id FROM tenants WHERE slug = 'luna'`)).rows[0].id;

  // Ventas crudas de la empresa (sin agrupar en SQL: el agrupamiento por semana se hace aquí, a mano)
  const raw = (await db.query(
    `SELECT p.id AS pid, p.name, s.date, si.quantity AS q
       FROM sales s JOIN sale_items si ON si."saleId" = s.id JOIN variants v ON v.id = si."variantId"
       JOIN products p ON p.id = v."productId"
      WHERE s."tenantId" = $1 AND s.status IN ('PAGADA','COMPLETADA')`, [tenantId])).rows;
  const stockRows = (await db.query(
    `SELECT v."productId" AS pid, SUM(i.stock - i.reserved) AS a FROM inventory i JOIN variants v ON v.id = i."variantId" WHERE i."tenantId" = $1 GROUP BY 1`, [tenantId])).rows;
  const stock = new Map(stockRows.map((r) => [r.pid, Number(r.a)]));

  // Lunes 00:00 UTC de la semana actual
  const now = new Date();
  const mondayOf = (d) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const dow = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dow); return x.getTime(); };
  const thisMonday = mondayOf(now);
  const WEEK = 7 * 86400000;

  const series = new Map();
  for (const r of raw) {
    const w = Math.round((thisMonday - mondayOf(new Date(r.date))) / WEEK); // 1 = última semana completa
    if (w < 1 || w > WEEKS) continue; // semana en curso (0) y fuera de rango se excluyen
    if (!series.has(r.pid)) series.set(r.pid, { name: r.name, weekly: new Array(WEEKS).fill(0) });
    series.get(r.pid).weekly[WEEKS - w] += Number(r.q);
  }

  console.log(`Producto(s) con ventas: ${series.size} · API devolvió ${res.products.length}`);
  check('el API no incluye la semana en curso', res.includesCurrentWeek === false);
  check('mismo número de productos', series.size === res.products.length, `${series.size} vs ${res.products.length}`);

  for (const p of res.products) {
    const ref = series.get(p.productId);
    const tag = `[${p.productName}]`;
    if (!ref) { check(`${tag} existe en la verificación`, false); continue; }
    const y = ref.weekly, n = y.length;

    // 1) Serie semanal
    check(`${tag} serie semanal idéntica`, JSON.stringify(y) === JSON.stringify(p.history), `\n     mía ${JSON.stringify(y)}\n     api ${JSON.stringify(p.history)}`);

    // 2) Mínimos cuadrados por ecuaciones normales
    const sx = y.reduce((a, _, i) => a + i, 0), sy = y.reduce((a, v) => a + v, 0);
    const sxy = y.reduce((a, v, i) => a + i * v, 0), sxx = y.reduce((a, _, i) => a + i * i, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    const mean = sy / n;
    const sse = y.reduce((a, v, i) => a + (v - (intercept + slope * i)) ** 2, 0);
    const sst = y.reduce((a, v) => a + (v - mean) ** 2, 0);
    const r2 = sst === 0 ? 1 : 1 - sse / sst;
    const sigma = Math.sqrt(sse / (n - 2));
    check(`${tag} pendiente`, near(slope, p.slope, 0.001), `${slope.toFixed(4)} vs ${p.slope}`);
    check(`${tag} R²`, near(r2, p.r2, 0.001), `${r2.toFixed(4)} vs ${p.r2}`);

    // 3) Pronóstico, stock de seguridad, reposición
    const fc = Array.from({ length: HORIZON }, (_, h) => Math.max(0, intercept + slope * (n + h)));
    const total = Number(fc.map((v) => Number(v.toFixed(2))).reduce((a, b) => a + b, 0).toFixed(2));
    const safety = Math.ceil(Z * sigma * Math.sqrt(HORIZON));
    const avail = stock.get(p.productId) ?? 0;
    const reorder = Math.max(0, Math.ceil(total + safety - avail));
    check(`${tag} pronóstico total`, near(total, p.forecastTotal, 0.05), `${total} vs ${p.forecastTotal}`);
    check(`${tag} stock de seguridad`, safety === p.safetyStock, `${safety} vs ${p.safetyStock}`);
    check(`${tag} stock disponible`, avail === p.availableStock, `${avail} vs ${p.availableStock}`);
    check(`${tag} reposición`, reorder === p.suggestedReorder, `${reorder} vs ${p.suggestedReorder}`);
    check(`${tag} estado`, p.risk === (avail <= 0 && total > 0 ? 'QUIEBRE' : reorder > 0 ? 'REPONER' : 'OK'));

    // 4) Días de stock, tendencia, confianza
    const perDay = total / (HORIZON * 7);
    const days = perDay > 0 ? Number((Math.max(0, avail) / perDay).toFixed(1)) : null;
    check(`${tag} días de stock`, days === p.daysOfStock || (days != null && near(days, p.daysOfStock, 0.2)), `${days} vs ${p.daysOfStock}`);
    const rel = mean > 0 ? slope / mean : slope;
    const trend = r2 >= 0.25 && rel > 0.03 ? 'CRECIENTE' : r2 >= 0.25 && rel < -0.03 ? 'DECRECIENTE' : 'ESTABLE';
    check(`${tag} tendencia`, trend === p.trend, `${trend} vs ${p.trend}`);
    const active = y.filter((v) => v > 0).length;
    const cv = sigma / mean;
    const conf = n < 6 || active < 4 || mean <= 0 ? 'BAJA' : cv <= 0.2 ? 'ALTA' : cv <= 0.4 ? 'MEDIA' : 'BAJA';
    check(`${tag} confianza`, conf === p.confidence, `${conf} vs ${p.confidence}`);

    // 5) Validación holdout (MAE): entrenar con todo menos las 2 últimas semanas y predecirlas
    const tr = y.slice(0, n - 2), m = tr.length;
    const tsx = tr.reduce((a, _, i) => a + i, 0), tsy = tr.reduce((a, v) => a + v, 0), tsxy = tr.reduce((a, v, i) => a + i * v, 0), tsxx = tr.reduce((a, _, i) => a + i * i, 0);
    const tb = (m * tsxy - tsx * tsy) / (m * tsxx - tsx * tsx), ta = (tsy - tb * tsx) / m;
    const mae = [0, 1].reduce((a, k) => a + Math.abs(Math.max(0, ta + tb * (m + k)) - y[m + k]), 0) / 2;
    check(`${tag} MAE (validación holdout)`, near(mae, p.mae, 0.011), `${mae.toFixed(2)} vs ${p.mae}`);
  }

  await db.end();
  console.log(`\nVerificación del pronóstico: ${ok} correctas, ${fail} con diferencias`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
