/**
 * Recupera o reasigna las fotos de los productos demo.
 *
 *   node scripts/demo-images.js --list              muestra tus imágenes de Cloudinary, abre una galería (cloudinary-gallery.html)
 *                                                   y deja listo demo-images.json con los nombres de tus productos
 *   node scripts/demo-images.js                     aplica backend/demo-images.json a los productos (por empresa y nombre)
 *   node scripts/demo-images.js --file otro.json    igual, con otro archivo
 *
 * Formato (ver demo-images.example.json). Cada producto acepta: imageUrl, imagePublicId, arImageUrl, arImagePublicId,
 * arTorsoUrl, arTorsoPublicId, arLeftSleeveUrl, arLeftSleevePublicId, arRightSleeveUrl, arRightSleevePublicId,
 * arEnabled, colorizable, sourceColor.
 *
 * Nota: "seed:demo:reset" ahora conserva las fotos; este script sirve para recuperarlas si ya se habían perdido.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const ALLOWED = ['imageUrl', 'imagePublicId', 'arImageUrl', 'arImagePublicId', 'arTorsoUrl', 'arTorsoPublicId', 'arLeftSleeveUrl', 'arLeftSleevePublicId', 'arRightSleeveUrl', 'arRightSleevePublicId', 'arEnabled', 'colorizable', 'sourceColor'];

async function list() {
  const cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const key = (process.env.CLOUDINARY_API_KEY || '').trim();
  const secret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloud || !key || !secret) throw new Error('Faltan CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET en backend/.env');
  const base = process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com';
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const found = [];
  let cursor = '';
  do {
    const url = `${base}/v1_1/${cloud}/resources/image?max_results=100&type=upload${cursor ? `&next_cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Cloudinary respondió ${res.status}: ${await res.text()}`);
    const data = await res.json();
    found.push(...data.resources);
    cursor = data.next_cursor || '';
  } while (cursor);
  found.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  for (const r of found) console.log(`${r.created_at}  ${r.public_id}\n    ${r.secure_url}`);

  // Galería visual para reconocer cada foto
  const thumb = (u) => u.replace('/upload/', '/upload/w_220,h_220,c_fill/');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!doctype html><meta charset="utf-8"><title>Imágenes de Cloudinary</title>
<style>body{font-family:sans-serif;background:#f4f1ea;margin:20px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.c{background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;font-size:12px;word-break:break-all}img{width:100%;border-radius:6px;background:#eee}</style>
<h2>${found.length} imagen(es) en tu Cloudinary</h2><p>Reconoce cada foto y copia su <b>public_id</b> y su <b>URL</b> en <code>backend/demo-images.json</code> (junto al producto que corresponda).</p>
<div class="g">${found.map((r) => `<div class="c"><img src="${esc(thumb(r.secure_url))}"><div><b>public_id</b><br>${esc(r.public_id)}</div><div style="margin-top:6px"><b>URL</b><br>${esc(r.secure_url)}</div><div style="color:#777;margin-top:6px">${esc(r.created_at)}</div></div>`).join('')}</div>`;
  const out = path.join(__dirname, '..', 'cloudinary-gallery.html');
  fs.writeFileSync(out, html);

  // Plantilla con los productos demo de tu base de datos, lista para pegar URL y public_id
  const target = path.join(__dirname, '..', 'demo-images.json');
  if (!fs.existsSync(target)) {
    const db = new Client({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
    await db.connect();
    const rows = (await db.query(`SELECT t.slug, p.name FROM products p JOIN tenants t ON t.id = p."tenantId" WHERE t.slug IN ('luna','sol') ORDER BY t.slug, p.id`)).rows;
    await db.end();
    const tpl = {};
    for (const r of rows) (tpl[r.slug] = tpl[r.slug] || {})[r.name] = { imageUrl: '', imagePublicId: '' };
    fs.writeFileSync(target, JSON.stringify(tpl, null, 2) + '\n');
    console.log(`\nSe creó ${target} con tus productos: pega ahí la URL y el public_id de cada foto.`);
  }
  console.log(`\n${found.length} imagen(es). Galería: ${out}\nAbre ese archivo en el navegador para ver las fotos; luego completa demo-images.json y ejecuta: npm run seed:demo:images`);
}

async function apply() {
  const i = process.argv.indexOf('--file');
  const file = i > -1 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', 'demo-images.json');
  if (!fs.existsSync(file)) throw new Error(`No existe ${file} (copia demo-images.example.json como demo-images.json y complétalo)`);
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = new Client({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();
  let done = 0;
  for (const [slug, products] of Object.entries(map)) {
    if (slug.startsWith('_')) continue;
    const t = await db.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!t.rows.length) { console.log(`✗ Empresa "${slug}" no existe`); continue; }
    for (const [name, cols] of Object.entries(products)) {
      const keys = Object.keys(cols).filter((k) => ALLOWED.includes(k) && cols[k] !== '' && cols[k] != null);
      if (!keys.length) continue;
      const sets = keys.map((k, n) => `"${k}" = $${n + 3}`).join(', ');
      const r = await db.query(`UPDATE products SET ${sets} WHERE "tenantId" = $1 AND name = $2`, [t.rows[0].id, name, ...keys.map((k) => cols[k])]);
      console.log(`${r.rowCount ? '✔' : '✗'} ${slug} · ${name}${r.rowCount ? '' : ' (no existe ese producto)'}`);
      done += r.rowCount;
    }
  }
  await db.end();
  console.log(`\n${done} producto(s) actualizado(s).`);
}

(process.argv.includes('--list') ? list() : apply()).catch((e) => { console.error('✖', e.message); process.exit(1); });
