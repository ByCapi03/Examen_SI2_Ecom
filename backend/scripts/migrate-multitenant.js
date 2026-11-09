/**
 * MIGRACIÓN MULTITENANT (idempotente y transaccional)
 *
 * Convierte la base de datos del Primer Parcial (mono-empresa) al modelo SaaS:
 *   1. Crea planes, tenants, suscripciones e historial.
 *   2. Registra FashionStore S.R.L. como tenant 1 con Plan Profesional.
 *   3. Agrega "tenantId" a las tablas operativas y asigna los datos históricos
 *      al tenant 1 (los pagos heredan el tenant de su venta).
 *   4. Crea UNIQUE (tenantId, id) y FKs compuestas que impiden, a nivel motor,
 *      relacionar registros de empresas distintas.
 *   5. Crea las tablas de sincronización offline y auditoría de reportes IA.
 *   6. (Etapa 2b) Catálogos por empresa: categorías, tallas, colores, temporadas,
 *      colecciones, promociones, proveedores, variantes, movimientos de
 *      inventario y notificaciones reciben "tenantId". Si un registro de
 *      catálogo era compartido por varias empresas, se CLONA para cada una y se
 *      reapuntan sus referencias (ninguna empresa pierde datos).
 *
 * Uso:  node scripts/migrate-multitenant.js     (lee DB_* de .env o del entorno)
 * Puede ejecutarse varias veces: cada paso verifica si ya fue aplicado.
 */
const fs = require('fs');
const path = require('path');
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

const TENANT_TABLES = ['users', 'branches', 'products', 'sales', 'reservations', 'inventory', 'payments', 'cash_sessions', 'clients'];

/** Tablas hijas cuyo tenant se hereda del padre: [tabla, SQL de backfill]. */
const DERIVED_TABLES = [
  ['variants', `UPDATE variants v SET "tenantId" = p."tenantId" FROM products p WHERE p.id = v."productId" AND v."tenantId" IS NULL`],
  ['inventory_movements', `UPDATE inventory_movements m SET "tenantId" = i."tenantId" FROM inventory i WHERE i.id = m."inventoryId" AND m."tenantId" IS NULL`],
  ['notifications', `UPDATE notifications n SET "tenantId" = u."tenantId" FROM users u WHERE u.id = n."userId" AND n."tenantId" IS NULL`],
  ['notification_devices', `UPDATE notification_devices d SET "tenantId" = u."tenantId" FROM users u WHERE u.id = d."userId" AND d."tenantId" IS NULL`],
];

/**
 * Catálogos que pasan a ser por empresa. "refs" describe quién los usa:
 *  - tenants: SQL que devuelve los tenants que usan el registro $1
 *  - repoint: SQL que reapunta las referencias del tenant $3 del id $2 al id $1
 * El orden importa: las colecciones se resuelven antes que las temporadas.
 */
const SHARED_CATALOGS = [
  ['categories', [{
    tenants: `SELECT DISTINCT "tenantId" AS t FROM products WHERE "categoryId" = $1`,
    repoint: `UPDATE products SET "categoryId" = $1 WHERE "categoryId" = $2 AND "tenantId" = $3`,
  }]],
  ['sizes', [{
    tenants: `SELECT DISTINCT "tenantId" AS t FROM variants WHERE "sizeId" = $1`,
    repoint: `UPDATE variants SET "sizeId" = $1 WHERE "sizeId" = $2 AND "tenantId" = $3`,
  }]],
  ['colors', [{
    tenants: `SELECT DISTINCT "tenantId" AS t FROM variants WHERE "colorId" = $1`,
    repoint: `UPDATE variants SET "colorId" = $1 WHERE "colorId" = $2 AND "tenantId" = $3`,
  }]],
  ['collections', [{
    tenants: `SELECT DISTINCT "tenantId" AS t FROM products WHERE "collectionId" = $1`,
    repoint: `UPDATE products SET "collectionId" = $1 WHERE "collectionId" = $2 AND "tenantId" = $3`,
  }]],
  ['seasons', [{
    tenants: `SELECT DISTINCT "tenantId" AS t FROM collections WHERE "seasonId" = $1`,
    repoint: `UPDATE collections SET "seasonId" = $1 WHERE "seasonId" = $2 AND "tenantId" = $3`,
  }]],
  ['promotions', [{
    tenants: `SELECT DISTINCT p."tenantId" AS t FROM product_promotions pp JOIN products p ON p.id = pp."productId" WHERE pp."promotionId" = $1`,
    repoint: `UPDATE product_promotions pp SET "promotionId" = $1 FROM products p
               WHERE p.id = pp."productId" AND pp."promotionId" = $2 AND p."tenantId" = $3`,
  }]],
  ['suppliers', []],
];

