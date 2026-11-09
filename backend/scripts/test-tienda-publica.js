/**
 * PRUEBAS E2E — Tienda pública por empresa, registro de clientes y "Mi tienda web".
 *
 * Requisitos: backend en ejecución (API_URL, por defecto http://localhost:3000) con los datos demo
 * (npm run seed:demo): empresas "luna" y "sol", contraseña 123456.
 *
 *   API_URL=http://localhost:3000 node scripts/test-tienda-publica.js
 *
 * Crea un cliente de prueba y lo elimina; restaura la configuración de tienda que modifique.
 */
const API = process.env.API_URL || 'http://localhost:3000';
let ok = 0, fail = 0;
const stamp = Date.now();

async function call(method, path, { token, slug, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (slug !== undefined) headers['x-tenant-slug'] = slug;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}
function check(id, name, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✔ ${id} ${name}`); } else { fail++; console.log(`  ✘ ${id} ${name} ${extra}`); }
}
const names = (r) => (Array.isArray(r.data) ? r.data.map((p) => p.name) : []);

(async () => {
  console.log('--- Tienda pública aislada por empresa ---');
  const luna = await call('GET', '/store/products', { slug: 'luna' });
  const sol = await call('GET', '/store/products', { slug: 'sol' });
  check('P01', 'El catálogo de "luna" responde con productos', luna.status === 200 && luna.data.length > 0);
  check('P02', 'El catálogo de "sol" responde con productos', sol.status === 200 && sol.data.length > 0);
  check('P03', 'Los catálogos de luna y sol no comparten productos', !names(luna).some((n) => names(sol).includes(n)));
  const unknown = await call('GET', '/store/products', { slug: 'no-existe-' + stamp });
  check('P04', 'Un código de tienda inexistente → 404', unknown.status === 404);
  const none = await call('GET', '/store/products');
  check('P05', 'Sin tienda ni sesión → 400 (no existe empresa por defecto)', none.status === 400);

  console.log('--- Sesión y tienda ---');
  const login = await call('POST', '/auth/login', { body: { email: 'cliente@luna.com', password: '123456' } });
  const tok = login.data?.accessToken;
  check('P06', 'Cliente demo de luna inicia sesión', !!tok);
  const own = await call('GET', '/store/products', { token: tok });
  check('P07', 'Con sesión y sin slug ve el catálogo de su empresa (móvil)', own.status === 200 && names(own).join() === names(luna).join());
  const forged = await call('GET', '/store/products', { token: tok, slug: 'sol' });
  check('P08', 'El tenant del JWT manda sobre la cabecera X-Tenant-Slug', forged.status === 200 && names(forged).join() === names(luna).join());

  console.log('--- Registro de clientes dentro de una empresa ---');
  const email = `prueba.${stamp}@test.com`;
  const reg = await call('POST', '/auth/register', { slug: 'sol', body: { name: 'Prueba', lastName: 'Tienda', email, password: '123456' } });
  check('P09', 'Registro con X-Tenant-Slug=sol crea la cuenta', reg.status === 201 && !!reg.data?.accessToken);
  const payload = reg.data?.accessToken ? JSON.parse(Buffer.from(reg.data.accessToken.split('.')[1], 'base64').toString()) : {};
  const solInfo = await call('GET', '/saas/tenants/by-slug/sol');
  const lunaInfo = await call('GET', '/saas/tenants/by-slug/luna');
  const meSol = reg.data?.accessToken ? await call('GET', '/saas/tenants/me', { token: reg.data.accessToken }) : { data: {} };
  check('P10', 'La cuenta quedó en la empresa "sol" (tenantId del JWT)', payload.tenantId && meSol.data?.slug === 'sol' && lunaInfo.data?.slug === 'luna');
  const regNone = await call('POST', '/auth/register', { body: { name: 'X', email: `x.${stamp}@test.com`, password: '123456' } });
  check('P11', 'Registro sin código de tienda → 400', regNone.status === 400);
  const regBad = await call('POST', '/auth/register', { slug: 'no-existe-' + stamp, body: { name: 'X', email: `y.${stamp}@test.com`, password: '123456' } });
  check('P12', 'Registro con tienda inexistente → 404', regBad.status === 404);

  console.log('--- Datos públicos de la tienda ---');
  check('P13', 'by-slug devuelve nombre, sucursales y configuración', !!solInfo.data?.name && Array.isArray(solInfo.data?.branches) && !!solInfo.data?.config);
  check('P14', 'by-slug de un código inexistente → 404', (await call('GET', '/saas/tenants/by-slug/no-existe-' + stamp)).status === 404);

  console.log('--- Mi tienda web (configuración) ---');
  const adm = await call('POST', '/auth/login', { body: { email: 'admin@luna.com', password: '123456' } });
  const at = adm.data?.accessToken;
  const before = (await call('GET', '/saas/tenants/me', { token: at })).data?.storeConfig;
  const upd = await call('PATCH', '/saas/tenants/me/store', { token: at, body: { tagline: 'Prueba E2E', accentColor: '#112233', logoUrl: 'javascript:alert(1)', instagram: '@mi.tienda<script>', showFeatured: false } });
  const cfg = upd.data?.storeConfig || {};
  check('P15', 'El administrador guarda la configuración', upd.status === 200 && cfg.tagline === 'Prueba E2E' && cfg.accentColor === '#112233' && cfg.showFeatured === false);
  check('P16', 'Se rechaza un logo que no es http(s)', cfg.logoUrl === '');
  check('P17', 'Se sanea el usuario de Instagram', cfg.instagram === 'mi.tiendascript');
  const badColor = await call('PATCH', '/saas/tenants/me/store', { token: at, body: { accentColor: 'rojo' } });
  check('P18', 'Un color inválido vuelve al valor por defecto', badColor.data?.storeConfig?.accentColor === '#C9904A');
  const pub = await call('GET', '/saas/tenants/by-slug/luna');
  check('P19', 'La web pública de luna refleja el cambio', pub.data?.config?.tagline === 'Prueba E2E');
  const solPub = await call('GET', '/saas/tenants/by-slug/sol');
  check('P20', 'La configuración de sol no cambió', solPub.data?.config?.tagline !== 'Prueba E2E');
  const cl = await call('PATCH', '/saas/tenants/me/store', { token: tok, body: { tagline: 'hack' } });
  check('P21', 'Un cliente no puede modificar la tienda → 403', cl.status === 403);
  const anon = await call('PATCH', '/saas/tenants/me/store', { body: { tagline: 'hack' } });
  check('P22', 'Sin sesión no se puede modificar la tienda → 401', anon.status === 401);
  await call('PATCH', '/saas/tenants/me/store', { token: at, body: before || {} }); // restaurar

  // limpieza del cliente de prueba
  try {
    const { Client } = require('pg');
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
    const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
    await db.connect();
    await db.query(`DELETE FROM clients WHERE email = $1`, [email]);
    await db.query(`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE email = $1)`, [email]).catch(() => {});
    await db.query(`DELETE FROM users WHERE email = $1`, [email]);
    await db.end();
  } catch (e) { console.log('  (aviso) no se pudo limpiar el cliente de prueba:', e.message); }

  console.log(`\n=== RESULTADO: ${ok} pruebas aprobadas, ${fail} fallidas ===`);
  process.exit(fail ? 1 : 0);
})();
