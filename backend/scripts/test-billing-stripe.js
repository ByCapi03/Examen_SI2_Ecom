/**
 * PRUEBAS E2E — Cobro de planes con Stripe (contra el Stripe SIMULADO scripts/mock-stripe.js).
 *
 * 1) node scripts/mock-stripe.js
 * 2) arrancar el backend con:
 *      STRIPE_SECRET_KEY=sk_test_mockserver STRIPE_WEBHOOK_SECRET=whsec_testsecret
 *      STRIPE_API_HOST=localhost STRIPE_API_PORT=12111 STRIPE_API_PROTOCOL=http
 *      SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=...
 * 3) API_URL=... node scripts/test-billing-stripe.js
 * Crea una empresa de prueba y la elimina al final.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const bcrypt = require('bcrypt');
const Stripe = require('stripe');
const { Client } = require('pg');
const API = process.env.API_URL || 'http://localhost:3000';
const MOCK = `http://localhost:${process.env.MOCK_STRIPE_PORT || 12111}`;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_testsecret';
const RUN = Date.now().toString(36);
let ok = 0, fail = 0;
const check = (id, name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`  ${cond ? '✔' : '✘'} ${id} ${name} ${cond ? '' : extra}`); };
async function call(method, p, token, body, headers = {}, raw) {
  const h = { 'content-type': 'application/json', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  const res = await fetch(API + p, { method, headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  let data = null; try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}
const login = async (email) => (await call('POST', '/auth/login', null, { email, password: '123456' })).data?.accessToken;
const mock = (p) => fetch(MOCK + p, { method: 'POST' });

(async () => {
  const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();
  const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
  let T = null, T2 = null, regSlug = null;
  try {
    const cfg = (await call('GET', '/saas/billing/config')).data;
    check('B01', 'Con clave de Stripe el cobro real está activo', cfg?.stripeEnabled === true && cfg?.mode === 'STRIPE', JSON.stringify(cfg));

    const hash = await bcrypt.hash('123456', 10);
    const [adminRole] = await q(`SELECT id FROM roles WHERE name='ADMIN'`);
    const mkTenant = async (tag) => {
      const [t] = await q(`INSERT INTO tenants (slug, name, active, "createdAt", "updatedAt") VALUES ($1,$2,true,now(),now()) RETURNING id`, [`zz-bill-${tag}-${RUN}`, `ZZ Bill ${tag} ${RUN}`]);
      const [basico] = await q(`SELECT id FROM plans WHERE code='BASICO'`);
      await q(`INSERT INTO subscriptions (tenant_id, plan_id, status, billing_cycle, start_date) VALUES ($1,$2,'ACTIVE','MONTHLY',now())`, [t.id, basico.id]);
      const [u] = await q(`INSERT INTO users (name,email,"passwordHash","tenantId",active,"mustChangePassword","emailVerified") VALUES ('Admin',$1,$2,$3,true,false,true) RETURNING id`, [`billing${tag}.${RUN}@test.com`, hash, t.id]);
      await q(`INSERT INTO user_roles ("userId","roleId",active) VALUES ($1,$2,true)`, [u.id, adminRole.id]);
      return t.id;
    };
    T = await mkTenant('a'); T2 = await mkTenant('b');
    const adm = await login(`billinga.${RUN}@test.com`);
    const adm2 = await login(`billingb.${RUN}@test.com`);

    let r = await call('PATCH', '/saas/tenants/me/plan', adm, { planCode: 'STARTER', billingCycle: 'MONTHLY' });
    check('B02', 'El endpoint antiguo ya no concede planes de pago sin pagar → 402', r.status === 402, JSON.stringify(r.data));

    r = await call('POST', '/saas/billing/checkout', adm, { planCode: 'STARTER', billingCycle: 'YEARLY' });
    const sid = r.data?.sessionId;
    check('B03', 'Checkout devuelve la URL de pago de Stripe', r.status === 201 && r.data?.mode === 'stripe' && /checkout\.stripe/.test(r.data?.url || '') && /^cs_test_/.test(sid || ''), JSON.stringify(r.data));
    check('B04', 'Hasta pagar, el plan sigue siendo Básico', (await call('GET', '/saas/tenants/me', adm)).data?.plan?.code === 'BASICO');

    r = await call('POST', '/saas/billing/confirm', adm, { sessionId: sid });
    check('B05', 'Confirmar antes de pagar → 402 y el plan no cambia', r.status === 402 && (await call('GET', '/saas/tenants/me', adm)).data?.plan?.code === 'BASICO', JSON.stringify(r.data));

    check('B06', 'Otra empresa no puede reclamar ese pago → 403', (await call('POST', '/saas/billing/confirm', adm2, { sessionId: sid })).status === 403);

    await mock(`/_pay/${sid}`);
    r = await call('POST', '/saas/billing/confirm', adm, { sessionId: sid });
    const me = (await call('GET', '/saas/tenants/me', adm)).data;
    check('B07', 'Pagado y confirmado: se aplica Starter anual', r.status === 201 && r.data?.applied === true && me?.plan?.code === 'STARTER' && me?.subscription?.billingCycle === 'YEARLY' && me.subscription.daysLeft >= 364, JSON.stringify(r.data?.tenant?.subscription));

    const before = (await q(`SELECT count(*)::int n FROM subscription_history WHERE tenant_id=$1`, [T]))[0].n;
    r = await call('POST', '/saas/billing/confirm', adm, { sessionId: sid });
    const after = (await q(`SELECT count(*)::int n FROM subscription_history WHERE tenant_id=$1`, [T]))[0].n;
    check('B08', 'Confirmar dos veces no duplica ni extiende el plan (idempotente)', r.data?.applied === false && before === after, JSON.stringify(r.data?.applied));

    const hist = await q(`SELECT notes FROM subscription_history WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1`, [T]);
    check('B09', 'El historial guarda la referencia del pago de Stripe', /STRIPE cs_test_/.test(hist[0]?.notes || '') && /USD 290/.test(hist[0]?.notes || ''), hist[0]?.notes);

    // Manipulación de monto
    r = await call('POST', '/saas/billing/checkout', adm, { planCode: 'PROFESIONAL', billingCycle: 'MONTHLY' });
    await mock(`/_amount/${r.data.sessionId}/100`); await mock(`/_pay/${r.data.sessionId}`);
    r = await call('POST', '/saas/billing/confirm', adm, { sessionId: r.data.sessionId });
    check('B10', 'Si el monto pagado no coincide con el precio, no se aplica el plan → 400', r.status === 400 && (await call('GET', '/saas/tenants/me', adm)).data?.plan?.code === 'STARTER', JSON.stringify(r.data));

    // Webhook firmado
    const stripe = new Stripe('sk_test_x');
    const w = await call('POST', '/saas/billing/checkout', adm, { planCode: 'PROFESIONAL', billingCycle: 'MONTHLY' });
    await mock(`/_pay/${w.data.sessionId}`);
    const session = await (await fetch(`${MOCK}/v1/checkout/sessions/${w.data.sessionId}`)).json();
    const payload = JSON.stringify({ id: 'evt_test_1', object: 'event', type: 'checkout.session.completed', data: { object: session } });
    r = await call('POST', '/saas/billing/webhook', null, null, { 'stripe-signature': 't=1,v1=firmafalsa' }, payload);
    check('B11', 'Webhook con firma inválida → 400 y no aplica nada', r.status === 400 && (await call('GET', '/saas/tenants/me', adm)).data?.plan?.code === 'STARTER', JSON.stringify(r.data));
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
    r = await call('POST', '/saas/billing/webhook', null, null, { 'stripe-signature': header }, payload);
    check('B12', 'Webhook firmado aplica el plan aunque el usuario no vuelva al sitio', r.status === 201 && (await call('GET', '/saas/tenants/me', adm)).data?.plan?.code === 'PROFESIONAL', JSON.stringify(r.data));

    // Límites y degradación
    for (let i = 0; i < 4; i++) {
      const [city] = await q(`SELECT id FROM cities LIMIT 1`);
      await q(`INSERT INTO branches ("tenantId", name, address, phone, "cityId", active) VALUES ($1,$2,'x','1',$3,true)`, [T, `S${i}`, city.id]);
    }
    r = await call('POST', '/saas/billing/checkout', adm, { planCode: 'STARTER', billingCycle: 'MONTHLY' });
    check('B13', 'No se cobra un plan al que la empresa no cabe (4 sucursales en Starter) → 409', r.status === 409, JSON.stringify(r.data));
    await q(`DELETE FROM branches WHERE "tenantId"=$1`, [T]);
    r = await call('POST', '/saas/billing/checkout', adm, { planCode: 'BASICO' });
    check('B14', 'Bajar al plan gratuito no requiere pago', r.status === 201 && r.data?.mode === 'direct' && r.data.tenant?.plan?.code === 'BASICO', JSON.stringify(r.data?.mode));

    // Registro con plan de pago
    regSlug = `zz-reg-${RUN}`;
    r = await call('POST', '/saas/tenants/register', null, { name: `ZZ Reg ${RUN}`, slug: regSlug, planCode: 'PROFESIONAL', billingCycle: 'YEARLY' });
    check('B15', 'Registrar con plan de pago crea la empresa en Básico y exige pagar después', r.status === 201 && r.data?.plan?.code === 'BASICO' && r.data?.pendingPlan?.code === 'PROFESIONAL' && r.data.pendingPlan.billingCycle === 'YEARLY', JSON.stringify(r.data));

    r = await call('POST', '/saas/billing/confirm', adm, { sessionId: 'no-valido' });
    check('B16', 'Un identificador de sesión inválido → 400', r.status === 400);
  } finally {
    const slugs = [T, T2].filter(Boolean);
    const [reg] = regSlug ? await q(`SELECT id FROM tenants WHERE slug=$1`, [regSlug]) : [];
    if (reg) slugs.push(reg.id);
    for (const id of slugs) {
      for (const sql of [`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE "tenantId"=$1)`, `DELETE FROM users WHERE "tenantId"=$1`, `DELETE FROM branches WHERE "tenantId"=$1`,
        `DELETE FROM subscription_history WHERE tenant_id=$1`, `DELETE FROM subscriptions WHERE tenant_id=$1`, `DELETE FROM tenants WHERE id=$1`]) await db.query(sql, [id]).catch(() => {});
    }
    await db.end();
  }
  console.log(`\n=== RESULTADO: ${ok} pruebas aprobadas, ${fail} fallidas ===`);
  process.exit(fail ? 1 : 0);
})();
