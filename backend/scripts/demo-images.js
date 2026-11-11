/**
 * Recupera o reasigna las fotos de los productos demo.
 *
 *   node scripts/demo-images.js --list              muestra las imágenes que hay en tu Cloudinary (public_id y URL)
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
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  let cursor = '';
  let n = 0;
  do {
    const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/image?max_results=100&type=upload${cursor ? `&next_cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Cloudinary respondió ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const r of data.resources) { n++; console.log(`${r.created_at}  ${r.public_id}\n    ${r.secure_url}`); }
    cursor = data.next_cursor || '';
  } while (cursor);
  console.log(`\n${n} imagen(es). Copia el public_id y la URL de cada prenda en backend/demo-images.json`);
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
      const keys = Object.keys(cols).filter((k) => ALLOWED.includes(k));
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