/** UNIQUE globales que pasan a ser por empresa: [tabla, columna, nuevo UNIQUE]. */
const TENANT_SCOPED_UNIQUES = [
  ['categories', 'name', 'uq_categories_tenant_name'],
  ['sizes', 'name', 'uq_sizes_tenant_name'],
  ['colors', 'name', 'uq_colors_tenant_name'],
  ['suppliers', 'nit', 'uq_suppliers_tenant_nit'],
  ['variants', 'sku', 'uq_variants_tenant_sku'],
];

const UNIQUES = [
  ['branches', 'uq_branches_tenant_id'],
  ['users', 'uq_users_tenant_id'],
  ['products', 'uq_products_tenant_id'],
  ['sales', 'uq_sales_tenant_id'],
  ['reservations', 'uq_reservations_tenant_id'],
  ['inventory', 'uq_inventory_tenant_id'],
  ['categories', 'uq_categories_tenant_id'],
  ['sizes', 'uq_sizes_tenant_id'],
  ['colors', 'uq_colors_tenant_id'],
  ['seasons', 'uq_seasons_tenant_id'],
  ['collections', 'uq_collections_tenant_id'],
  ['promotions', 'uq_promotions_tenant_id'],
  ['suppliers', 'uq_suppliers_tenant_id'],
  ['variants', 'uq_variants_tenant_id'],
];

const FKS = [
  ['sales', 'fk_sales_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['inventory', 'fk_inventory_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['reservations', 'fk_reservations_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['payments', 'fk_payments_sale_tenant', '("saleId", "tenantId") REFERENCES sales(id, "tenantId")'],
  ['cash_sessions', 'fk_cash_sessions_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['clients', 'fk_clients_user_tenant', '("userId", "tenantId") REFERENCES users(id, "tenantId")'],
  ['sales', 'fk_sales_tenant', '("tenantId") REFERENCES tenants(id) ON DELETE RESTRICT'],
  ['products', 'fk_products_category_tenant', '("categoryId", "tenantId") REFERENCES categories(id, "tenantId")'],
  ['variants', 'fk_variants_product_tenant', '("productId", "tenantId") REFERENCES products(id, "tenantId")'],
  ['variants', 'fk_variants_size_tenant', '("sizeId", "tenantId") REFERENCES sizes(id, "tenantId")'],
  ['variants', 'fk_variants_color_tenant', '("colorId", "tenantId") REFERENCES colors(id, "tenantId")'],
  ['inventory', 'fk_inventory_variant_tenant', '("variantId", "tenantId") REFERENCES variants(id, "tenantId")'],
  ['collections', 'fk_collections_season_tenant', '("seasonId", "tenantId") REFERENCES seasons(id, "tenantId")'],
  ['inventory_movements', 'fk_movements_inventory_tenant', '("inventoryId", "tenantId") REFERENCES inventory(id, "tenantId")'],
  ['notifications', 'fk_notifications_user_tenant', '("userId", "tenantId") REFERENCES users(id, "tenantId")'],
];

async function tableExists(db, table) {
  const r = await db.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
  return !!r.rows[0].t;
}
async function columnExists(db, table, column) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column]);
  return r.rowCount > 0;
}
async function constraintExists(db, name) {
  const r = await db.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [name]);
  return r.rowCount > 0;
}

async function columnsOf(db, table) {
  const r = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
  return r.rows.map((x) => x.column_name);
}

/** Elimina los UNIQUE de una sola columna (p. ej. categories.name global). */
async function dropSingleColumnUniques(db, table, column) {
  const r = await db.query(
    `SELECT c.conname FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'u' AND c.conrelid = $1::regclass AND array_length(c.conkey, 1) = 1 AND a.attname = $2`,
    [table, column]);
  for (const row of r.rows) await db.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${row.conname}"`);
  // índices únicos creados fuera de constraints
  const idx = await db.query(
    `SELECT i.relname FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY(x.indkey)
      WHERE x.indrelid = $1::regclass AND x.indisunique AND NOT x.indisprimary AND x.indnatts = 1 AND a.attname = $2
        AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid)`,
    [table, column]);
  for (const row of idx.rows) await db.query(`DROP INDEX IF EXISTS "${row.relname}"`);
  return r.rowCount + idx.rowCount;
}

