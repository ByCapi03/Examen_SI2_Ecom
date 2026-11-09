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

const UNIQUES = [
  ['branches', 'uq_branches_tenant_id'],
  ['users', 'uq_users_tenant_id'],
  ['products', 'uq_products_tenant_id'],
  ['sales', 'uq_sales_tenant_id'],
  ['reservations', 'uq_reservations_tenant_id'],
  ['inventory', 'uq_inventory_tenant_id'],
];

const FKS = [
  ['sales', 'fk_sales_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['inventory', 'fk_inventory_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['reservations', 'fk_reservations_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['payments', 'fk_payments_sale_tenant', '("saleId", "tenantId") REFERENCES sales(id, "tenantId")'],
  ['cash_sessions', 'fk_cash_sessions_branch_tenant', '("branchId", "tenantId") REFERENCES branches(id, "tenantId")'],
  ['clients', 'fk_clients_user_tenant', '("userId", "tenantId") REFERENCES users(id, "tenantId")'],
  ['sales', 'fk_sales_tenant', '("tenantId") REFERENCES tenants(id) ON DELETE RESTRICT'],
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

    // Si la tabla plans fue creada por TypeORM sin la columna code, la agregamos y hacemos backfill
    if (!(await columnExists(db, 'plans', 'code'))) {
      await db.query(`ALTER TABLE plans ADD COLUMN code varchar`);
      await db.query(`UPDATE plans SET code = 'BASICO' WHERE code IS NULL AND (name ILIKE '%basico%' OR name ILIKE '%básico%')`);
      await db.query(`UPDATE plans SET code = 'PROFESIONAL' WHERE code IS NULL AND name ILIKE '%profesional%'`);
      await db.query(`UPDATE plans SET code = UPPER(REGEXP_REPLACE(COALESCE(name,'plan'), '[^A-Za-z0-9]', '_', 'g')) WHERE code IS NULL`);
      await db.query(`ALTER TABLE plans ALTER COLUMN code SET NOT NULL`);
      if (!(await constraintExists(db, 'plans_code_key'))) {
        await db.query(`ALTER TABLE plans ADD CONSTRAINT plans_code_key UNIQUE (code)`);
      }
      log('Columna code agregada a plans y backfill completado');
    }

    await db.query(`INSERT INTO plans (code, name, "priceMonthly", "maxBranches", "aiGenerativeReports", "offlineOperations")
      VALUES
        ('BASICO',      'Plan Básico',      0,   1,  false, true),
        ('STARTER',     'Plan Starter',     29,  3,  false, true),
        ('PROFESIONAL', 'Plan Profesional', 79,  10, true,  true),
        ('EMPRESARIAL', 'Plan Empresarial', 199, 99, true,  true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, "priceMonthly" = EXCLUDED."priceMonthly",
        "maxBranches" = EXCLUDED."maxBranches", "aiGenerativeReports" = EXCLUDED."aiGenerativeReports",
        "offlineOperations" = EXCLUDED."offlineOperations"`);
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
    // 3. UNIQUE compuestos
    for (const [table, name] of UNIQUES) {
      if (!(await tableExists(db, table)) || (await constraintExists(db, name))) continue;
      await db.query(`ALTER TABLE "${table}" ADD CONSTRAINT ${name} UNIQUE ("tenantId", id)`);
      log(`UNIQUE ${name}`);
    }

    // 4. FKs compuestas (se eliminan antes las FKs simples equivalentes)
    for (const [table, name, def] of FKS) {
      if (!(await tableExists(db, table)) || (await constraintExists(db, name))) continue;
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

    // 5. Columnas de idempotencia offline
    for (const table of ['sales', 'reservations']) {
      if (await tableExists(db, table) && !(await columnExists(db, table, 'offlineOperationId'))) {
        await db.query(`ALTER TABLE "${table}" ADD COLUMN "offlineOperationId" uuid UNIQUE`);
        log(`${table}."offlineOperationId"`);
      }
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
