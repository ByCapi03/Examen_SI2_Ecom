/**
 * PRUEBAS E2E — Planes (mensual/anual, límites, vigencia) y panel SuperAdmin.
 *
 * Requisitos: backend en ejecución (API_URL) con datos demo y con SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
 * definidos en su entorno; pasar las mismas credenciales a este script:
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... API_URL=http://localhost:3000 node scripts/test-planes-superadmin.js
 * Crea una empresa de prueba y la elimina al final.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const API = process.env.API_URL || 'http://localhost:3000';
const RUN = Date.now().toString(36);
let ok = 0, fail = 0;
const check = (id, name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`  ${cond ? '✔' : '✘'} ${id} ${name} ${cond ? '' : extra}`); };
async function call(method, p, token, body) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}
const login = async (email, password = '123456') => (await call('POST', '/auth/login', null, { email, password })).data?.accessToken;

(async () => {
  const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();
  const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
  let T = null;
  try {
    console.log('--- Catálogo de planes ---');
    const plans = (await call('GET', '/saas/plans')).data || [];
    const by = Object.fromEntries(plans.map((p) => [p.code, p]));
    check('S01', 'Cada plan de pago tiene precio anual', ['STARTER', 'PROFESIONAL', 'EMPRESARIAL'].every((c) => Number(by[c]?.priceYearly) > 0));
    check('S02', 'El anual cuesta menos que 12 meses (descuento)', ['STARTER', 'PROFESIONAL', 'EMPRESARIAL'].every((c) => Number(by[c].priceYearly) < Number(by[c].priceMonthly) * 12));
    check('S03', 'Básico limita sucursales, productos y usuarios', by.BASICO?.maxBranches === 1 && by.BASICO?.maxProducts === 50 && by.BASICO?.maxUsers === 3);
    check('S04', 'Empresarial es ilimitado en productos y usuarios', by.EMPRESARIAL?.maxProducts === null && by.EMPRESARIAL?.maxUsers === null);

    console.log('--- Acceso SuperAdmin ---');
    const sa = await login(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD);
    check('S05', 'El SuperAdmin inicia sesión', !!sa);
    const admLuna = await login('admin@luna.com');
    check('S06', 'Un ADMIN de empresa no accede al panel de plataforma → 403', (await call('GET', '/saas/admin/overview', admLuna)).status === 403);
    check('S07', 'Sin sesión → 401', (await call('GET', '/saas/admin/tenants')).status === 401);
    const ov = (await call('GET', '/saas/admin/overview', sa)).data;
    check('S08', 'Resumen con empresas, ingresos recurrentes y planes', ov?.tenants >= 2 && ov?.mrr > 0 && Array.isArray(ov?.byPlan), JSON.stringify(ov));
    const list = (await call('GET', '/saas/admin/tenants', sa)).data || [];
    check('S09', 'El listado muestra las empresas y oculta la interna de plataforma', list.some((t) => t.slug === 'luna') && !list.some((t) => t.slug === 'plataforma'));
    check('S10', 'Cada empresa trae plan, ciclo, vigencia y consumo', list.every((t) => t.planCode && t.billingCycle && 'endDate' in t && typeof t.branches === 'number'));

    console.log('--- Empresa de prueba (plan Básico) ---');
    const [city] = await q(`SELECT id FROM cities LIMIT 1`);
    const [cat] = await q(`SELECT id FROM categories LIMIT 1`);
    const [t] = await q(`INSERT INTO tenants (slug, name, active, "createdAt", "updatedAt") VALUES ($1,$2,true,now(),now()) RETURNING id`, [`zz-plan-${RUN}`, `ZZ Plan ${RUN}`]);
    T = t.id;
    const [basico] = await q(`SELECT id FROM plans WHERE code='BASICO'`);
    await q(`INSERT INTO subscriptions (tenant_id, plan_id, status, billing_cycle, start_date) VALUES ($1,$2,'ACTIVE','MONTHLY',now())`, [T, basico.id]);
    const hash = await bcrypt.hash('123456', 10);
    const [adminRole] = await q(`SELECT id FROM roles WHERE name='ADMIN'`);
    const [cajRole] = await q(`SELECT id FROM roles WHERE name='CAJERO'`);
    const [u] = await q(`INSERT INTO users (name,email,"passwordHash","tenantId",active,"mustChangePassword","emailVerified") VALUES ('Admin ZZ',$1,$2,$3,true,false,true) RETURNING id`, [`adminzz.${RUN}@test.com`, hash, T]);
    await q(`INSERT INTO user_roles ("userId","roleId",active) VALUES ($1,$2,true)`, [u.id, adminRole.id]);
    const adm = await login(`adminzz.${RUN}@test.com`);
    check('S11', 'El admin de la empresa de prueba inicia sesión', !!adm);

    let r = await call('POST', '/branches', adm, { name: 'Central', address: 'x', phone: '1', cityId: city.id });
    check('S12', 'Básico permite la 1.ª sucursal', r.status === 201, JSON.stringify(r.data));
    const branchId = r.data?.id;
    r = await call('POST', '/branches', adm, { name: 'Segunda', address: 'x', phone: '1', cityId: city.id });
    check('S13', 'Básico rechaza la 2.ª sucursal → 403', r.status === 403 && /máximo/.test(r.data?.message || ''), JSON.stringify(r.data));

    for (let i = 0; i < 50; i++) await q(`INSERT INTO products ("tenantId", name, price, active, "categoryId", colorizable, "arEnabled") VALUES ($1,$2,10,true,$3,false,false)`, [T, `P${i} ${RUN}`, cat.id]);
    r = await call('POST', '/products', adm, { name: `Extra ${RUN}`, price: 10, categoryId: cat.id });
    check('S14', 'Básico rechaza el producto 51 → 403', r.status === 403 && /productos/.test(r.data?.message || ''), JSON.stringify(r.data));

    // usuarios: admin (1) + 2 cajeros = 3 (máximo); el 4.º se rechaza
    for (const n of [1, 2]) {
      r = await call('POST', '/users', adm, { name: `Cajero ${n}`, email: `cajzz${n}.${RUN}@test.com`, roleName: 'CAJERO', branchId });
      if (n === 2) check('S15', 'Básico permite hasta 3 usuarios internos', r.status === 201, JSON.stringify(r.data));
    }
    r = await call('POST', '/users', adm, { name: 'Cajero 3', email: `cajzz3.${RUN}@test.com`, roleName: 'CAJERO', branchId });
    check('S16', 'Básico rechaza el 4.º usuario interno → 403', r.status === 403 && /usuarios/.test(r.data?.message || ''), JSON.stringify(r.data));

    console.log('--- Cambio de plan, ciclo y vigencia ---');
    r = await call('PATCH', `/saas/admin/tenants/${T}/plan`, sa, { planCode: 'STARTER', billingCycle: 'YEARLY' });
    const sub = r.data?.subscription;
    check('S17', 'El SuperAdmin pasa la empresa a Starter anual', r.status === 200 && sub?.billingCycle === 'YEARLY', JSON.stringify(r.data));
    const days = sub?.daysLeft;
    check('S18', 'El plan anual vence en ~1 año', days >= 364 && days <= 366, `(${days} días)`);
    r = await call('POST', '/branches', adm, { name: 'Segunda', address: 'x', phone: '1', cityId: city.id });
    check('S19', 'Con Starter ya se permite la 2.ª sucursal', r.status === 201, JSON.stringify(r.data));
    r = await call('PATCH', '/saas/tenants/me/plan', adm, { planCode: 'BASICO' });
    check('S20', 'Bajar a Básico con más recursos de los permitidos → 409', r.status === 409 && /usa/.test(r.data?.message || ''), JSON.stringify(r.data));
    r = await call('PATCH', '/saas/tenants/me/plan', adm, { planCode: 'STARTER', billingCycle: 'MONTHLY' });
    check('S21', 'El admin puede renovar en ciclo mensual (~30 días)', r.status === 200 && r.data?.subscription?.billingCycle === 'MONTHLY' && r.data.subscription.daysLeft >= 27 && r.data.subscription.daysLeft <= 32, JSON.stringify(r.data?.subscription));
    const hist = await q(`SELECT action, notes FROM subscription_history WHERE tenant_id=$1 ORDER BY id`, [T]);
    check('S22', 'El historial registra cambios con ciclo y precio', hist.some((h) => /anual/.test(h.notes || '')) && hist.some((h) => /USD/.test(h.notes || '')), JSON.stringify(hist));

    console.log('--- Vencimiento ---');
    await q(`UPDATE subscriptions SET end_date = now() - interval '1 day' WHERE tenant_id=$1`, [T]);
    r = await call('GET', '/saas/tenants/me', adm);
    check('S23', 'Una suscripción pasada de fecha se muestra EXPIRED', r.data?.subscriptionStatus === 'EXPIRED', JSON.stringify(r.data?.subscription));
    r = await call('POST', '/branches', adm, { name: 'Tercera', address: 'x', phone: '1', cityId: city.id });
    check('S24', 'Con la suscripción vencida no se pueden crear recursos → 402', r.status === 402, JSON.stringify(r.data));
    r = await call('POST', '/sync/batch', adm, { operations: [] });
    check('S24b', 'Vencida: la sincronización offline sigue aceptándose (no bloquea ventas ya hechas)', r.status !== 402 && r.status !== 403, JSON.stringify(r.data));
    r = await call('PATCH', `/saas/admin/tenants/${T}/extend`, sa, { days: 10 });
    check('S25', 'El SuperAdmin extiende 10 días y la reactiva', r.status === 200 && r.data?.subscriptionStatus === 'ACTIVE' && r.data.subscription.daysLeft >= 9, JSON.stringify(r.data?.subscription));

    console.log('--- Suspensión ---');
    r = await call('PATCH', `/saas/admin/tenants/${T}/active`, sa, { active: false });
    check('S26', 'El SuperAdmin suspende la empresa', r.status === 200 && r.data?.active === false);
    check('S27', 'El admin suspendido ya no puede iniciar sesión', !(await login(`adminzz.${RUN}@test.com`)));
    check('S28', 'Su sesión previa deja de funcionar → 403', (await call('GET', '/branches', adm)).status === 403);
    check('S28b', 'El catálogo móvil (por token) de una empresa suspendida también se bloquea → 403', (await call('GET', '/store/products', adm)).status === 403);
    { const st = await call('GET', `/saas/tenants/by-slug/zz-plan-${RUN}`); check('S29', 'Su tienda pública responde «no disponible» (403 TENANT_SUSPENDED)', st.status === 403 && st.data?.code === 'TENANT_SUSPENDED', JSON.stringify(st.data)); }
    await call('PATCH', `/saas/admin/tenants/${T}/active`, sa, { active: true });
    check('S30', 'Reactivada, vuelve a funcionar', !!(await login(`adminzz.${RUN}@test.com`)));
    check('S31', 'Suspender una empresa inexistente → 404', (await call('PATCH', '/saas/admin/tenants/999999/active', sa, { active: false })).status === 404);
  } finally {
    if (T) {
      for (const sql of [
        `DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE "tenantId"=$1)`, `DELETE FROM users WHERE "tenantId"=$1`,
        `DELETE FROM products WHERE "tenantId"=$1`, `DELETE FROM branches WHERE "tenantId"=$1`,
        `DELETE FROM subscription_history WHERE tenant_id=$1`, `DELETE FROM subscriptions WHERE tenant_id=$1`, `DELETE FROM tenants WHERE id=$1`,
      ]) await db.query(sql, [T]).catch((e) => console.log('  (aviso limpieza)', e.message));
    }
    await db.end();
  }
  console.log(`\n=== RESULTADO: ${ok} pruebas aprobadas, ${fail} fallidas ===`);
  process.exit(fail ? 1 : 0);
})();