/**
 * Asigna tenant a cada registro de un catálogo antes global. Si varias empresas
 * lo usan, el original queda para la de menor id y se clona para las demás.
 */
async function splitSharedCatalog(db, table, refs, log) {
  const cols = (await columnsOf(db, table)).filter((c) => c !== 'id' && c !== 'tenantId');
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const pending = await db.query(`SELECT id FROM "${table}" WHERE "tenantId" IS NULL ORDER BY id`);
  let clones = 0;
  for (const { id } of pending.rows) {
    const users = new Set();
    for (const ref of refs) {
      const r = await db.query(ref.tenants, [id]);
      r.rows.forEach((x) => x.t != null && users.add(Number(x.t)));
    }
    const tenants = [...users].sort((a, b) => a - b);
    const owner = tenants.length ? tenants[0] : 1;
    await db.query(`UPDATE "${table}" SET "tenantId" = $1 WHERE id = $2`, [owner, id]);
    for (const t of tenants.slice(1)) {
      const copy = await db.query(
        `INSERT INTO "${table}" ("tenantId", ${colList}) SELECT $1, ${colList} FROM "${table}" WHERE id = $2 RETURNING id`, [t, id]);
      for (const ref of refs) await db.query(ref.repoint, [copy.rows[0].id, id, t]);
      clones++;
    }
  }
  log(`${table}: ${pending.rowCount} registros con tenant asignado, ${clones} clonados para otras empresas`);
}

