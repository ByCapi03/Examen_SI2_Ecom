/**
 * PRUEBAS E2E — Cobro por QR en el POS (el cliente escanea y paga el monto).
 *   API_URL=http://localhost:3000 node scripts/test-pos-qr.js   (datos demo; empresa "luna")
 * Deja el stock y la caja como estaban.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');
const API = process.env.API_URL || 'http://localhost:3000';
let ok = 0, fail = 0;
const check = (id, name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`  ${cond ? '✔' : '✘'} ${id} ${name} ${cond ? '' : extra}`); };
async function call(method, p, token, body, extraHeaders) {
  const h = { 'content-type': 'application/json', ...(extraHeaders || {}) };
  if (token) h.authorization = `Bearer ${token}`;
  const res = await fetch(API + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}
const login = async (email) => (await call('POST', '/auth/login', null, { email, password: '123456' })).data?.accessToken;

(async () => {
  const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();
  const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
  const inv = async (variantId, branchId) => (await q(`SELECT stock, reserved FROM inventory WHERE "variantId"=$1 AND "branchId"=$2`, [variantId, branchId]))[0];
  try {
    const tok = await login('cajero1@luna.com');
    const tok2 = await login('cajero2@luna.com');
    let cur = (await call('GET', '/cash-sessions/current', tok)).data;
    if (cur?.status !== 'OPEN') await call('POST', '/cash-sessions/open', tok, { initialAmount: 100 });
    cur = (await call('GET', '/cash-sessions/current', tok)).data;
    check('Q01', 'El cajero tiene una caja abierta', cur?.status === 'OPEN');
    const qrBefore = Number(cur?.session?.summary?.qrSales ?? 0);

    const products = (await call('GET', '/pos/products', tok)).data || [];
    const p = products.find((x) => x.available >= 4);
    const [{ branchId }] = await q(`SELECT "branchId" FROM users WHERE email='cajero1@luna.com'`);
    check('Q02', 'Hay un producto con stock para la prueba', !!p);
    const base = await inv(p.variantId, branchId);

    let r = await call('POST', '/pos/sales', tok, { paymentMethod: 'QR', items: [{ variantId: p.variantId, quantity: 2 }] });
    const sale = r.data;
    check('Q03', 'Cobrar con QR crea la venta PENDIENTE con su código QR', r.status === 201 && sale?.status === 'PENDIENTE' && /\/qr-payment\//.test(sale?.qr?.confirmationUrl || '') && /^data:image\/png/.test(sale?.qr?.qrImage || ''), JSON.stringify(r.data)?.slice(0, 200));
    // La dirección del QR sale del origen desde el que se abrió el POS (p. ej. la IP de la laptop), salvo que la fije el entorno
    const lan = 'http://192.168.0.77:5173';
    const fixed = (process.env.QR_PUBLIC_WEB_URL || (/localhost|127\.0\.0\.1/.test(process.env.FRONTEND_URL || 'localhost') ? '' : process.env.FRONTEND_URL) || '').replace(/\/+$/, '');
    const rLan = await call('POST', '/pos/sales', tok, { paymentMethod: 'QR', items: [{ variantId: p.variantId, quantity: 1 }] }, { origin: lan });
    const urlLan = rLan.data?.qr?.confirmationUrl || '';
    check('Q03b', 'El QR usa la dirección desde la que se abrió el POS (o la del entorno si está fijada)', rLan.status === 201 && urlLan.startsWith((fixed || lan) + '/qr-payment/'), urlLan.slice(0, 80));
    if (rLan.data?.id) await call('POST', `/pos/sales/${rLan.data.id}/cancel-qr`, tok);
    const token = (sale?.qr?.confirmationUrl || '').split('/qr-payment/')[1];
    const mid = await inv(p.variantId, branchId);
    check('Q04', 'El stock queda RESERVADO (no descontado) mientras no se paga', mid.reserved === base.reserved + 2 && mid.stock === base.stock);
    check('Q05', 'El cajero ve el cobro como PENDIENTE', (await call('GET', `/pos/sales/${sale.id}/payment`, tok)).data?.status === 'PENDIENTE');
    check('Q06', 'Otro cajero no puede consultar esa venta → 404', (await call('GET', `/pos/sales/${sale.id}/payment`, tok2)).status === 404);

    const info = await call('GET', `/payments/qr/confirm/${token}`);
    check('Q07', 'La página que abre el cliente muestra el monto a pagar', info.status === 200 && Number(info.data?.amount) === Number(sale.total) && info.data?.status === 'PENDIENTE', JSON.stringify(info.data));

    r = await call('POST', `/payments/qr/confirm/${token}`);
    check('Q08', 'El cliente confirma el pago', r.status === 201 || r.status === 200, JSON.stringify(r.data));
    const after = await inv(p.variantId, branchId);
    check('Q09', 'Al pagar se descuenta el stock y se libera la reserva', after.stock === base.stock - 2 && after.reserved === base.reserved, JSON.stringify({ base, after }));
    const st = (await call('GET', `/pos/sales/${sale.id}/payment`, tok)).data;
    check('Q10', 'El cajero ve el cobro APROBADO y la venta COMPLETADA', st?.status === 'APROBADO' && st?.saleStatus === 'COMPLETADA', JSON.stringify(st));
    r = await call('POST', `/payments/qr/confirm/${token}`);
    check('Q11', 'Confirmar dos veces no duplica nada (idempotente)', r.data?.alreadyProcessed === true || r.data?.status === 'APROBADO');
    check('Q12', 'El stock no cambió con la segunda confirmación', JSON.stringify(await inv(p.variantId, branchId)) === JSON.stringify(after));
    const cur2 = (await call('GET', '/cash-sessions/current', tok)).data;
    check('Q13', 'El arqueo de caja suma la venta por QR', Number(cur2?.session?.summary?.qrSales ?? 0) === qrBefore + Number(sale.total), `${qrBefore} → ${cur2?.session?.summary?.qrSales}`);

    // Cancelación por el cajero
    r = await call('POST', '/pos/sales', tok, { paymentMethod: 'QR', items: [{ variantId: p.variantId, quantity: 1 }] });
    const s2 = r.data;
    const c = await call('POST', `/pos/sales/${s2.id}/cancel-qr`, tok);
    check('Q14', 'El cajero puede cancelar un QR pendiente y se libera el stock', (c.status === 201 || c.status === 200) && JSON.stringify(await inv(p.variantId, branchId)) === JSON.stringify(after), JSON.stringify(c.data));
    const t2 = (s2.qr.confirmationUrl).split('/qr-payment/')[1];
    check('Q15', 'Un QR cancelado ya no se puede pagar', (await call('POST', `/payments/qr/confirm/${t2}`)).status === 400);

    // Expiración
    r = await call('POST', '/pos/sales', tok, { paymentMethod: 'QR', items: [{ variantId: p.variantId, quantity: 1 }] });
    const s3 = r.data;
    await q(`UPDATE payments SET "expiresAt" = now() - interval '1 minute' WHERE "saleId"=$1`, [s3.id]);
    const ex = (await call('GET', `/pos/sales/${s3.id}/payment`, tok)).data;
    check('Q16', 'Un QR vencido se rechaza y libera el stock', ex?.status === 'RECHAZADO' && JSON.stringify(await inv(p.variantId, branchId)) === JSON.stringify(after), JSON.stringify(ex));

    // Stock insuficiente
    r = await call('POST', '/pos/sales', tok, { paymentMethod: 'QR', items: [{ variantId: p.variantId, quantity: 9999 }] });
    check('Q17', 'No se genera QR si no hay stock suficiente → 409', r.status === 409, JSON.stringify(r.data));

    // Efectivo sigue inmediato
    r = await call('POST', '/pos/sales', tok, { paymentMethod: 'EFECTIVO', items: [{ variantId: p.variantId, quantity: 1 }] });
    check('Q18', 'Efectivo sigue cobrándose al instante', r.status === 201 && r.data?.status === 'COMPLETADA' && !r.data?.qr);
    const cash = await inv(p.variantId, branchId);
    // restaurar stock
    await q(`UPDATE inventory SET stock = $1, reserved = $2 WHERE "variantId"=$3 AND "branchId"=$4`, [base.stock, base.reserved, p.variantId, branchId]);
    void cash;
  } finally { await db.end(); }
  console.log(`\n=== RESULTADO: ${ok} pruebas aprobadas, ${fail} fallidas ===`);
  process.exit(fail ? 1 : 0);
})();
