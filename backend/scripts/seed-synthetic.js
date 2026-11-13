/**
 * GENERADOR DE DATOS SINTÉTICOS para entrenar y evaluar los modelos de ML.
 *
 * Crea, para UNA empresa, un historial de ventas realista (determinista con --seed):
 *  - Demanda por producto con tendencia (creciente / estable / decreciente), estacionalidad
 *    anual (pico noviembre-diciembre), efecto día de la semana y ruido de Poisson.
 *  - Clientes con 6 comportamientos RFM (campeones, leales, ocasionales, en riesgo,
 *    perdidos y nuevos). Con k=6 el K-Means recupera aproximadamente esos grupos (con k=4 los fusiona).
 *  - Ventas anónimas de mostrador, con pagos y detalle, en varias sucursales y canales.
 *
 * Todo queda MARCADO como sintético para no confundirlo con datos reales:
 *  - usuario  sintetico+<tenantId>@sintetico.local (responsable de todas las ventas)
 *  - clientes *@sintetico.local, productos/variantes con SKU "SYN-..."
 * Las métricas de entrenamiento (/analytics/train) informan cuántas ventas son reales y cuántas sintéticas.
 *
 * Uso (desde backend/):
 *   node scripts/seed-synthetic.js                       # empresa 1, 12 meses, 80 clientes
 *   node scripts/seed-synthetic.js --tenant=mi-empresa --months=18 --clients=120 --seed=7
 *   node scripts/seed-synthetic.js --tenant=mi-empresa --sales=3000        # cantidad exacta de ventas sintéticas
 *   node scripts/seed-synthetic.js --tenant=mi-empresa --clean   # elimina lo generado
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  try { require('dotenv').config({ path: envPath, quiet: true }); } catch { /* usa variables del sistema */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const MONTHS = Math.min(Math.max(Number(args.months) || 12, 3), 36);
const N_CLIENTS = Math.min(Math.max(Number(args.clients) || 80, 10), 500);
const SEED = Number(args.seed) || 42;
const TARGET_SALES = Number(args.sales) || 0;
const DOMAIN = '@sintetico.local';

// ---------------------------------------------------------------- aleatoriedad
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
function poisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal()));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// -------------------------------------------------------------------- dominio
const NAMES = ['Ana', 'Luis', 'María', 'Carlos', 'Lucía', 'Jorge', 'Valeria', 'Diego', 'Camila', 'Andrés', 'Sofía', 'Mateo', 'Paula', 'Daniel', 'Elena', 'Pablo'];
const LASTS = ['Rojas', 'Mamani', 'Quispe', 'Flores', 'Vargas', 'Gutiérrez', 'Choque', 'Salazar', 'Pérez', 'Torrico', 'Arce', 'Suárez'];
const SYN_PRODUCTS = ['Vestido floral', 'Blusa lino', 'Jean slim', 'Chaqueta cuero', 'Falda midi', 'Camisa oxford', 'Polera básica', 'Abrigo lana',
  'Short denim', 'Saco formal', 'Pantalón vestir', 'Chompa tejida', 'Enterizo verano', 'Bufanda', 'Campera deportiva', 'Top crop'];

/** Comportamientos de cliente: probabilidad diaria de compra y ventana de actividad (en días desde el inicio). */
const ARCHETYPES = [
  { key: 'CAMPEON', share: 0.10, pDay: 0.11, items: 2.6, window: () => [0, Infinity] },
  { key: 'LEAL', share: 0.20, pDay: 0.05, items: 2.0, window: () => [0, Infinity] },
  { key: 'OCASIONAL', share: 0.30, pDay: 0.012, items: 1.5, window: (D) => [Math.floor(rnd() * D * 0.5), Infinity] },
  { key: 'EN_RIESGO', share: 0.15, pDay: 0.04, items: 1.8, window: (D) => [0, D - (70 + Math.floor(rnd() * 60))] },
  { key: 'PERDIDO', share: 0.15, pDay: 0.04, items: 1.8, window: (D) => [0, D - Math.min(D - 30, 170 + Math.floor(rnd() * 130))] },
  { key: 'NUEVO', share: 0.10, pDay: 0.06, items: 1.4, window: (D) => [D - 25, Infinity] },
];

const dowFactor = [0.9, 0.85, 0.85, 0.9, 1.1, 1.5, 0.95]; // dom..sáb
function seasonal(date) {
  const doy = (date - new Date(date.getFullYear(), 0, 0)) / 86400000;
  const month = date.getMonth();
  const holiday = month === 10 || month === 11 ? 1.4 : month === 4 ? 1.15 : 1;
  return (1 + 0.2 * Math.sin((2 * Math.PI * doy) / 365)) * holiday;
}