async function main() {
  loadEnv();
  requireDbConfig();
  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: String(process.env.DB_PASSWORD),
    database: process.env.DB_DATABASE || 'ecommerce_ropa',
  });
  await db.connect();
  const log = (...a) => console.log('  ✔', ...a);
  console.log(`\n=== Migración multitenant sobre "${db.database}" ===`);

  try {
    await db.query('BEGIN');

    // 1. Catálogo SaaS
    await db.query(`CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY, code varchar NOT NULL UNIQUE, name varchar NOT NULL,
      "priceMonthly" numeric(10,2) NOT NULL DEFAULT 0, "maxBranches" integer NOT NULL DEFAULT 2,
      "aiGenerativeReports" boolean NOT NULL DEFAULT false, "offlineOperations" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now())`);
    await db.query(`CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY, slug varchar NOT NULL UNIQUE, name varchar NOT NULL, "taxId" varchar,
      active boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`);
    await db.query(`CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY, tenant_id integer NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE RESTRICT,
      plan_id integer NOT NULL REFERENCES plans(id) ON DELETE RESTRICT, status varchar NOT NULL DEFAULT 'ACTIVE',
      start_date timestamp NOT NULL, end_date timestamp, updated_at timestamp NOT NULL DEFAULT now())`);
    await db.query(`CREATE TABLE IF NOT EXISTS subscription_history (
      id SERIAL PRIMARY KEY, tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan_id integer NOT NULL REFERENCES plans(id) ON DELETE RESTRICT, action varchar NOT NULL,
      previous_plan_id integer, changed_at timestamp NOT NULL DEFAULT now(), notes text)`);
    log('Tablas plans / tenants / subscriptions / subscription_history');

    await db.query(`INSERT INTO plans (code, name, "priceMonthly", "maxBranches", "aiGenerativeReports", "offlineOperations")
      VALUES ('BASICO', 'Plan Básico', 49, 2, false, true), ('PROFESIONAL', 'Plan Profesional', 149, 10, true, true)
      ON CONFLICT (code) DO NOTHING`);
    await db.query(`INSERT INTO tenants (id, slug, name) VALUES (1, 'fashionstore-central', 'FashionStore S.R.L.')
      ON CONFLICT (id) DO NOTHING`);
    await db.query(`SELECT setval(pg_get_serial_sequence('tenants','id'), GREATEST((SELECT MAX(id) FROM tenants), 1))`);
    await db.query(`INSERT INTO subscriptions (tenant_id, plan_id, status, start_date)
      SELECT 1, id, 'ACTIVE', now() FROM plans WHERE code = 'PROFESIONAL'
      ON CONFLICT (tenant_id) DO NOTHING`);
    log('Planes BASICO/PROFESIONAL y tenant 1 (FashionStore S.R.L.) con Plan Profesional');

    // 2. Columna tenantId + backfill
    for (const table of TENANT_TABLES) {
      if (!(await tableExists(db, table))) { console.log(`  · ${table} no existe (se creará al iniciar el backend)`); continue; }
      if (!(await columnExists(db, table, 'tenantId'))) {
        await db.query(`ALTER TABLE "${table}" ADD COLUMN "tenantId" integer`);
      }
      if (table === 'payments') {
        await db.query(`UPDATE payments p SET "tenantId" = s."tenantId" FROM sales s WHERE s.id = p."saleId" AND p."tenantId" IS NULL`);
      }
      await db.query(`UPDATE "${table}" SET "tenantId" = 1 WHERE "tenantId" IS NULL`);
      await db.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
      const c = await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "tenantId" = 1)::int AS t1 FROM "${table}"`);
      log(`${table}: ${c.rows[0].t1}/${c.rows[0].total} registros asignados a tenantId = 1`);
    }
    // 3-4. UNIQUE (tenantId, id) y FKs compuestas: se crean en el paso 6,
    //      cuando todas las tablas ya tienen "tenantId".

    // 5. Columnas de idempotencia offline
    for (const table of ['sales', 'reservations']) {
      if (await tableExists(db, table) && !(await columnExists(db, table, 'offlineOperationId'))) {
        await db.query(`ALTER TABLE "${table}" ADD COLUMN "offlineOperationId" uuid UNIQUE`);
        log(`${table}."offlineOperationId"`);
      }
    }

    // 6. Catálogos por empresa (Etapa 2b) + UNIQUE/FKs compuestas de todo el modelo
    for (const [table, backfill] of DERIVED_TABLES) {
      if (!(await tableExists(db, table))) continue;
      if (!(await columnExists(db, table, 'tenantId'))) await db.query(`ALTER TABLE "${table}" ADD COLUMN "tenantId" integer`);
      await db.query(backfill);
      await db.query(`UPDATE "${table}" SET "tenantId" = 1 WHERE "tenantId" IS NULL`);
      await db.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
      log(`${table}: tenant heredado del registro padre`);
    }
    for (const [table, column] of TENANT_SCOPED_UNIQUES) {
      if (!(await tableExists(db, table))) continue;
      const n = await dropSingleColumnUniques(db, table, column);
      if (n) log(`${table}.${column}: UNIQUE global eliminado (pasa a ser único por empresa)`);
    }
    for (const [table, refs] of SHARED_CATALOGS) {
      if (!(await tableExists(db, table))) continue;
      if (!(await columnExists(db, table, 'tenantId'))) await db.query(`ALTER TABLE "${table}" ADD COLUMN "tenantId" integer`);
      await splitSharedCatalog(db, table, refs, log);
      await db.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
    }
    for (const [table, column, name] of TENANT_SCOPED_UNIQUES) {
      if (!(await tableExists(db, table)) || (await constraintExists(db, name))) continue;
      await db.query(`ALTER TABLE "${table}" ADD CONSTRAINT ${name} UNIQUE ("tenantId", "${column}")`);
      log(`UNIQUE ${name}`);
    }
    for (const [table, name] of UNIQUES) {
      if (!(await tableExists(db, table)) || (await constraintExists(db, name))) continue;
      await db.query(`ALTER TABLE "${table}" ADD CONSTRAINT ${name} UNIQUE ("tenantId", id)`);
      log(`UNIQUE ${name}`);
    }
    for (const [table, name, def] of FKS) {
      if (!(await tableExists(db, table)) || (await constraintExists(db, name))) continue;
      const refTable = def.match(/REFERENCES (\w+)/)[1];
      if (!(await tableExists(db, refTable))) continue;
      const col = def.match(/^\("(\w+)"/)[1];
      if (col !== 'tenantId') {
        const old = await db.query(
          `SELECT c.conname FROM pg_constraint c
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.contype = 'f' AND c.conrelid = $1::regclass AND array_length(c.conkey, 1) = 1 AND a.attname = $2`,
          [table, col]);
        for (const r of old.rows) await db.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${r.conname}"`);
      }
      await db.query(`ALTER TABLE "${table}" ADD CONSTRAINT ${name} FOREIGN KEY ${def}`);
      log(`FK compuesta ${name}`);
    }

    await db.query('COMMIT');
    console.log('\n=== Migración completada. Inicie el backend (synchronize creará las tablas nuevas restantes). ===\n');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('\n✖ Migración revertida por error:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
