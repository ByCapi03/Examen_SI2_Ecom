/**
 * BATERÍA E2E — SaaS Multitenant (incl. catálogos por empresa) + Operación Offline + Reportes IA + ML
 *
 * Requisitos: backend en ejecución (API_URL, por defecto http://localhost:3000)
 * y acceso a la misma base de datos (variables DB_* o backend/.env).
 *
 *   node scripts/test-saas-e2e.js
 *
 * Crea dos empresas de prueba (A: Plan Profesional, B: Plan Básico) con datos
 * aislados, ejecuta las pruebas y al final elimina todos los datos de prueba.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.warn(`⚠ No se encontró ${envPath}; se usarán las variables de entorno del sistema.`);
    return;
  }
  try {
    // Mismo lector que usa NestJS (@nestjs/config): soporta BOM, CRLF, comillas y comentarios
    require('dotenv').config({ path: envPath, quiet: true });
  } catch {
    const text = fs.readFileSync(envPath, 'utf8').replace(/^﻿/, '');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/^\s*export\s+/, '');
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

function requireDbConfig() {
  const missing = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n✖ Faltan variables de conexión: ${missing.join(', ')}.`);
    console.error('  Revise que backend/.env las defina (las mismas que usa el backend) o defínalas en la terminal.\n');
    process.exit(1);
  }
}
loadEnv();

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const RUN = Date.now().toString(36);
const PASSWORD = 'Test1234!';
let passed = 0;
let cityId;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✖ ${name}${detail !== undefined ? ' → ' + JSON.stringify(detail).slice(0, 400) : ''}`); }
}

async function api(method, url, token, body) {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function login(email) {
  const r = await api('POST', '/auth/login', null, { email, password: PASSWORD });
  if (r.status >= 300) throw new Error(`Login falló para ${email}: ${JSON.stringify(r.data)}`);
  return r.data.accessToken;
}

async function main() {
  const db = new Client({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres', password: String(process.env.DB_PASSWORD),
    database: process.env.DB_DATABASE || 'ecommerce_ropa',
  });
  requireDbConfig();
  await db.connect();
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  const hash = await bcrypt.hash(PASSWORD, 10);
  const created = { tenants: [] };

  console.log(`\n=== Preparando datos de prueba (run ${RUN}) en ${API} ===`);
  try {
    // ---------- Catálogos globales
    for (const [id, name] of [[1, 'ADMIN'], [2, 'CLIENTE'], [3, 'ENCARGADO'], [4, 'CAJERO']]) {
      await q(`INSERT INTO roles (id, name, description, active) VALUES ($1, $2, $2, true) ON CONFLICT (id) DO NOTHING`, [id, name]);
    }
    const roleId = async (name) => (await one(`SELECT id FROM roles WHERE name = $1`, [name])).id;
    const city = await one(`INSERT INTO cities (name, active) VALUES ($1, true) RETURNING id`, [`Ciudad ${RUN}`]);
    cityId = city.id;
    const plan = async (code) => (await one(`SELECT id FROM plans WHERE code = $1`, [code])).id;

    async function makeTenant(letter, planCode, price) {
      const t = await one(`INSERT INTO tenants (slug, name, active, "createdAt", "updatedAt") VALUES ($1, $2, true, now(), now()) RETURNING id`,
        [`empresa-${letter.toLowerCase()}-${RUN}`, `Empresa ${letter} ${RUN}`]);
      created.tenants.push(t.id);
      await q(`INSERT INTO subscriptions (tenant_id, plan_id, status, start_date, updated_at) VALUES ($1, $2, 'ACTIVE', now(), now())`, [t.id, await plan(planCode)]);
      const branch = await one(`INSERT INTO branches ("tenantId", name, address, phone, active, "cityId", "createdAt")
        VALUES ($1, $2, 'Av. Test', '700', true, $3, now()) RETURNING id`, [t.id, `Sucursal Central ${letter}`, city.id]);
      const branch2 = await one(`INSERT INTO branches ("tenantId", name, address, phone, active, "cityId", "createdAt")
        VALUES ($1, $2, 'Av. Test 2', '701', true, $3, now()) RETURNING id`, [t.id, `Sucursal Norte ${letter}`, city.id]);
      // Catálogos propios de cada empresa (mismo nombre en A y B: es único POR empresa)
      const category = await one(`INSERT INTO categories ("tenantId", name, active) VALUES ($1, $2, true) RETURNING id`, [t.id, `Vestidos ${RUN}`]);
      const size = await one(`INSERT INTO sizes ("tenantId", name, active) VALUES ($1, $2, true) RETURNING id`, [t.id, `M-${RUN}`]);
      const color = await one(`INSERT INTO colors ("tenantId", name, active) VALUES ($1, $2, true) RETURNING id`, [t.id, `Negro-${RUN}`]);
      const product = await one(`INSERT INTO products ("tenantId", name, price, active, "categoryId", colorizable, "arEnabled")
        VALUES ($1, $2, $3, true, $4, false, false) RETURNING id`, [t.id, `Vestido ${letter} ${RUN}`, price, category.id]);
      const variant = await one(`INSERT INTO variants ("tenantId", sku, active, "productId", "sizeId", "colorId") VALUES ($1, $2, true, $3, $4, $5) RETURNING id`,
        [t.id, `SKU-${letter}-${RUN}`, product.id, size.id, color.id]);
      const inv = await one(`INSERT INTO inventory ("tenantId", stock, reserved, "stockMin", "branchId", "variantId", "updatedAt")
        VALUES ($1, 5, 0, 1, $2, $3, now()) RETURNING id`, [t.id, branch.id, variant.id]);
      await q(`INSERT INTO inventory ("tenantId", stock, reserved, "stockMin", "branchId", "variantId", "updatedAt")
        VALUES ($1, 10, 0, 1, $2, $3, now())`, [t.id, branch2.id, variant.id]);

      const mkUser = async (role, branchId) => {
        const u = await one(`INSERT INTO users ("tenantId", name, email, "passwordHash", active, "mustChangePassword", "emailVerified", "createdAt", "branchId")
          VALUES ($1, $2, $3, $4, true, false, true, now(), $5) RETURNING id, email`,
          [t.id, `${role} ${letter}`, `${role.toLowerCase()}.${letter.toLowerCase()}.${RUN}@test.local`, hash, branchId]);
        await q(`INSERT INTO user_roles ("userId", "roleId", active, "assignedAt") VALUES ($1, $2, true, now())`, [u.id, await roleId(role)]);
        return u;
      };
      const admin = await mkUser('ADMIN', null);
      const cajero = await mkUser('CAJERO', branch.id);
      const clienteUser = await mkUser('CLIENTE', null);
      const client = await one(`INSERT INTO clients ("tenantId", name, "lastName", email, active, "userId", "registrationDate")
        VALUES ($1, 'Cliente', $2, $3, true, $4, now()) RETURNING id`, [t.id, letter, clienteUser.email, clienteUser.id]);
      const session = await one(`INSERT INTO cash_sessions ("tenantId", "branchId", "cashierId", "openingAmount", "openedAt", status)
        VALUES ($1, $2, $3, 100, now(), 'OPEN') RETURNING id`, [t.id, branch.id, cajero.id]);
      // Venta histórica + reserva para pruebas de aislamiento y analítica
      const sale = await one(`INSERT INTO sales ("tenantId", channel, status, date, subtotal, total, "branchId", "clientId", "userId")
        VALUES ($1, 'POS', 'COMPLETADA', now() - interval '1 day', $2, $2, $3, $4, $5) RETURNING id`, [t.id, price * 2, branch.id, client.id, cajero.id]);
      await q(`INSERT INTO sale_items (quantity, "unitPrice", subtotal, "saleId", "variantId") VALUES (2, $1, $2, $3, $4)`, [price, price * 2, sale.id, variant.id]);
      await q(`INSERT INTO payments ("tenantId", amount, method, status, date, "saleId") VALUES ($1, $2, 'EFECTIVO', 'APROBADO', now(), $3)`, [t.id, price * 2, sale.id]);
      const reservation = await one(`INSERT INTO reservations ("tenantId", status, date, "registrationDate", "clientId", "branchId")
        VALUES ($1, 'CONFIRMADA', current_date + 2, now(), $2, $3) RETURNING id`, [t.id, client.id, branch.id]);

      return { id: t.id, category: category.id, size: size.id, color: color.id, branch: branch.id, branch2: branch2.id, product: product.id, variant: variant.id, inv: inv.id, admin, cajero, clienteUser, client: client.id, session: session.id, sale: sale.id, reservation: reservation.id, price };
    }

    const A = await makeTenant('A', 'PROFESIONAL', 100);
    const B = await makeTenant('B', 'BASICO', 80);
    console.log(`  Empresa A (id ${A.id}, Plan Profesional) y Empresa B (id ${B.id}, Plan Básico) creadas`);

    const tok = {
      adminA: await login(A.admin.email), adminB: await login(B.admin.email),
      cajeroA: await login(A.cajero.email), clienteA: await login(A.clienteUser.email),
    };

    // ======================================================== AISLAMIENTO
    console.log('\n--- HU: Aislamiento multitenant ---');
    let r = await api('GET', '/products', tok.adminA);
    check('T01 Empresa A solo ve sus productos', r.status === 200 && r.data.length >= 1 && r.data.every((p) => p.tenantId === A.id), r.data);
    r = await api('GET', '/products', tok.adminB);
    check('T02 Empresa B solo ve sus productos', r.status === 200 && r.data.every((p) => p.tenantId === B.id), r.data);
    r = await api('GET', `/products/${B.product}`, tok.adminA);
    check('T03 Producto de B consultado por A → 404', r.status === 404, r);
    r = await api('GET', `/sales/${B.sale}`, tok.adminA);
    check('T04 Venta de B consultada por A → 404', r.status === 404, r);
    r = await api('GET', `/reservations/${A.reservation}`, tok.adminB);
    check('T05 Reserva de A consultada por B → 404', r.status === 404, r);
    r = await api('PATCH', `/reservations/${A.reservation}`, tok.adminB, { status: 'CANCELADA' });
    const resA = await one(`SELECT status FROM reservations WHERE id = $1`, [A.reservation]);
    check('T06 B no puede cancelar la reserva de A', r.status >= 400 && resA.status === 'CONFIRMADA', { status: r.status, resA });
    r = await api('GET', '/sales', tok.adminA);
    check('T07 Listado de ventas de A no contiene ventas de B', r.status === 200 && !r.data.some((s) => s.id === B.sale), r.status);
    r = await api('GET', '/inventory', tok.adminB);
    check('T08 Inventario de B no contiene registros de A', r.status === 200 && r.data.every((i) => i.tenantId === B.id), r.status);
    r = await api('POST', '/products', tok.adminA, { name: `Intruso ${RUN}`, price: 10, categoryId: A.category, tenantId: B.id });
    check('T09 tenantId enviado en el body se ignora (se usa el del JWT)', r.status === 201 && r.data.tenantId === A.id, r.data);
    if (r.data?.id) await q(`DELETE FROM products WHERE id = $1`, [r.data.id]);
    r = await api('POST', '/branches', tok.adminB, { name: 'Tercera', address: 'x', phone: '1', cityId: city.id });
    check('T10 Plan Básico: no permite una 3.ª sucursal (maxBranches = 2)', r.status === 403, r);

    r = await api('POST', '/pos/sales', tok.cajeroA, { paymentMethod: 'EFECTIVO', items: [{ variantId: A.variant, quantity: 1 }] });
    const posSale = r.data?.id ?? r.data?.saleId ?? r.data?.sale?.id;
    const posRow = posSale ? await one(`SELECT "tenantId" FROM sales WHERE id = $1`, [posSale]) : null;
    const posPay = posSale ? await one(`SELECT "tenantId" FROM payments WHERE "saleId" = $1`, [posSale]) : null;
    check('T10b Venta POS online asigna automáticamente el tenant a venta y pago', r.status === 201 && posRow?.tenantId === A.id && posPay?.tenantId === A.id, r.data);

    // ======================================================== BLINDAJE SQL
    console.log('\n--- HU: Blindaje relacional en PostgreSQL ---');
    try {
      await q(`INSERT INTO sales ("tenantId", channel, status, date, subtotal, total, "branchId") VALUES ($1, 'POS', 'COMPLETADA', now(), 1, 1, $2)`, [A.id, B.branch]);
      check('T11 PostgreSQL rechaza venta de A en sucursal de B', false);
    } catch (e) { check('T11 PostgreSQL rechaza venta de A en sucursal de B (fk_sales_branch_tenant)', /fk_sales_branch_tenant/.test(e.message), e.message); }
    try {
      await q(`INSERT INTO payments ("tenantId", amount, method, status, date, "saleId") VALUES ($1, 1, 'EFECTIVO', 'APROBADO', now(), $2)`, [A.id, B.sale]);
      check('T12 PostgreSQL rechaza pago de A sobre venta de B', false);
    } catch (e) { check('T12 PostgreSQL rechaza pago de A sobre venta de B (fk_payments_sale_tenant)', /fk_payments_sale_tenant/.test(e.message), e.message); }
    try {
      await q(`INSERT INTO inventory ("tenantId", stock, reserved, "stockMin", "branchId", "variantId", "updatedAt") VALUES ($1, 1, 0, 0, $2, $3, now())`, [A.id, B.branch, A.variant]);
      check('T13 PostgreSQL rechaza inventario de A en sucursal de B', false);
    } catch (e) { check('T13 PostgreSQL rechaza inventario de A en sucursal de B (fk_inventory_branch_tenant)', /fk_inventory_branch_tenant/.test(e.message), e.message); }

    // ======================================================== OFFLINE / SYNC
    console.log('\n--- HU: Operación offline y sincronización ---');
    const op1 = crypto.randomUUID();
    const saleOp = (id, qty, unitPrice, minutesAgo) => ({
      operationId: id, type: 'POS_CASH_SALE', clientCreatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      cashSessionId: A.session, items: [{ variantId: A.variant, quantity: qty, unitPrice }],
    });
    r = await api('POST', '/sync/batch', tok.cajeroA, { deviceId: 'pos-web-test', operations: [saleOp(op1, 1, 100, 10)] });
    const res1 = r.data?.results?.[0];
    check('T14 Venta en efectivo offline sincronizada (APPLIED)', r.status === 201 && res1?.status === 'APPLIED' && res1?.result?.saleId, r.data);
    const saleRow = res1?.result?.saleId ? await one(`SELECT "tenantId", "offlineOperationId", "cashSessionId" FROM sales WHERE id = $1`, [res1.result.saleId]) : null;
    check('T15 La venta offline queda en el tenant del cajero y vinculada a su caja', saleRow?.tenantId === A.id && saleRow?.offlineOperationId === op1 && saleRow?.cashSessionId === A.session, saleRow);
    const before = await one(`SELECT COUNT(*)::int AS n FROM sales WHERE "tenantId" = $1`, [A.id]);
    r = await api('POST', '/sync/batch', tok.cajeroA, { deviceId: 'pos-web-test', operations: [saleOp(op1, 1, 100, 10)] });
    const after = await one(`SELECT COUNT(*)::int AS n FROM sales WHERE "tenantId" = $1`, [A.id]);
    check('T16 Reenvío de la misma operación → DUPLICATE sin duplicar la venta (idempotencia)', r.data?.results?.[0]?.status === 'DUPLICATE' && before.n === after.n, { r: r.data, before, after });

    // stock restante en sucursal A = 4 → vender 6 a precio desactualizado
    const op2 = crypto.randomUUID();
    r = await api('POST', '/sync/batch', tok.cajeroA, { deviceId: 'pos-web-test', operations: [saleOp(op2, 6, 90, 5)] });
    const res2 = r.data?.results?.[0];
    const types = (res2?.conflicts || []).map((c) => c.type);
    check('T17 Sobreventa offline: venta registrada con conflicto STOCK_SHORTFALL', res2?.status === 'APPLIED_WITH_CONFLICT' && types.includes('STOCK_SHORTFALL'), res2);
    check('T18 Precio cobrado offline distinto → conflicto PRICE_CHANGED', types.includes('PRICE_CHANGED'), types);
    const invA = await one(`SELECT stock FROM inventory WHERE id = $1`, [A.inv]);
    check('T19 El stock nunca queda negativo', invA.stock === 0, invA);
    const paid = await one(`SELECT amount::float FROM payments WHERE "saleId" = $1`, [res2?.result?.saleId || 0]);
    check('T20 No se pierde dinero: el pago registrado es el monto cobrado offline (6 × 90)', paid?.amount === 540, paid);

    // Reserva offline del cliente: sucursal 1 sin stock → rechazada con alternativas; sucursal 2 → aplicada
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const opR1 = crypto.randomUUID();
    const opR2 = crypto.randomUUID();
    r = await api('POST', '/sync/batch', tok.clienteA, {
      deviceId: 'mobile-test', operations: [
        { operationId: opR1, type: 'RESERVATION', clientCreatedAt: new Date().toISOString(), branchId: A.branch, date: tomorrow, items: [{ variantId: A.variant, quantity: 1 }], clientPlatform: 'mobile' },
        { operationId: opR2, type: 'RESERVATION', clientCreatedAt: new Date().toISOString(), branchId: A.branch2, date: tomorrow, items: [{ variantId: A.variant, quantity: 1 }], clientPlatform: 'mobile' },
      ],
    });
    const rr1 = r.data?.results?.find((x) => x.operationId === opR1);
    const rr2 = r.data?.results?.find((x) => x.operationId === opR2);
    check('T21 Reserva offline sin stock → REJECTED (STOCK_UNAVAILABLE) con sucursal alternativa sugerida',
      rr1?.status === 'REJECTED' && rr1?.conflicts?.[0]?.type === 'STOCK_UNAVAILABLE' && rr1.conflicts[0].detail.shortages[0].alternatives.some((a) => a.branchId === A.branch2), rr1);
    check('T22 Reserva offline con stock → APPLIED y stock reservado', rr2?.status === 'APPLIED' && rr2?.result?.reservationId, rr2);

    r = await api('GET', '/sync/conflicts?status=PENDIENTE', tok.adminA);
    const conflictsA = r.data || [];
    check('T23 El ADMIN de A ve sus conflictos pendientes', r.status === 200 && conflictsA.length >= 2, r.status);
    r = await api('GET', '/sync/conflicts', tok.adminB);
    check('T24 El ADMIN de B no ve conflictos de A', r.status === 200 && r.data.length === 0, r.data);
    const shortfall = conflictsA.find((c) => c.type === 'STOCK_SHORTFALL');
    r = await api('PATCH', `/sync/conflicts/${shortfall?.id}/resolve`, tok.adminB, { action: 'ACEPTAR' });
    check('T25 B no puede resolver conflictos de A → 404', r.status === 404, r);
    r = await api('PATCH', `/sync/conflicts/${shortfall?.id}/resolve`, tok.adminA, { action: 'AJUSTAR_INVENTARIO', notes: 'Conteo físico confirmado' });
    check('T26 A resuelve el conflicto de faltante (AJUSTAR_INVENTARIO)', r.status === 200 && r.data.status === 'RESUELTO', r.data);

    // ======================================================== CATÁLOGOS POR EMPRESA
    console.log('\n--- HU: Catálogos propios de cada empresa ---');
    r = await api('GET', '/categories', tok.adminA);
    check('T34 A solo ve sus categorías (no la de B aunque se llame igual)', r.status === 200 && r.data.length >= 1 && r.data.every((c) => c.tenantId === A.id) && !r.data.some((c) => c.id === B.category), r.data);
    const catName = `Abrigos ${RUN}`;
    const cA = await api('POST', '/categories', tok.adminA, { name: catName });
    const cB = await api('POST', '/categories', tok.adminB, { name: catName });
    const cA2 = await api('POST', '/categories', tok.adminA, { name: catName });
    check('T35 Mismo nombre de categoría permitido en dos empresas; duplicado dentro de A → 409',
      cA.status === 201 && cB.status === 201 && cA.data.tenantId === A.id && cB.data.tenantId === B.id && cA2.status === 409, { cA: cA.status, cB: cB.status, cA2: cA2.status });
    r = await api('GET', `/categories/${B.category}`, tok.adminA);
    check('T36 A no puede leer una categoría de B → 404', r.status === 404, r.status);
    r = await api('POST', '/products', tok.adminA, { name: `Intruso ${RUN}`, price: 10, categoryId: B.category });
    check('T37 A no puede crear un producto con la categoría de B → 404', r.status === 404, r);
    try {
      await q(`INSERT INTO products ("tenantId", name, price, active, "categoryId", colorizable, "arEnabled") VALUES ($1, 'X', 1, true, $2, false, false)`, [A.id, B.category]);
      check('T38 PostgreSQL rechaza producto de A con categoría de B', false);
    } catch (e) { check('T38 PostgreSQL rechaza producto de A con categoría de B (fk_products_category_tenant)', /fk_products_category_tenant/.test(e.message), e.message); }

    const nit = `NIT-${RUN}`;
    const sA = await api('POST', '/suppliers', tok.adminA, { name: 'Textiles A', nit });
    const sB = await api('POST', '/suppliers', tok.adminB, { name: 'Textiles B', nit });
    const listB = await api('GET', '/suppliers', tok.adminB);
    const getAB = await api('GET', `/suppliers/${sB.data?.id}`, tok.adminA);
    check('T39 Proveedores por empresa: mismo NIT en A y B, B no ve los de A, A no lee los de B (404)',
      sA.status === 201 && sB.status === 201 && listB.data.every((x) => x.tenantId === B.id) && getAB.status === 404,
      { sA: sA.status, sB: sB.status, getAB: getAB.status });

    const vB = await api('POST', '/variants', tok.adminB, { sku: `SKU-A-${RUN}`, productId: B.product, sizeId: B.size, colorId: B.color });
    const vA = await api('POST', '/variants', tok.adminA, { sku: `SKU-X-${RUN}`, productId: A.product, sizeId: B.size, colorId: A.color });
    check('T40 SKU único por empresa (B reutiliza el SKU de A) y A no puede usar tallas de B (404)',
      vB.status === 201 && vB.data.tenantId === B.id && vA.status === 404, { vB: vB.status, vA: vA.status });
    try {
      await q(`INSERT INTO variants ("tenantId", sku, active, "productId", "sizeId", "colorId") VALUES ($1, $2, true, $3, $4, $5)`, [A.id, `SKU-Z-${RUN}`, B.product, A.size, A.color]);
      check('T41 PostgreSQL rechaza variante de A sobre producto de B', false);
    } catch (e) { check('T41 PostgreSQL rechaza variante de A sobre producto de B (fk_variants_product_tenant)', /fk_variants_product_tenant/.test(e.message), e.message); }

    const seasonA = await api('POST', '/seasons', tok.adminA, { name: `Invierno ${RUN}`, startDate: '2026-06-01', endDate: '2026-08-31' });
    const colB = await api('POST', '/collections', tok.adminB, { name: 'Robo', seasonId: seasonA.data?.id });
    const seasonsB = await api('GET', '/seasons', tok.adminB);
    check('T42 Temporadas por empresa: B no ve ni usa la temporada de A (404)',
      seasonA.status === 201 && colB.status === 404 && !seasonsB.data.some((x) => x.id === seasonA.data.id), { seasonA: seasonA.status, colB: colB.status });

    const promoBad = await api('POST', '/promotions', tok.adminA, { name: 'Mixta', type: 'PERCENTAGE', value: 10, startDate: '2026-01-01', endDate: '2026-12-31', productIds: [A.product, B.product] });
    const promoOk = await api('POST', '/promotions', tok.adminA, { name: `Promo ${RUN}`, type: 'PERCENTAGE', value: 10, startDate: '2026-01-01', endDate: '2026-12-31', productIds: [A.product] });
    const promosB = await api('GET', '/promotions', tok.adminB);
    check('T43 Promociones: A no puede incluir productos de B (404) y B no ve las promociones de A',
      promoBad.status === 404 && promoOk.status === 201 && promoOk.data.tenantId === A.id && !promosB.data.some((x) => x.id === promoOk.data.id),
      { promoBad: promoBad.status, promoOk: promoOk.status });

    r = await api('PATCH', `/sizes/${B.size}`, tok.adminA, { name: 'Hackeada' });
    const sizeB = await one(`SELECT name FROM sizes WHERE id = $1`, [B.size]);
    check('T44 A no puede renombrar tallas de B (404) y la talla de B queda intacta', r.status === 404 && sizeB.name === `M-${RUN}`, { status: r.status, sizeB });

    const cityPatch = await api('PATCH', `/cities/${cityId}`, tok.adminA, { name: 'Renombrada' });
    const cityAnon = await api('POST', '/cities', null, { name: `Anon ${RUN}` });
    check('T45 Ciudades (catálogo compartido): ADMIN de empresa no edita (403) y anónimo no crea (401)',
      cityPatch.status === 403 && cityAnon.status === 401, { cityPatch: cityPatch.status, cityAnon: cityAnon.status });

    r = await api('POST', '/inventory/movement', tok.adminA, { inventoryId: A.inv, type: 'ENTRADA', quantity: 3, observation: 'E2E' });
    const mov = await one(`SELECT "tenantId" FROM inventory_movements WHERE "inventoryId" = $1 ORDER BY id DESC LIMIT 1`, [A.inv]);
    check('T46 Movimiento de inventario queda registrado con el tenant de A', r.status === 201 && mov?.tenantId === A.id, { status: r.status, mov });
    r = await api('POST', '/categories', tok.clienteA, { name: `Cliente ${RUN}` });
    check('T47 Un CLIENTE no puede modificar el catálogo de su empresa → 403', r.status === 403, r.status);

    // ======================================================== IA GENERATIVA
    console.log('\n--- HU: Reportes generativos en lenguaje natural ---');
    r = await api('POST', '/ai-reports/query', tok.adminA, { question: '¿Cuáles fueron los 3 vestidos más vendidos este mes?' });
    check('T27 Reporte en lenguaje natural responde con datos reales', r.status === 201 && r.data.rows.length >= 1 && typeof r.data.narrative === 'string', r.data);
    check('T28 El reporte solo contiene productos de la Empresa A', r.data?.rows?.every((row) => row.label.includes(' A ')), r.data?.rows);
    r = await api('POST', '/ai-reports/query', tok.adminA, { question: "ventas por sucursal'; DROP TABLE sales; --" });
    const salesStill = await one(`SELECT to_regclass('public.sales') AS t`);
    check('T29 Intento de inyección SQL en la pregunta no afecta la BD', r.status < 500 && !!salesStill.t, r.status);
    r = await api('POST', '/ai-reports/query', tok.adminB, { question: 'ventas de este mes' });
    check('T30 Plan Básico no accede a reportes generativos → 403', r.status === 403, r);

    // ======================================================== ML
    console.log('\n--- HU: Analítica con Machine Learning ---');
    r = await api('GET', '/analytics/demand-forecast?weeks=8&horizon=4', tok.adminA);
    check('T31 Pronóstico de demanda (supervisado) solo con productos de A', r.status === 200 && r.data.products.length >= 1 && r.data.products.every((p) => p.productName.includes(' A ')), r.data);
    r = await api('GET', '/analytics/customer-segments?k=2', tok.adminA);
    check('T32 Segmentación RFM K-Means (no supervisado) responde', r.status === 200 && r.data.learningType === 'NO_SUPERVISADO', r.data);
    r = await api('GET', '/analytics/demand-forecast', tok.adminB);
    check('T33 Plan Básico no accede a analítica ML → 403', r.status === 403, r.status);
  } catch (err) {
    failed++;
    console.error('\n✖ Error inesperado:', err);
  } finally {
    // ---------- Limpieza de datos de prueba
    for (const t of created.tenants) {
      await q(`DELETE FROM sync_conflicts WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM offline_sync_operations WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM ai_report_logs WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM inventory_movements WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM notifications WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM notification_devices WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM product_promotions WHERE "promotionId" IN (SELECT id FROM promotions WHERE "tenantId" = $1)`, [t]).catch(() => {});
      await q(`DELETE FROM promotions WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM suppliers WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM payments WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM sale_items WHERE "saleId" IN (SELECT id FROM sales WHERE "tenantId" = $1)`, [t]).catch(() => {});
      await q(`DELETE FROM reservation_items WHERE "reservationId" IN (SELECT id FROM reservations WHERE "tenantId" = $1)`, [t]).catch(() => {});
      await q(`DELETE FROM sales WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM reservations WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM cash_sessions WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM inventory WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM variants WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM products WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM collections WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM seasons WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM categories WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM sizes WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM colors WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM clients WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = $1)`, [t]).catch(() => {});
      await q(`DELETE FROM users WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM branches WHERE "tenantId" = $1`, [t]).catch(() => {});
      await q(`DELETE FROM subscription_history WHERE tenant_id = $1`, [t]).catch(() => {});
      await q(`DELETE FROM subscriptions WHERE tenant_id = $1`, [t]).catch(() => {});
      await q(`DELETE FROM tenants WHERE id = $1`, [t]).catch(() => {});
    }
    await q(`DELETE FROM cities WHERE name LIKE $1`, [`%${RUN}`]).catch(() => {});
    await db.end();
    console.log(`\n=== RESULTADO: ${passed} pruebas aprobadas, ${failed} fallidas ===\n`);
    process.exitCode = failed ? 1 : 0;
  }
}

main();