async function main() {
  const missing = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'].filter((k) => !process.env[k]);
  if (missing.length) { console.error(`Faltan variables: ${missing.join(', ')} (revise backend/.env)`); process.exit(1); }
  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: String(process.env.DB_PASSWORD), database: process.env.DB_DATABASE,
  });
  await db.connect();
  const q = (sql, params) => db.query(sql, params);
  const one = async (sql, params) => (await q(sql, params)).rows[0];

  const tArg = args.tenant === undefined || args.tenant === true ? '1' : String(args.tenant);
  const tenant = await one(`SELECT id, slug, name FROM tenants WHERE slug = $1 OR id::text = $1 LIMIT 1`, [tArg]);
  if (!tenant) { console.error(`Empresa "${tArg}" no encontrada.`); process.exit(1); }
  const T = tenant.id;
  const synUserEmail = `sintetico+${T}${DOMAIN}`;
  console.log(`Empresa: ${tenant.name} (id ${T}, slug ${tenant.slug})`);

  // ------------------------------------------------------------------ limpieza
  if (args.clean) {
    await q('BEGIN');
    const synUser = await one(`SELECT id FROM users WHERE "tenantId" = $1 AND email = $2`, [T, synUserEmail]);
    const sales = `SELECT id FROM sales WHERE "tenantId" = $1 AND ("userId" = $2 OR "clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1 AND email LIKE $3))`;
    const p = [T, synUser?.id ?? 0, `%${DOMAIN}`];
    const pay = await q(`DELETE FROM payments WHERE "saleId" IN (${sales})`, p);
    const it = await q(`DELETE FROM sale_items WHERE "saleId" IN (${sales})`, p);
    const sl = await q(`DELETE FROM sales WHERE "tenantId" = $1 AND ("userId" = $2 OR "clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1 AND email LIKE $3))`, p);
    await q(`DELETE FROM inventory WHERE "tenantId" = $1 AND "variantId" IN (SELECT id FROM variants WHERE "tenantId" = $1 AND sku LIKE 'SYN-%')`, [T]);
    await q(`DELETE FROM variants WHERE "tenantId" = $1 AND sku LIKE 'SYN-%'`, [T]);
    await q(`DELETE FROM products WHERE "tenantId" = $1 AND name LIKE '[SINT] %'`, [T]);
    const cl = await q(`DELETE FROM clients WHERE "tenantId" = $1 AND email LIKE $2`, [T, `%${DOMAIN}`]);
    await q(`DELETE FROM user_roles WHERE "userId" = $1`, [synUser?.id ?? 0]);
    await q(`DELETE FROM users WHERE "tenantId" = $1 AND email = $2`, [T, synUserEmail]);
    await q(`DELETE FROM branches WHERE "tenantId" = $1 AND name = '[SINT] Sucursal sintética'`, [T]).catch(() => {});
    await q('COMMIT');
    console.log(`✔ Eliminado: ${sl.rowCount} ventas, ${it.rowCount} ítems, ${pay.rowCount} pagos, ${cl.rowCount} clientes sintéticos.`);
    await db.end();
    return;
  }

  const existing = await one(`SELECT COUNT(*)::int AS n FROM clients WHERE "tenantId" = $1 AND email LIKE $2`, [T, `%${DOMAIN}`]);
  if (existing.n > 0) {
    console.error(`Ya hay ${existing.n} clientes sintéticos en esta empresa. Ejecute primero con --clean para regenerar.`);
    process.exit(1);
  }

  await q('BEGIN');
  try {
    // ---------------------------------------------------------- sucursales
    let branches = (await q(`SELECT id FROM branches WHERE "tenantId" = $1 AND active = true ORDER BY id LIMIT 3`, [T])).rows.map((r) => r.id);
    if (!branches.length) {
      const city = (await one(`SELECT id FROM cities ORDER BY id LIMIT 1`))
        ?? (await one(`INSERT INTO cities (name, active) VALUES ('Ciudad sintética', true) RETURNING id`));
      const b = await one(`INSERT INTO branches ("tenantId", name, address, phone, active, "cityId", "createdAt")
        VALUES ($1, '[SINT] Sucursal sintética', 'Av. Sintética', '000', true, $2, now()) RETURNING id`, [T, city.id]);
      branches = [b.id];
    }

    // ------------------------------------------------- usuario responsable
    const hash = await bcrypt.hash(`syn-${SEED}-${T}`, 10);
    const synUser = await one(`INSERT INTO users ("tenantId", name, email, "passwordHash", active, "mustChangePassword", "emailVerified", "createdAt", "branchId")
      VALUES ($1, 'Usuario sintético', $2, $3, false, false, true, now(), $4) RETURNING id`, [T, synUserEmail, hash, branches[0]]);
    const cajero = await one(`SELECT id FROM roles WHERE name = 'CAJERO' LIMIT 1`);
    if (cajero) await q(`INSERT INTO user_roles ("userId", "roleId", active, "assignedAt") VALUES ($1, $2, true, now())`, [synUser.id, cajero.id]);

    // ------------------------------------------------------------ catálogo
    const sizes = (await q(`SELECT id FROM sizes WHERE "tenantId" = $1 AND active = true ORDER BY id LIMIT 4`, [T])).rows;
    const colors = (await q(`SELECT id FROM colors WHERE "tenantId" = $1 AND active = true ORDER BY id LIMIT 4`, [T])).rows;
    if (!sizes.length || !colors.length) throw new Error('La empresa no tiene tallas/colores; inicie el backend una vez para sembrarlos.');

    let products = (await q(
      `SELECT p.id, p.price::float AS price, array_agg(v.id) AS variants
         FROM products p JOIN variants v ON v.\"productId\" = p.id AND v.\"tenantId\" = p.\"tenantId\"
        WHERE p."tenantId" = $1 AND p.active = true AND v.active = true
        GROUP BY p.id ORDER BY p.id LIMIT 20`, [T])).rows
      .map((r) => ({ id: r.id, price: r.price, variants: r.variants }));

    const TARGET = 12;
    if (products.length < TARGET) {
      let cat = await one(`SELECT id FROM categories WHERE "tenantId" = $1 AND active = true ORDER BY id LIMIT 1`, [T]);
      if (!cat) cat = await one(`INSERT INTO categories ("tenantId", name, active) VALUES ($1, 'Sintética', true) RETURNING id`, [T]);
      for (let i = 0; products.length < TARGET; i++) {
        const name = SYN_PRODUCTS[i % SYN_PRODUCTS.length];
        const price = Math.round((60 + rnd() * 340) / 5) * 5;
        const prod = await one(`INSERT INTO products ("tenantId", name, price, active, "categoryId", colorizable, "arEnabled")
          VALUES ($1, $2, $3, true, $4, false, false) RETURNING id`, [T, `[SINT] ${name} ${i + 1}`, price, cat.id]);
        const variants = [];
        for (let v = 0; v < 3; v++) {
          const variant = await one(`INSERT INTO variants ("tenantId", sku, active, "productId", "sizeId", "colorId") VALUES ($1, $2, true, $3, $4, $5) RETURNING id`,
            [T, `SYN-${prod.id}-${v + 1}`, prod.id, sizes[v % sizes.length].id, colors[(v + i) % colors.length].id]);
          variants.push(variant.id);
          for (const b of branches) {
            await q(`INSERT INTO inventory ("tenantId", stock, reserved, "stockMin", "branchId", "variantId", "updatedAt") VALUES ($1, $2, 0, 5, $3, $4, now())`,
              [T, 20 + Math.floor(rnd() * 120), b, variant.id]);
          }
        }
        products.push({ id: prod.id, price, variants });
      }
    }

    // ------------------------------------------------------ parámetros de demanda
    const D = MONTHS * 30;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - D);
    const prodBase = products.map(() => Math.exp(0.9 * normal()));
    const prodGrowth = products.map(() => weightedPick([0.025, 0, -0.02], [0.25, 0.45, 0.30]));
    const prodWeights = (dayIdx) => products.map((_, i) => prodBase[i] * Math.max(0.1, 1 + prodGrowth[i] * (dayIdx / 7 - D / 14)));

    function makeBasket(dayIdx, meanItems) {
      const n = Math.min(products.length, 1 + poisson(Math.max(0, meanItems - 1)));
      const w = prodWeights(dayIdx);
      const chosen = new Set();
      const lines = [];
      while (lines.length < n && chosen.size < products.length) {
        const prod = weightedPick(products, w);
        if (chosen.has(prod.id)) continue;
        chosen.add(prod.id);
        lines.push({ variantId: pick(prod.variants), unitPrice: prod.price, quantity: rnd() < 0.85 ? 1 : 2 });
      }
      return lines;
    }

    // ------------------------------------------------------------- clientes
    const clients = [];
    const counts = ARCHETYPES.map((a) => Math.max(1, Math.round(a.share * N_CLIENTS)));
    ARCHETYPES.forEach((a, ai) => {
      for (let i = 0; i < counts[ai]; i++) {
        const [from, to] = a.window(D);
        clients.push({ arch: a, from: Math.max(0, from), to: Math.min(D - 1, to), branch: pick(branches) });
      }
    });
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      const row = await one(`INSERT INTO clients ("tenantId", name, "lastName", email, active, "registrationDate")
        VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
        [T, pick(NAMES), `${pick(LASTS)}`, `cliente${i + 1}.${T}${DOMAIN}`, new Date(start.getTime() + c.from * 86400000)]);
      c.id = row.id;
    }

    // ------------------------------------------------------------- ventas
    const sales = [];
    const addSale = (dayIdx, clientId, branchId, channel, lines) => {
      const d = new Date(start.getTime() + dayIdx * 86400000);
      d.setHours(9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0);
      const total = lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
      const method = channel === 'POS' ? weightedPick(['EFECTIVO', 'TARJETA', 'QR'], [55, 30, 15])
        : channel === 'WEB' ? weightedPick(['TARJETA', 'QR'], [70, 30]) : weightedPick(['BILLETERA_MOVIL', 'TARJETA'], [50, 50]);
      sales.push({ date: d, clientId, branchId, channel, lines, total, method });
    };

    for (let day = 0; day < D; day++) {
      const date = new Date(start.getTime() + day * 86400000);
      // mostrador (anónimas)
      const lambda = 6 * seasonal(date) * dowFactor[date.getDay()] * (1 + 0.0008 * day);
      for (let s = poisson(lambda); s > 0; s--) addSale(day, null, pick(branches), 'POS', makeBasket(day, 1.8));
      // clientes registrados
      for (const c of clients) {
        if (day < c.from || day > c.to) continue;
        if (rnd() < c.arch.pDay * seasonal(date)) {
          const channel = weightedPick(['POS', 'WEB', 'MOVIL'], [40, 40, 20]);
          addSale(day, c.id, rnd() < 0.7 ? c.branch : pick(branches), channel, makeBasket(day, c.arch.items));
        }
      }
    }

    // Cantidad exacta pedida (--sales=N): se recorta al azar (con la semilla) o se completa con ventas de mostrador
    if (TARGET_SALES > 0) {
      if (sales.length > TARGET_SALES) {
        for (let i = sales.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sales[i], sales[j]] = [sales[j], sales[i]]; }
        sales.length = TARGET_SALES;
        sales.sort((a, b) => a.date - b.date);
      } else {
        const days = Array.from({ length: D }, (_, d) => d);
        const dayW = days.map((d) => { const dt = new Date(start.getTime() + d * 86400000); return seasonal(dt) * dowFactor[dt.getDay()] * (1 + 0.0008 * d); });
        for (let k = sales.length; k < TARGET_SALES; k++) {
          const day = weightedPick(days, dayW);
          addSale(day, null, pick(branches), 'POS', makeBasket(day, 1.8));
        }
        sales.sort((a, b) => a.date - b.date);
      }
    }

    // ------------------------------------------------- inserción por lotes
    const BATCH = 400;
    for (let i = 0; i < sales.length; i += BATCH) {
      const chunk = sales.slice(i, i + BATCH);
      const params = [];
      const values = chunk.map((s, j) => {
        const o = j * 9;
        params.push(T, s.channel, 'COMPLETADA', s.date, s.total, s.total, s.branchId, s.clientId, synUser.id);
        return `($${o + 1}, $${o + 2}::sales_channel_enum, $${o + 3}::sales_status_enum, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9})`;
      });
      const ids = (await q(
        `INSERT INTO sales ("tenantId", channel, status, date, subtotal, total, "branchId", "clientId", "userId") VALUES ${values.join(',')} RETURNING id`, params)).rows;

      const itemParams = [], itemValues = [], payParams = [], payValues = [];
      chunk.forEach((s, j) => {
        const saleId = ids[j].id;
        for (const l of s.lines) {
          const o = itemParams.length;
          itemParams.push(l.quantity, l.unitPrice, l.unitPrice * l.quantity, saleId, l.variantId);
          itemValues.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`);
        }
        const o = payParams.length;
        payParams.push(T, s.total, s.method, s.date, saleId);
        payValues.push(`($${o + 1}, $${o + 2}, $${o + 3}::payments_method_enum, 'APROBADO'::payments_status_enum, $${o + 4}, $${o + 5})`);
      });
      await q(`INSERT INTO sale_items (quantity, "unitPrice", subtotal, "saleId", "variantId") VALUES ${itemValues.join(',')}`, itemParams);
      await q(`INSERT INTO payments ("tenantId", amount, method, status, date, "saleId") VALUES ${payValues.join(',')}`, payParams);
    }

    await q('COMMIT');
    const byArch = Object.fromEntries(ARCHETYPES.map((a, i) => [a.key, counts[i]]));
    console.log(`✔ ${sales.length} ventas sintéticas en ${MONTHS} meses (${branches.length} sucursal(es), ${products.length} productos, ${clients.length} clientes)`);
    console.log('  Comportamientos de clientes generados:', byArch);
    console.log('  Siguiente paso: entrenar los modelos  →  POST /analytics/train  (o botón "Entrenar modelos" en Analítica)');
  } catch (err) {
    await q('ROLLBACK');
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
