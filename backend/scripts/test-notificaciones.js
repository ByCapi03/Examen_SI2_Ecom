/**
 * PRUEBAS E2E — Alerta de stock bajo (notificaciones internas + estado de push).
 *
 * Requisitos: backend en ejecución (API_URL) con datos demo (npm run seed:demo).
 *   API_URL=http://localhost:3000 node scripts/test-notificaciones.js
 * Modifica y RESTAURA el stock de un inventario de la empresa "luna".
 */
const API = process.env.API_URL || 'http://localhost:3000';
let ok = 0, fail = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}
const check = (id, name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`  ${cond ? '✔' : '✘'} ${id} ${name} ${cond ? '' : extra}`); };
const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: '123456' } })).data;
const digest = async (token) => ((await call('GET', '/notifications/my', { token })).data || []).filter((n) => n.type === 'LOW_STOCK_DIGEST');
const lowStock = async (token) => ((await call('GET', '/notifications/my', { token })).data || []).filter((n) => n.type === 'LOW_STOCK');

(async () => {
  const admin = await login('admin@luna.com');
  const enc1 = await login('encargado1@luna.com');
  const enc2 = await login('encargado2@luna.com');
  const cli = await login('cliente@luna.com');
  check('N01', 'Se pudo iniciar sesión con administrador y encargados', !!(admin?.accessToken && enc1?.accessToken && enc2?.accessToken));

  // Resumen de stock YA crítico (aunque nadie lo haya movido): una notificación por sucursal y destinatario
  const d0 = (await digest(enc1.accessToken)).length, a0 = (await digest(admin.accessToken)).length, e20 = (await digest(enc2.accessToken)).length;
  const sy = await call('POST', '/notifications/low-stock/sync', { token: enc1.accessToken });
  check('N12', 'La revisión de stock crítico responde', sy.status === 201 || sy.status === 200, JSON.stringify(sy.data));
  const d1 = await digest(enc1.accessToken);
  check('N13', 'El encargado recibe el resumen de su sucursal (productos críticos)', d1.length === d0 + 1 && /crítico/i.test(d1[0]?.title || ''), d1[0]?.title);
  check('N14', 'El administrador también recibe el resumen', (await digest(admin.accessToken)).length >= a0 + 1);
  await call('POST', '/notifications/low-stock/sync', { token: enc1.accessToken });
  check('N15', 'No se repite el resumen dentro de 24 h', (await digest(enc1.accessToken)).length === d1.length);
  check('N16', 'Un cliente no genera ni recibe resúmenes', (await call('POST', '/notifications/low-stock/sync', { token: cli.accessToken })).data?.notified === 0 && (await digest(cli.accessToken)).length === 0);

  const inv = (await call('GET', '/inventory', { token: enc1.accessToken })).data;
  const list = Array.isArray(inv) ? inv : inv?.data || [];
  const item = list.find((i) => i.stock - i.reserved > i.stockMin + 2);
  check('N02', 'Hay un inventario de la sucursal del encargado 1 con stock holgado', !!item);
  if (!item) return process.exit(1);

  const baseAdmin = (await lowStock(admin.accessToken)).length;
  const baseEnc1 = (await lowStock(enc1.accessToken)).length;
  const baseEnc2 = (await lowStock(enc2.accessToken)).length;
  const available = item.stock - item.reserved;
  const down = available - item.stockMin; // lleva el disponible justo al mínimo

  // 1) Cruce del umbral
  const mv = await call('POST', '/inventory/movement', { token: enc1.accessToken, body: { inventoryId: item.id, type: 'AJUSTE', quantity: -down, observation: 'prueba E2E stock bajo' } });
  check('N03', 'El ajuste que lleva el stock al mínimo se registra', mv.status === 201 || mv.status === 200, JSON.stringify(mv.data));
  await sleep(2500);
  const a1 = await lowStock(admin.accessToken), e1 = await lowStock(enc1.accessToken), e2 = await lowStock(enc2.accessToken);
  check('N04', 'El ADMIN recibe la alerta de stock bajo', a1.length === baseAdmin + 1, `(${baseAdmin} → ${a1.length})`);
  check('N05', 'El ENCARGADO de esa sucursal recibe la alerta', e1.length === baseEnc1 + 1, `(${baseEnc1} → ${e1.length})`);
  check('N06', 'El encargado de OTRA sucursal no la recibe', e2.length === baseEnc2);
  check('N07', 'El mensaje indica producto y mínimo', /mínimo/.test(e1[0]?.message || '') && /Stock bajo|agotado/.test(e1[0]?.title || ''), e1[0]?.message);
  check('N08', 'El cliente no recibe alertas de stock', (await lowStock(cli.accessToken)).length === 0);

  // 2) Sin repetición mientras siga bajo
  await call('POST', '/inventory/movement', { token: enc1.accessToken, body: { inventoryId: item.id, type: 'AJUSTE', quantity: -1, observation: 'prueba E2E (sigue bajo)' } });
  await sleep(2500);
  check('N09', 'No se repite el aviso mientras el stock siga bajo', (await lowStock(enc1.accessToken)).length === baseEnc1 + 1);

  // 3) Restaurar y volver a cruzar → nuevo aviso
  await call('POST', '/inventory/movement', { token: enc1.accessToken, body: { inventoryId: item.id, type: 'AJUSTE', quantity: down + 1, observation: 'prueba E2E restaurar' } });
  await sleep(500);
  await call('POST', '/inventory/movement', { token: enc1.accessToken, body: { inventoryId: item.id, type: 'AJUSTE', quantity: -(down + 1), observation: 'prueba E2E cruzar otra vez' } });
  await sleep(2500);
  check('N10', 'Tras reponer y volver a bajar se avisa de nuevo', (await lowStock(enc1.accessToken)).length === baseEnc1 + 2);

  // Restaurar stock original
  await call('POST', '/inventory/movement', { token: enc1.accessToken, body: { inventoryId: item.id, type: 'AJUSTE', quantity: down + 1, observation: 'prueba E2E restaurar final' } });

  console.log('--- Estado del push ---');
  const st = await call('GET', '/notifications/status', { token: admin.accessToken });
  check('N11', 'GET /notifications/status responde con el diagnóstico', st.status === 200 && typeof st.data?.serverPushReady === 'boolean');
  console.log(`  ℹ push del servidor listo: ${st.data?.serverPushReady} · dispositivos del usuario: ${st.data?.devices} · ${st.data?.hint}`);
  console.log(`\n=== RESULTADO: ${ok} pruebas aprobadas, ${fail} fallidas ===`);
  process.exit(fail ? 1 : 0);
})();
