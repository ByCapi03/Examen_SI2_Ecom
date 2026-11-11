/**
 * DATOS DEMO
 *
 * Crea dos empresas completas y coherentes con las relaciones reales del sistema:
 *   - Moda Luna   (plan Profesional)  -> luna.com
 *   - Boutique Sol (plan Starter)     -> sol.com
 * Cada una con: administrador, 2 sucursales, 1 encargado y 2 cajeros por sucursal, 2 cajas por sucursal
 * (una por cajero), 3 categorías, 6 productos con sus variantes (talla x color), clientes, inventario con
 * sus movimientos, una semana de ventas por caja con sus turnos (aperturas/cierres), reservas en distintos
 * estados y la bitácora de actividad.
 *
 * TODAS las contraseñas son 123456.
 *
 *   npm run seed:demo          crea las empresas demo si no existen (no toca nada más)
 *   npm run seed:demo:reset    borra SOLO las empresas demo (slugs "luna" y "sol") y las vuelve a crear
 *
 * Los productos se crean SIN imagen: se agregan después desde Catálogo > Productos.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { Plan } from '../modules/tenants/plan.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { Subscription } from '../modules/tenants/subscription.entity';
import { SubscriptionHistory } from '../modules/tenants/subscription-history.entity';
import { City } from '../modules/branches/city.entity';
import { Branch } from '../modules/branches/branch.entity';
import { User } from '../modules/auth/user.entity';
import { UserRole } from '../modules/auth/user-role.entity';
import { Category } from '../modules/catalog/category.entity';
import { Size } from '../modules/catalog/size.entity';
import { Color } from '../modules/catalog/color.entity';
import { Season } from '../modules/catalog/season.entity';
import { Collection } from '../modules/catalog/collection.entity';
import { Product, ArGarmentType } from '../modules/catalog/product.entity';
import { Variant } from '../modules/catalog/variant.entity';
import { Supplier } from '../modules/inventory/supplier.entity';
import { Inventory } from '../modules/inventory/inventory.entity';
import { InventoryMovement } from '../modules/inventory/inventory-movement.entity';
import { MovementType } from '../modules/inventory/inventory.enums';
import { Client } from '../modules/clients/client.entity';
import { CashRegister } from '../modules/sales/cash-register.entity';
import { CashSession } from '../modules/sales/cash-session.entity';
import { Sale } from '../modules/sales/sale.entity';
import { SaleItem } from '../modules/sales/sale-item.entity';
import { Payment } from '../modules/sales/payment.entity';
import { SaleChannel, SaleStatus, PaymentMethod, PaymentStatus, CashSessionStatus } from '../modules/sales/sales.enums';
import { Reservation } from '../modules/reservations/reservation.entity';
import { ReservationItem } from '../modules/reservations/reservation-item.entity';
import { ReservationStatus } from '../modules/reservations/reservation.enums';
import { AuditLog } from '../modules/audit/audit-log.entity';

export const DEMO_PASSWORD = '123456';

/* ───────────────────────── Definición de las empresas ───────────────────────── */

type CategoryName = 'Vestidos' | 'Faldas' | 'Blusas';
interface ProductDef { name: string; category: CategoryName; price: number; colors: [string, string]; collection: string; weight: number }
interface BranchDef { name: string; city: string; address: string; phone: string }
interface CompanyDef {
  slug: string; name: string; taxId: string; planCode: string; domain: string; skuPrefix: string; seed: number;
  admin: string; branches: BranchDef[]; encargados: string[]; cajeros: string[][];
  collections: { name: string; description: string }[]; products: ProductDef[];
}

const CLIENT_FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabiola', 'Gustavo', 'Helena', 'Ivan', 'Julia', 'Kevin', 'Laura'];
const CLIENT_LAST = ['Rojas', 'Vargas', 'Salazar', 'Peña', 'Morales', 'Durán', 'Flores', 'Aguilera', 'Cuéllar', 'Parada', 'Justiniano', 'Roca'];

const COMPANIES: CompanyDef[] = [
  {
    slug: 'luna', name: 'Moda Luna', taxId: '1023456017', planCode: 'PROFESIONAL', domain: 'luna.com', skuPrefix: 'LUN', seed: 11,
    admin: 'Lucía Mendoza',
    branches: [
      { name: 'Luna Centro', city: 'Santa Cruz', address: 'Calle Ballivián #245, Centro', phone: '78120451' },
      { name: 'Luna Norte', city: 'Santa Cruz', address: 'Av. Banzer, 4to anillo #1180', phone: '78120452' },
    ],
    encargados: ['Carlos Vaca', 'Daniela Rojas'],
    cajeros: [['Mariana Suárez', 'Jorge Pinto'], ['Camila Ribera', 'Andrés Cuéllar']],
    collections: [{ name: 'Luna Esencial', description: 'Básicos elegantes de temporada' }, { name: 'Luna Noche', description: 'Prendas para eventos' }],
    products: [
      { name: 'Vestido Lino Marfil', category: 'Vestidos', price: 380, colors: ['Beige', 'Blanco'], collection: 'Luna Esencial', weight: 1.4 },
      { name: 'Vestido Satén Noche', category: 'Vestidos', price: 450, colors: ['Negro', 'Rojo'], collection: 'Luna Noche', weight: 1.0 },
      { name: 'Falda Midi Plisada', category: 'Faldas', price: 260, colors: ['Verde', 'Beige'], collection: 'Luna Esencial', weight: 1.2 },
      { name: 'Falda Lápiz Negra', category: 'Faldas', price: 230, colors: ['Negro', 'Gris'], collection: 'Luna Noche', weight: 0.8 },
      { name: 'Blusa Seda Verde', category: 'Blusas', price: 210, colors: ['Verde', 'Blanco'], collection: 'Luna Esencial', weight: 1.1 },
      { name: 'Blusa Lino Blanca', category: 'Blusas', price: 190, colors: ['Blanco', 'Azul'], collection: 'Luna Esencial', weight: 0.9 },
    ],
  },
  {
    slug: 'sol', name: 'Boutique Sol', taxId: '2087654013', planCode: 'STARTER', domain: 'sol.com', skuPrefix: 'SOL', seed: 23,
    admin: 'Rodrigo Salvatierra',
    branches: [
      { name: 'Sol Cala Cala', city: 'Cochabamba', address: 'Av. Santa Cruz #1530, Cala Cala', phone: '72240671' },
      { name: 'Sol Centro', city: 'Cochabamba', address: 'Calle España #420, Centro', phone: '72240672' },
    ],
    encargados: ['Patricia Ugarte', 'Fernando Antezana'],
    cajeros: [['Valeria Camacho', 'Diego Escalera'], ['Natalia Arce', 'Luis Montaño']],
    collections: [{ name: 'Sol Verano', description: 'Colores y estampados de verano' }, { name: 'Sol Casual', description: 'Ropa de todos los días' }],
    products: [
      { name: 'Vestido Floral Verano', category: 'Vestidos', price: 290, colors: ['Amarillo', 'Rojo'], collection: 'Sol Verano', weight: 1.4 },
      { name: 'Vestido Camisero Azul', category: 'Vestidos', price: 310, colors: ['Azul', 'Blanco'], collection: 'Sol Casual', weight: 1.0 },
      { name: 'Falda Denim Corta', category: 'Faldas', price: 180, colors: ['Azul', 'Negro'], collection: 'Sol Casual', weight: 1.2 },
      { name: 'Falda Tableada Beige', category: 'Faldas', price: 200, colors: ['Beige', 'Café'], collection: 'Sol Verano', weight: 0.8 },
      { name: 'Blusa Rayas Marinera', category: 'Blusas', price: 150, colors: ['Blanco', 'Azul'], collection: 'Sol Casual', weight: 1.1 },
      { name: 'Blusa Bordada Verde', category: 'Blusas', price: 170, colors: ['Verde', 'Blanco'], collection: 'Sol Verano', weight: 0.9 },
    ],
  },
];

const AR_TYPE: Record<CategoryName, ArGarmentType> = { Vestidos: ArGarmentType.DRESS, Faldas: ArGarmentType.BOTTOM, Blusas: ArGarmentType.TOP };
const SIZES = ['S', 'M', 'L'];
const SIZE_WEIGHT: Record<string, number> = { S: 0.8, M: 1.4, L: 1.0 };

/* ───────────────────────── Utilidades ───────────────────────── */

const NOW = new Date();
const DAYS = 7; // hoy + 6 días anteriores
const dayAt = (offset: number, h: number, m = 0) => { const d = new Date(NOW); d.setDate(d.getDate() - offset); d.setHours(h, m, 0, 0); return d; };
const addMin = (d: Date, min: number) => new Date(d.getTime() + min * 60000);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const money = (n: number) => Math.round(n * 100) / 100;
const noAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    weighted: <T>(items: T[], weights: number[]): T => {
      const total = weights.reduce((s, w) => s + w, 0);
      let x = next() * total;
      for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
      return items[items.length - 1];
    },
  };
}
type Rng = ReturnType<typeof rng>;

async function bulkInsert(m: EntityManager, entity: any, rows: any[], chunk = 200): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const res = await m.insert(entity, rows.slice(i, i + chunk));
    res.identifiers.forEach((x: any) => ids.push(x.id));
  }
  return ids;
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = raw.replace(/^\s*export\s+/, '').match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

/* ───────────────────────── Datos compartidos (catálogos globales) ───────────────────────── */

interface Globals {
  roles: Record<string, number>; plans: Record<string, number>; cities: Record<string, number>;
  categories: Record<string, number>; sizes: Record<string, number>; colors: Record<string, number>; seasonId: number;
}

async function findOrCreate(m: EntityManager, entity: any, where: any, values: any): Promise<number> {
  const found = await m.findOne(entity, { where });
  if (found) return (found as any).id;
  return (await m.insert(entity, { ...where, ...values })).identifiers[0].id;
}

async function ensureGlobals(ds: DataSource): Promise<Globals> {
  return ds.transaction(async (m) => {
    // Roles (misma lógica que el arranque del backend)
    await m.query(`SELECT setval(pg_get_serial_sequence('roles','id'), COALESCE((SELECT MAX(id) FROM roles), 0) + 1, false)`);
    for (const [name, description] of [['ADMIN', 'Administrador'], ['CLIENTE', 'Cliente'], ['ENCARGADO', 'Encargado de Sucursal'], ['CAJERO', 'Cajero']]) {
      await m.query(`INSERT INTO roles (name, description, active) VALUES ($1,$2,true) ON CONFLICT (name) DO NOTHING`, [name, description]);
    }
    const roles: Record<string, number> = {};
    for (const r of await m.query(`SELECT id, name FROM roles`)) roles[r.name] = r.id;

    const plans: Record<string, number> = {};
    for (const p of [
      { code: 'BASICO', name: 'Plan Básico', priceMonthly: 0, priceYearly: 0, maxBranches: 1, maxProducts: 50, maxUsers: 3, aiGenerativeReports: false },
      { code: 'STARTER', name: 'Plan Starter', priceMonthly: 29, priceYearly: 290, maxBranches: 3, maxProducts: 500, maxUsers: 10, aiGenerativeReports: false },
      { code: 'PROFESIONAL', name: 'Plan Profesional', priceMonthly: 79, priceYearly: 790, maxBranches: 10, maxProducts: null, maxUsers: 50, aiGenerativeReports: true },
      { code: 'EMPRESARIAL', name: 'Plan Empresarial', priceMonthly: 199, priceYearly: 1990, maxBranches: 99, maxProducts: null, maxUsers: null, aiGenerativeReports: true },
    ]) plans[p.code] = await findOrCreate(m, Plan, { code: p.code }, { ...p, offlineOperations: true });

    const cities: Record<string, number> = {};
    for (const c of ['Santa Cruz', 'Cochabamba']) cities[c] = await findOrCreate(m, City, { name: c }, { active: true });

    const categories: Record<string, number> = {};
    for (const c of ['Vestidos', 'Faldas', 'Blusas']) categories[c] = await findOrCreate(m, Category, { name: c }, { active: true });

    const sizes: Record<string, number> = {};
    for (const s of SIZES) sizes[s] = await findOrCreate(m, Size, { name: s }, { active: true });

    const colors: Record<string, number> = {};
    for (const c of ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Gris', 'Beige', 'Café']) colors[c] = await findOrCreate(m, Color, { name: c }, { active: true });

    const seasonId = await findOrCreate(m, Season, { name: 'Primavera-Verano 2026' }, { startDate: '2026-09-01', endDate: '2027-02-28', active: true });

    // Proveedores de ejemplo (catálogo compartido, NIT único)
    await findOrCreate(m, Supplier, { nit: '1020304050' }, { name: 'Textiles Andinos S.R.L.', email: 'ventas@textilesandinos.com', phone: '33445566', address: 'Parque Industrial, Santa Cruz', active: true });
    await findOrCreate(m, Supplier, { nit: '5060708090' }, { name: 'Confecciones Tropical', email: 'pedidos@tropical.com', phone: '44556677', address: 'Zona Sud, Cochabamba', active: true });

    return { roles, plans, cities, categories, sizes, colors, seasonId };
  });
}

/* ───────────────────────── Limpieza de una empresa demo ───────────────────────── */

async function deleteTenantData(m: EntityManager, T: number) {
  const q = (sql: string) => m.query(sql, [T]);
  // Tablas hoja de otros módulos que tengan tenantId (p. ej. sincronización), por si existen
  const known = new Set(['audit_logs', 'payments', 'sales', 'reservations', 'inventory', 'cash_sessions', 'cash_registers', 'clients', 'users', 'products', 'branches', 'ai_report_logs', 'tenants']);
  for (const t of await m.query(`SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenantId'`)) {
    if (!known.has(t.table_name)) await m.query(`DELETE FROM "${t.table_name}" WHERE "tenantId" = $1`, [T]);
  }
  await q(`DELETE FROM audit_logs WHERE "tenantId" = $1`);
  await q(`DELETE FROM ai_report_logs WHERE "tenantId" = $1`);
  await q(`DELETE FROM payments WHERE "tenantId" = $1`);
  await q(`DELETE FROM sale_items WHERE "saleId" IN (SELECT id FROM sales WHERE "tenantId" = $1)`);
  await q(`DELETE FROM sales WHERE "tenantId" = $1`);
  await q(`DELETE FROM reservation_items WHERE "reservationId" IN (SELECT id FROM reservations WHERE "tenantId" = $1)`);
  await q(`DELETE FROM notifications WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = $1)`);
  await q(`DELETE FROM notification_devices WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = $1)`);
  await q(`DELETE FROM reservations WHERE "tenantId" = $1`);
  await q(`DELETE FROM inventory_movements WHERE "inventoryId" IN (SELECT id FROM inventory WHERE "tenantId" = $1)`);
  await q(`DELETE FROM inventory WHERE "tenantId" = $1`);
  await q(`DELETE FROM cash_sessions WHERE "tenantId" = $1`);
  await q(`DELETE FROM cash_registers WHERE "tenantId" = $1`);
  await q(`DELETE FROM clients WHERE "tenantId" = $1`);
  await q(`DELETE FROM user_roles WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = $1)`);
  await q(`DELETE FROM users WHERE "tenantId" = $1`);
  await q(`DELETE FROM product_promotions WHERE "productId" IN (SELECT id FROM products WHERE "tenantId" = $1)`);
  await q(`DELETE FROM variants WHERE "productId" IN (SELECT id FROM products WHERE "tenantId" = $1)`);
  await q(`DELETE FROM products WHERE "tenantId" = $1`);
  await q(`DELETE FROM branches WHERE "tenantId" = $1`);
  await q(`DELETE FROM subscription_history WHERE tenant_id = $1`);
  await q(`DELETE FROM subscriptions WHERE tenant_id = $1`);
  await q(`DELETE FROM tenants WHERE id = $1`);
}

/* ───────────────────────── Borradores en memoria ───────────────────────── */

interface Person { id: number; name: string; email: string; roles: string[]; branchId: number | null }
interface VariantInfo { id: number; productIdx: number; price: number; weight: number }
interface PayDraft { t: Date; amount: number; method: PaymentMethod; status: PaymentStatus; ref?: string }
interface ItemDraft { variantId: number; qty: number; unit: number }
interface SessionDraft {
  branchId: number; registerId: number; cashierId: number; openedAt: Date; closedAt: Date | null; openingAmount: number;
  openedById: number; closedById: number | null; sales: SaleDraft[]; closingAmount?: number; expectedAmount?: number; difference?: number; id?: number;
}
interface SaleDraft {
  t: Date; branchId: number; userId: number | null; sess?: SessionDraft; clientId?: number; channel: SaleChannel; status: SaleStatus;
  items: ItemDraft[]; total: number; payments: PayDraft[]; res?: ResDraft; id?: number;
}
interface ResDraft { t: Date; status: ReservationStatus; clientId: number; branchId: number; pickup: string; time: string; items: ItemDraft[]; sale?: SaleDraft; id?: number }
interface MovDraft { t: Date; branchId: number; variantId: number; type: MovementType; qty: number; userId: number; obs: (ids: { saleId?: number; resId?: number }) => string; sale?: SaleDraft; res?: ResDraft }
interface AuditDraft { t: Date; who: Person | null; action: string; entity: string; entityId?: number | string; summary: string; details?: unknown; method: string; path: string; status: number; ip: string }

interface BranchCtx {
  id: number; idx: number; encargado: Person; cashiers: Person[]; registerIds: number[];
}

/* ───────────────────────── Historial de ventas (para el pronóstico de demanda) ───────────────────────── */

/** Semanas de historial previas a la semana simulada. Con ellas el pronóstico de demanda (ML) tiene una serie real que aprender. */
const HISTORY_WEEKS = 12;

/** Unidades por semana y sucursal de un producto "promedio" en la semana simulada (el nivel al que debe llegar el historial). */
const BASE_WEEKLY_UNITS = 42;

/**
 * Comportamiento de ventas de cada producto como múltiplo de su nivel actual `L` (unidades por semana y sucursal).
 * Se reparten por producto para que el análisis muestre casos distintos: creciente, estable, decreciente, estacional y errático.
 */
const SALES_PROFILES: { name: string; units: (L: number, week: number, weeks: number, noise: number) => number }[] = [
  { name: 'creciente', units: (L, w, n, e) => L * (0.3 + (0.7 * w) / (n - 1) + e * 0.08) },
  { name: 'estable', units: (L, _w, _n, e) => L * (0.97 + e * 0.1) },
  { name: 'decreciente', units: (L, w, n, e) => L * (1.7 - (0.7 * w) / (n - 1) + e * 0.08) },
  { name: 'estacional', units: (L, w, _n, e) => L * (0.9 + 0.3 * Math.sin((w * Math.PI) / 2.5) + e * 0.1) },
  { name: 'creciente suave', units: (L, w, n, e) => L * (0.6 + (0.4 * w) / (n - 1) + e * 0.08) },
  { name: 'errático', units: (L, _w, _n, e) => L * (0.75 + e * 0.45) },
];

/** Ventas de las semanas anteriores a la simulada (sin turnos de caja) y sus movimientos de stock, balanceados con una entrada. */
function buildSalesHistory(r: Rng, b: BranchCtx, variants: VariantInfo[], clientIds: number[]) {
  const sales: SaleDraft[] = [];
  const movements: MovDraft[] = [];
  const soldByVariant = new Map<number, number>();
  const productIdxs = [...new Set(variants.map((v) => v.productIdx))];
  // Nivel de cada producto según su popularidad (suma de pesos de sus variantes), igual que reparte las ventas la simulación
  const weightOf = new Map(productIdxs.map((pi) => [pi, variants.filter((v) => v.productIdx === pi).reduce((a, v) => a + v.weight, 0)]));
  const totalWeight = [...weightOf.values()].reduce((a, b) => a + b, 0);

  for (let week = 0; week < HISTORY_WEEKS; week++) {
    const firstOff = DAYS + 7 * (HISTORY_WEEKS - week - 1); // días atrás del día más reciente de este bloque
    for (const pi of productIdxs) {
      const profile = SALES_PROFILES[pi % SALES_PROFILES.length];
      const level = BASE_WEEKLY_UNITS * productIdxs.length * (weightOf.get(pi)! / totalWeight);
      const target = Math.max(0, Math.round(profile.units(level, week, HISTORY_WEEKS, (r.next() - 0.5) * 2)));
      const pool = variants.filter((v) => v.productIdx === pi);
      let left = target;
      while (left > 0) {
        const qty = left >= 2 && r.chance(0.15) ? 2 : 1;
        left -= qty;
        const v = r.weighted(pool, pool.map((x) => x.weight));
        const off = firstOff + r.int(0, 6);
        const dow = dayAt(off, 12).getDay();
        if ((dow === 0 && r.chance(0.4)) || (dow !== 5 && dow !== 6 && r.chance(0.12))) { left += qty; continue; } // domingos más flojos
        const t = dayAt(off, r.int(9, 19), r.int(0, 59));
        const cashier = r.pick(b.cashiers);
        const total = money(v.price * qty);
        const method = r.weighted([PaymentMethod.EFECTIVO, PaymentMethod.TARJETA, PaymentMethod.QR, PaymentMethod.BILLETERA_MOVIL], [50, 25, 20, 5]);
        const sale: SaleDraft = {
          t, branchId: b.id, userId: cashier.id, channel: SaleChannel.POS, status: SaleStatus.COMPLETADA,
          items: [{ variantId: v.id, qty, unit: v.price }], total,
          clientId: r.chance(0.3) ? r.pick(clientIds) : undefined,
          payments: [{ t: addMin(t, 1), amount: total, method, status: PaymentStatus.APROBADO, ref: method === PaymentMethod.EFECTIVO ? undefined : `TX-${r.int(100000, 999999)}` }],
        };
        sales.push(sale);
        soldByVariant.set(v.id, (soldByVariant.get(v.id) ?? 0) + qty);
        movements.push({ t, branchId: b.id, variantId: v.id, type: MovementType.VENTA, qty, userId: cashier.id, obs: (ids) => `Venta POS #${ids.saleId}`, sale });
      }
    }
  }

  // Entrada histórica por lo vendido en ese período, para que el kardex quede coherente con el stock actual
  const tIn = dayAt(DAYS + 7 * HISTORY_WEEKS + 1, 9, 0);
  let i = 0;
  for (const [variantId, qty] of soldByVariant) {
    movements.push({ t: addMin(tIn, i++), branchId: b.id, variantId, type: MovementType.ENTRADA, qty, userId: b.encargado.id, obs: () => 'Stock histórico (compras de períodos anteriores)' });
  }
  return { sales, movements };
}

/* ───────────────────────── Simulación de una sucursal ───────────────────────── */

function simulateBranch(r: Rng, b: BranchCtx, variants: VariantInfo[], clientIds: number[]) {
  const stock = new Map<number, { stock: number; reserved: number }>();
  variants.forEach((v) => stock.set(v.id, { stock: 0, reserved: 0 }));
  const sessions: SessionDraft[] = [];
  const sales: SaleDraft[] = [];
  const reservations: ResDraft[] = [];
  const movements: MovDraft[] = [];
  const events: { t: Date; order: number; run: () => void }[] = [];
  let order = 0;
  const on = (t: Date, run: () => void) => events.push({ t, order: order++, run });
  const avail = (id: number) => { const s = stock.get(id)!; return s.stock - s.reserved; };
  const mov = (t: Date, variantId: number, type: MovementType, qty: number, userId: number, obs: MovDraft['obs'], extra: Partial<MovDraft> = {}) =>
    movements.push({ t, branchId: b.id, variantId, type, qty, userId, obs, ...extra });

  // Reglas de venta por variante (popularidad)
  const hot = [...variants].sort((x, y) => y.weight - x.weight).slice(0, 4).map((v) => v.id);

  // 1) Stock inicial (entrada por el encargado, antes de la semana)
  const t0 = dayAt(DAYS, 9, 0);
  on(t0, () => {
    variants.forEach((v, i) => {
      const qty = hot.includes(v.id) ? r.int(14, 20) : r.int(28, 55);
      stock.get(v.id)!.stock += qty;
      mov(addMin(t0, i), v.id, MovementType.ENTRADA, qty, b.encargado.id, () => 'Stock inicial de la sucursal');
    });
  });

  // 2) Reposición a mitad de semana
  const tRestock = dayAt(3, 8, 15);
  on(tRestock, () => {
    variants.forEach((v, i) => {
      if (avail(v.id) < 10) {
        const qty = r.int(18, 30);
        stock.get(v.id)!.stock += qty;
        mov(addMin(tRestock, i), v.id, MovementType.ENTRADA, qty, b.encargado.id, () => 'Reposición de mercadería (Textiles Andinos S.R.L.)');
      }
    });
  });

  // 3) Ajustes de inventario
  const tDamaged = dayAt(4, 11, 20);
  on(tDamaged, () => {
    const v = r.pick(variants);
    if (avail(v.id) >= 5) { stock.get(v.id)!.stock -= 2; mov(tDamaged, v.id, MovementType.AJUSTE, -2, b.encargado.id, () => 'Ajuste: prendas dañadas en bodega'); }
  });
  const tCount = dayAt(1, 18, 10);
  on(tCount, () => {
    for (const v of [...variants].sort(() => r.next() - 0.5).slice(0, 3)) {
      const s = stock.get(v.id)!;
      const target = Math.max(s.reserved, 3);
      if (s.stock > target + 1) {
        const delta = target - s.stock;
        s.stock = target;
        mov(tCount, v.id, MovementType.AJUSTE, delta, b.encargado.id, () => 'Ajuste por conteo físico (faltante)');
      }
    }
  });

  // 4) Turnos de caja y ventas por cajero (cajero N usa la Caja N)
  for (let off = DAYS - 1; off >= 0; off--) {
    const dow = dayAt(off, 12).getDay();
    const dayFactor = dow === 5 || dow === 6 ? 1.35 : dow === 0 ? 0.8 : 1;
    b.cashiers.forEach((cashier, ci) => {
      if (off === 0 && ci === 1) return; // hoy la segunda caja queda libre para poder abrirla
      let openedAt = dayAt(off, 8, r.int(15, 50));
      if (off === 0) openedAt = new Date(Math.min(openedAt.getTime(), NOW.getTime() - 45 * 60000));
      const closedAt = off === 0 ? null : dayAt(off, 20, r.int(0, 40));
      // Algunos turnos los abre/cierra el encargado en nombre del cajero (se ven como "asignada")
      const assigned = ci === 1 && (off === 5 || off === 2);
      const closedByManager = ci === 0 && off === 4;
      const sess: SessionDraft = {
        branchId: b.id, registerId: b.registerIds[ci], cashierId: cashier.id, openedAt, closedAt,
        openingAmount: r.pick([100, 150, 200, 300]), openedById: assigned ? b.encargado.id : cashier.id,
        closedById: closedAt ? (closedByManager ? b.encargado.id : cashier.id) : null, sales: [],
      };
      sessions.push(sess);

      const windowEnd = closedAt ? addMin(closedAt, -8) : addMin(NOW, -5);
      const windowStart = addMin(openedAt, 8);
      const span = windowEnd.getTime() - windowStart.getTime();
      if (span <= 0) return;
      const fullDay = 12 * 3600 * 1000;
      const count = Math.round(r.int(7, 12) * dayFactor * Math.min(1, span / fullDay));
      const times = Array.from({ length: count }, () => new Date(windowStart.getTime() + r.next() * span)).sort((x, y) => x.getTime() - y.getTime());

      for (const t of times) {
        on(t, () => {
          const nItems = r.weighted([1, 2, 3], [55, 30, 15]);
          const chosen: ItemDraft[] = [];
          const used = new Set<number>();
          for (let k = 0; k < nItems; k++) {
            const pool = variants.filter((v) => !used.has(v.id) && avail(v.id) >= 1);
            if (!pool.length) break;
            const v = r.weighted(pool, pool.map((x) => x.weight));
            used.add(v.id);
            const qty = r.chance(0.15) && avail(v.id) >= 2 ? 2 : 1;
            chosen.push({ variantId: v.id, qty, unit: v.price });
          }
          if (!chosen.length) return;
          const total = money(chosen.reduce((s, it) => s + it.unit * it.qty, 0));
          const method = r.weighted([PaymentMethod.EFECTIVO, PaymentMethod.TARJETA, PaymentMethod.QR, PaymentMethod.BILLETERA_MOVIL], [50, 25, 20, 5]);
          const sale: SaleDraft = {
            t, branchId: b.id, userId: cashier.id, sess, channel: SaleChannel.POS, status: SaleStatus.COMPLETADA, items: chosen, total,
            clientId: r.chance(0.35) ? r.weighted(clientIds, clientIds.map((_, i) => (i < 4 ? 4 - i : 1))) : undefined,
            payments: [{ t: addMin(t, 1), amount: total, method, status: PaymentStatus.APROBADO, ref: method === PaymentMethod.EFECTIVO ? undefined : `TX-${r.int(100000, 999999)}` }],
          };
          sess.sales.push(sale); sales.push(sale);
          for (const it of chosen) {
            stock.get(it.variantId)!.stock -= it.qty;
            mov(t, it.variantId, MovementType.VENTA, it.qty, cashier.id, (ids) => `Venta POS #${ids.saleId}`, { sale });
          }
        });
      }
    });
  }

  // 5) Reservas en distintos estados (las que ve el personal en "Reservas")
  const scenarios: { status: ReservationStatus; create: Date; end?: Date }[] = [
    { status: ReservationStatus.ATENDIDA, create: dayAt(5, 11, 0), end: dayAt(3, 17, 0) },
    { status: ReservationStatus.CANCELADA, create: dayAt(4, 15, 30), end: dayAt(3, 10, 0) },
    { status: ReservationStatus.CONFIRMADA, create: dayAt(2, 12, 0) },
    { status: ReservationStatus.LISTA, create: dayAt(2, 16, 0) },
    { status: ReservationStatus.PENDIENTE, create: dayAt(1, 10, 30) },
  ];
  scenarios.forEach((sc, si) => {
    // Los eventos de entrega/cancelación se programan desde el inicio (antes de ordenar la línea de tiempo)
    let res: ResDraft | undefined;

    on(sc.create, () => {
      const nItems = r.int(1, 2);
      const items: ItemDraft[] = [];
      const used = new Set<number>();
      for (let k = 0; k < nItems; k++) {
        const pool = variants.filter((v) => !used.has(v.id) && avail(v.id) >= 1);
        if (!pool.length) break;
        const v = r.pick(pool);
        used.add(v.id);
        items.push({ variantId: v.id, qty: 1, unit: v.price });
      }
      if (!items.length) return;
      const pickupDay = sc.status === ReservationStatus.ATENDIDA ? sc.end! : dayAt(-(si % 3 + 1), 12);
      const created: ResDraft = {
        t: sc.create, status: sc.status, clientId: r.pick(clientIds), branchId: b.id, pickup: ymd(pickupDay), time: r.pick(['10:00', '15:00', '17:30']), items,
      };
      const total = money(items.reduce((s, it) => s + it.unit * it.qty, 0));
      const deposit = money(total * 0.3);
      const hasDeposit = sc.status !== ReservationStatus.PENDIENTE && sc.status !== ReservationStatus.CANCELADA;
      created.sale = {
        t: sc.create, branchId: b.id, userId: null, clientId: created.clientId, channel: r.chance(0.5) ? SaleChannel.WEB : SaleChannel.MOVIL,
        status: SaleStatus.PENDIENTE, items, total, res: created,
        payments: hasDeposit ? [{ t: addMin(sc.create, 3), amount: deposit, method: PaymentMethod.TARJETA, status: PaymentStatus.APROBADO, ref: `RES-DEP-${r.int(10000, 99999)}` }] : [],
      };
      res = created;
      reservations.push(created);
      for (const it of items) {
        stock.get(it.variantId)!.reserved += it.qty;
        mov(sc.create, it.variantId, MovementType.RESERVA, it.qty, b.encargado.id, (ids) => `Reserva #${ids.resId}`, { res: created });
      }
    });

    if (sc.status === ReservationStatus.ATENDIDA) {
      on(sc.end!, () => {
        if (!res) return;
        for (const it of res.items) {
          const s = stock.get(it.variantId)!; s.reserved -= it.qty; s.stock -= it.qty;
          mov(sc.end!, it.variantId, MovementType.VENTA, it.qty, b.cashiers[0].id, (ids) => `Venta por reserva #${ids.resId} en caja`, { res });
        }
        const total = res.sale!.total;
        const paid = res.sale!.payments.reduce((a, p) => a + p.amount, 0);
        res.sale!.status = SaleStatus.COMPLETADA;
        res.sale!.payments.push({ t: sc.end!, amount: money(total - paid), method: PaymentMethod.EFECTIVO, status: PaymentStatus.APROBADO });
      });
    }
    if (sc.status === ReservationStatus.CANCELADA) {
      on(sc.end!, () => {
        if (!res) return;
        for (const it of res.items) {
          stock.get(it.variantId)!.reserved -= it.qty;
          mov(sc.end!, it.variantId, MovementType.LIBERACION_RESERVA, it.qty, b.encargado.id, (ids) => `Liberación de la reserva #${ids.resId} (cancelada)`, { res });
        }
      });
    }
  });

  events.sort((x, y) => x.t.getTime() - y.t.getTime() || x.order - y.order);
  events.forEach((e) => e.run());

  // 5b) Historial de semanas anteriores (alimenta el pronóstico de demanda)
  const history = buildSalesHistory(r, b, variants, clientIds);
  sales.push(...history.sales);
  movements.push(...history.movements);

  // 6) Cierre de cada turno: esperado = inicial + ventas en efectivo; el cajero cuenta con pequeñas diferencias
  for (const s of sessions) {
    const cash = s.sales.reduce((sum, sale) => sum + sale.payments.filter((p) => p.method === PaymentMethod.EFECTIVO).reduce((a, p) => a + p.amount, 0), 0);
    s.expectedAmount = money(s.openingAmount + cash);
    if (s.closedAt) {
      const p = r.next();
      const diff = p < 0.6 ? 0 : p < 0.75 ? -5 : p < 0.85 ? 3 : p < 0.95 ? -10 : 10;
      s.closingAmount = money(s.expectedAmount + diff);
      s.difference = money(diff);
    }
  }

  return { sessions, sales, reservations, movements, stock };
}

/* ───────────────────────── Una empresa completa ───────────────────────── */

export interface CredentialRow { company: string; role: string; where: string; email: string }

function credentialsFor(def: CompanyDef): CredentialRow[] {
  const rows: CredentialRow[] = [{ company: def.name, role: 'Administrador', where: 'Toda la empresa', email: `admin@${def.domain}` }];
  let n = 0;
  def.branches.forEach((b, bi) => {
    rows.push({ company: def.name, role: 'Encargado', where: b.name, email: `encargado${bi + 1}@${def.domain}` });
    for (let ci = 0; ci < 2; ci++) { n++; rows.push({ company: def.name, role: 'Cajero', where: `${b.name} · Caja ${ci + 1}`, email: `cajero${n}@${def.domain}` }); }
  });
  rows.push({ company: def.name, role: 'Cliente (tienda web)', where: 'Compra y reserva en la tienda', email: `cliente@${def.domain}` });
  return rows;
}

async function seedCompany(ds: DataSource, def: CompanyDef, g: Globals, passwordHash: string, reset: boolean): Promise<{ created: boolean; creds: CredentialRow[] }> {
  const email = (local: string) => `${local}@${def.domain}`;
  const creds = credentialsFor(def);

  const existing = await ds.getRepository(Tenant).findOne({ where: { slug: def.slug } });
  if (existing && !reset) {
    console.log(`  · ${def.name}: ya existe (use "npm run seed:demo:reset" para recrearla)`);
    return { created: false, creds };
  }

  const demoEmails = [email('admin'), email('encargado1'), email('encargado2'), email('cajero1'), email('cajero2'), email('cajero3'), email('cajero4'), email('cliente')];
  const clash = await ds.query(`SELECT email FROM users WHERE email = ANY($1) AND "tenantId" <> $2`, [demoEmails, existing?.id ?? 0]);
  if (clash.length) throw new Error(`Ya existen usuarios con correos demo en otra empresa: ${clash.map((c: any) => c.email).join(', ')}`);

  const r = rng(def.seed * 7919);

  await ds.transaction(async (m) => {
    if (existing) { console.log(`  · ${def.name}: eliminando datos demo anteriores…`); await deleteTenantData(m, existing.id); }

    const created = dayAt(14, 9, 0);
    const T = (await m.insert(Tenant, { slug: def.slug, name: def.name, taxId: def.taxId, active: true, createdAt: created } as any)).identifiers[0].id as number;
    // Luna: plan anual vigente; Sol: plan mensual que vence en 20 días (para mostrar vigencias en el panel SuperAdmin)
    const yearly = def.planCode === 'PROFESIONAL';
    await m.insert(Subscription, { tenantId: T, planId: g.plans[def.planCode], status: 'ACTIVE', billingCycle: yearly ? 'YEARLY' : 'MONTHLY', startDate: created, endDate: addMin(new Date(), (yearly ? 300 : 20) * 1440) } as any);
    await m.insert(SubscriptionHistory, { tenantId: T, planId: g.plans[def.planCode], action: 'SUBSCRIBE', notes: 'Alta de empresa demo', changedAt: created } as any);

    // Sucursales
    const branchIds = await bulkInsert(m, Branch, def.branches.map((b, i) => ({
      tenantId: T, name: b.name, address: b.address, phone: b.phone, cityId: g.cities[b.city], active: true, createdAt: addMin(created, 20 + i),
    })));

    // Usuarios: admin, 1 encargado y 2 cajeros por sucursal
    const roleOf = (n: string) => g.roles[n];
    const people: Person[] = [];
    const insertUser = async (name: string, local: string, role: string, branchId: number | null, at: Date): Promise<Person> => {
      const id = (await m.insert(User, {
        tenantId: T, name, email: email(local), passwordHash, active: true, mustChangePassword: false, emailVerified: true, branchId, createdAt: at,
      } as any)).identifiers[0].id as number;
      await m.insert(UserRole, { userId: id, roleId: roleOf(role), active: true, assignedAt: at } as any);
      const p: Person = { id, name, email: email(local), roles: [role], branchId };
      people.push(p);
      return p;
    };
    const admin = await insertUser(def.admin, 'admin', 'ADMIN', null, addMin(created, 5));
    const branches: BranchCtx[] = [];
    let cajeroNo = 0;
    for (let bi = 0; bi < def.branches.length; bi++) {
      const enc = await insertUser(def.encargados[bi], `encargado${bi + 1}`, 'ENCARGADO', branchIds[bi], addMin(created, 40 + bi));
      const cashiers: Person[] = [];
      for (let ci = 0; ci < 2; ci++) {
        cajeroNo++;
        cashiers.push(await insertUser(def.cajeros[bi][ci], `cajero${cajeroNo}`, 'CAJERO', branchIds[bi], addMin(created, 50 + cajeroNo)));
      }
      // Cajas: una por cajero
      const registerIds = await bulkInsert(m, CashRegister, [1, 2].map((n) => ({ tenantId: T, branchId: branchIds[bi], name: `Caja ${n}`, active: true, createdAt: addMin(created, 70 + n) })));
      branches.push({ id: branchIds[bi], idx: bi, encargado: enc, cashiers, registerIds });
    }

    // Clientes (el primero tiene cuenta para la tienda web)
    const clientIds: number[] = [];
    for (let i = 0; i < CLIENT_FIRST.length; i++) {
      const local = i === 0 ? 'cliente' : `cliente${String(i + 1).padStart(2, '0')}`;
      let userId: number | null = null;
      if (i === 0) {
        const cu = await insertUser(`${CLIENT_FIRST[0]} ${CLIENT_LAST[0]}`, 'cliente', 'CLIENTE', null, addMin(created, 90));
        userId = cu.id;
        people.pop(); // el cliente no es personal
      }
      const id = (await m.insert(Client, {
        tenantId: T, name: CLIENT_FIRST[i], lastName: CLIENT_LAST[i], email: email(local), phone: `7${r.int(1000000, 9999999)}`,
        active: true, userId, registrationDate: addMin(created, 100 + i),
      } as any)).identifiers[0].id as number;
      clientIds.push(id);
    }

    // Colecciones (catálogo compartido) y productos con variantes talla x color
    const collectionIds: Record<string, number> = {};
    for (const c of def.collections) collectionIds[c.name] = await findOrCreate(m, Collection, { name: c.name, seasonId: g.seasonId }, { description: c.description, active: true });

    const variants: VariantInfo[] = [];
    const productIds: number[] = [];
    for (let pi = 0; pi < def.products.length; pi++) {
      const p = def.products[pi];
      const productId = (await m.insert(Product, {
        tenantId: T, name: p.name, price: p.price, active: true, categoryId: g.categories[p.category], collectionId: collectionIds[p.collection],
        arEnabled: false, arType: AR_TYPE[p.category],
      } as any)).identifiers[0].id as number;
      productIds.push(productId);
      const rows: any[] = [];
      const meta: { size: string; ci: number }[] = [];
      for (const size of SIZES) p.colors.forEach((color, ci) => {
        rows.push({ sku: `${def.skuPrefix}-${String(pi + 1).padStart(2, '0')}-${size}-${noAccents(color).slice(0, 3).toUpperCase()}`, active: true, productId, sizeId: g.sizes[size], colorId: g.colors[color] });
        meta.push({ size, ci });
      });
      const ids = await bulkInsert(m, Variant, rows);
      ids.forEach((id, i) => variants.push({ id, productIdx: pi, price: p.price, weight: p.weight * SIZE_WEIGHT[meta[i].size] * (meta[i].ci === 0 ? 1.3 : 0.9) }));
    }

    // Simulación de cada sucursal: stock, movimientos, turnos, ventas y reservas
    const sims = branches.map((b) => ({ b, ...simulateBranch(r, b, variants, clientIds) }));

    // Turnos de caja
    const allSessions = sims.flatMap((s) => s.sessions);
    const sessionIds = await bulkInsert(m, CashSession, allSessions.map((s) => ({
      tenantId: T, branchId: s.branchId, cashierId: s.cashierId, registerId: s.registerId, openingAmount: s.openingAmount, openedAt: s.openedAt,
      closingAmount: s.closingAmount ?? null, expectedAmount: s.closedAt ? s.expectedAmount : null, difference: s.difference ?? null,
      closedAt: s.closedAt, openedById: s.openedById, closedById: s.closedById, status: s.closedAt ? CashSessionStatus.CLOSED : CashSessionStatus.OPEN,
    })));
    allSessions.forEach((s, i) => { s.id = sessionIds[i]; });

    // Reservas
    const allReservations = sims.flatMap((s) => s.reservations);
    const resIds = await bulkInsert(m, Reservation, allReservations.map((x) => ({
      tenantId: T, status: x.status, date: x.pickup, approximateTime: x.time, registrationDate: x.t, clientId: x.clientId, branchId: x.branchId,
    })));
    allReservations.forEach((x, i) => { x.id = resIds[i]; });
    await bulkInsert(m, ReservationItem, allReservations.flatMap((x) => x.items.map((it) => ({ quantity: it.qty, reservationId: x.id, variantId: it.variantId }))));

    // Ventas (POS + las de reservas), sus ítems y pagos
    const allSales = [...sims.flatMap((s) => s.sales), ...allReservations.map((x) => x.sale!)];
    const subtotal = (s: SaleDraft) => s.total;
    const saleIds = await bulkInsert(m, Sale, allSales.map((s) => ({
      tenantId: T, channel: s.channel, status: s.status, date: s.t, subtotal: subtotal(s), discount: null, total: s.total, branchId: s.branchId,
      clientId: s.clientId ?? null, userId: s.userId, cashSessionId: s.sess?.id ?? null, reservationId: s.res?.id ?? null,
    })));
    allSales.forEach((s, i) => { s.id = saleIds[i]; });
    await bulkInsert(m, SaleItem, allSales.flatMap((s) => s.items.map((it) => ({ saleId: s.id, variantId: it.variantId, quantity: it.qty, unitPrice: it.unit, subtotal: money(it.unit * it.qty) }))));
    await bulkInsert(m, Payment, allSales.flatMap((s) => s.payments.map((p) => ({
      tenantId: T, saleId: s.id, amount: p.amount, method: p.method, status: p.status, date: p.t, transactionReference: p.ref ?? null,
    }))));

    // Inventario final por sucursal y sus movimientos
    const invKey = (branchId: number, variantId: number) => `${branchId}:${variantId}`;
    const invRows: any[] = [];
    const invOrder: string[] = [];
    for (const s of sims) for (const v of variants) {
      const st = s.stock.get(v.id)!;
      invRows.push({ tenantId: T, branchId: s.b.id, variantId: v.id, stock: st.stock, reserved: st.reserved, stockMin: 5, stockMax: 80 });
      invOrder.push(invKey(s.b.id, v.id));
    }
    const invIds = await bulkInsert(m, Inventory, invRows);
    const invMap = new Map(invOrder.map((k, i) => [k, invIds[i]]));

    const allMovs = sims.flatMap((s) => s.movements).sort((a, b2) => a.t.getTime() - b2.t.getTime());
    await bulkInsert(m, InventoryMovement, allMovs.map((mv) => ({
      inventoryId: invMap.get(invKey(mv.branchId, mv.variantId)), type: mv.type, quantity: mv.qty, userId: mv.userId, movementDate: mv.t,
      observation: mv.obs({ saleId: mv.sale?.id, resId: mv.res?.id }),
    })), 300);

    // Bitácora de actividad
    const audits: AuditDraft[] = [];
    const A = (d: AuditDraft) => audits.push(d);
    const byId = new Map(people.map((p) => [p.id, p]));
    A({ t: created, who: null, action: 'TENANT_REGISTER', entity: 'tenants', entityId: T, summary: `Registró la empresa "${def.name}" (Plan ${def.planCode === 'PROFESIONAL' ? 'Profesional' : 'Starter'})`, method: 'POST', path: '/saas/tenants/register', status: 201, ip: '190.129.40.12' });
    A({ t: addMin(created, 4), who: admin, action: 'EMAIL_VERIFIED', entity: 'tenants', entityId: T, summary: 'Verificó el correo y activó la cuenta', method: 'POST', path: '/saas/tenants/verify-email', status: 201, ip: '190.129.40.12' });
    def.branches.forEach((b, i) => A({ t: addMin(created, 20 + i), who: admin, action: 'CREATE', entity: 'branches', entityId: branchIds[i], summary: `Creó Sucursales "${b.name}" #${branchIds[i]}`, details: { name: b.name, cityId: g.cities[b.city] }, method: 'POST', path: '/branches', status: 201, ip: '190.129.40.12' }));
    people.filter((p) => p.id !== admin.id).forEach((p, i) => A({ t: addMin(created, 40 + i * 2), who: admin, action: 'CREATE', entity: 'users', entityId: p.id, summary: `Creó Usuarios "${p.name}" #${p.id}`, details: { name: p.name, roleName: p.roles[0], branchId: p.branchId }, method: 'POST', path: '/users', status: 201, ip: '190.129.40.12' }));
    branches.forEach((b) => b.registerIds.forEach((rid, n) => A({ t: addMin(created, 70 + n), who: admin, action: 'CREATE', entity: 'cash-registers', entityId: rid, summary: `Creó Cajas "Caja ${n + 1}" #${rid}`, details: { name: `Caja ${n + 1}`, branchId: b.id }, method: 'POST', path: '/cash-registers', status: 201, ip: '190.129.40.12' })));
    def.products.forEach((p, i) => A({ t: addMin(created, 110 + i * 3), who: admin, action: 'CREATE', entity: 'products', entityId: productIds[i], summary: `Creó Productos "${p.name}" #${productIds[i]}`, details: { name: p.name, price: p.price }, method: 'POST', path: '/products', status: 201, ip: '190.129.40.12' }));

    for (const s of sims) {
      const ip = `192.168.${s.b.idx + 1}.${20 + s.b.idx}`;
      for (let off = DAYS; off >= 0; off--) {
        A({ t: dayAt(off, 8, 5 + s.b.idx), who: s.b.encargado, action: 'LOGIN', entity: 'auth', summary: 'Inició sesión (ENCARGADO)', method: 'POST', path: '/auth/login', status: 200, ip });
        if (off % 2 === 0) A({ t: dayAt(off, 7, 50), who: admin, action: 'LOGIN', entity: 'auth', summary: 'Inició sesión (ADMIN)', method: 'POST', path: '/auth/login', status: 200, ip: '190.129.40.12' });
      }
      s.movements.filter((mv) => mv.type === MovementType.ENTRADA || mv.type === MovementType.AJUSTE).forEach((mv) => {
        A({ t: mv.t, who: byId.get(mv.userId) ?? null, action: 'STOCK_MOVEMENT', entity: 'inventory', summary: 'Registró un movimiento de stock', details: { type: mv.type, quantity: mv.qty, observation: mv.obs({}) }, method: 'POST', path: '/inventory/movement', status: 201, ip });
      });
      for (const sess of s.sessions) {
        const cashier = byId.get(sess.cashierId)!;
        const opener = byId.get(sess.openedById)!;
        A({ t: addMin(sess.openedAt, -3), who: cashier, action: 'LOGIN', entity: 'auth', summary: 'Inició sesión (CAJERO)', method: 'POST', path: '/auth/login', status: 200, ip });
        A({ t: sess.openedAt, who: opener, action: 'CASH_OPEN', entity: 'cash-sessions', entityId: sess.id, summary: `Abrió caja #${sess.registerId}${opener.id !== cashier.id ? ` para el cajero #${cashier.id}` : ''}`, details: { registerId: sess.registerId, cashierId: sess.cashierId, openingAmount: sess.openingAmount }, method: 'POST', path: '/cash-sessions/open', status: 201, ip });
        if (sess.closedAt) A({ t: sess.closedAt, who: byId.get(sess.closedById!)!, action: 'CASH_CLOSE', entity: 'cash-sessions', entityId: sess.id, summary: `Cerró caja (turno #${sess.id})`, details: { closingAmount: sess.closingAmount }, method: 'POST', path: `/cash-sessions/${sess.id}/close`, status: 201, ip });
        for (const sale of sess.sales) A({ t: sale.t, who: cashier, action: 'CREATE', entity: 'pos', entityId: sale.id, summary: `Creó Punto de venta #${sale.id}`, method: 'POST', path: '/pos/sales', status: 201, ip });
      }
    }
    const c3 = branches[1].cashiers[0];
    A({ t: dayAt(3, 8, 20), who: c3, action: 'LOGIN_FAILED', entity: 'auth', summary: 'Intento de acceso fallido (credenciales incorrectas)', method: 'POST', path: '/auth/login', status: 401, ip: '192.168.2.31' });
    A({ t: dayAt(3, 8, 21), who: c3, action: 'LOGIN_FAILED', entity: 'auth', summary: 'Intento de acceso fallido (credenciales incorrectas)', method: 'POST', path: '/auth/login', status: 401, ip: '192.168.2.31' });
    A({ t: dayAt(2, 13, 40), who: branches[0].encargado, action: 'DENIED', entity: 'cash-sessions', summary: 'Acción denegada en Turnos de caja: No puedes cerrar cajas de otra sucursal', method: 'POST', path: '/cash-sessions/1/close', status: 403, ip: '192.168.1.20' });

    audits.sort((x, y) => x.t.getTime() - y.t.getTime());
    await bulkInsert(m, AuditLog, audits.map((a) => ({
      tenantId: T, userId: a.who?.id ?? null, userName: a.who?.name ?? def.admin, userEmail: a.who?.email ?? email('admin'),
      userRoles: a.who?.roles.join(',') ?? 'ADMIN', branchId: a.who?.branchId ?? null, action: a.action, entity: a.entity,
      entityId: a.entityId !== undefined ? String(a.entityId) : null, summary: a.summary, details: a.details ? JSON.stringify(a.details) : null,
      method: a.method, path: a.path, statusCode: a.status, ip: a.ip, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36', createdAt: a.t,
    })), 150);

    // Resumen
    const low = sims.reduce((n, s) => n + [...s.stock.values()].filter((x) => x.stock - x.reserved <= 5).length, 0);
    console.log(`  ✔ ${def.name}: ${def.branches.length} sucursales, ${people.length} usuarios, ${variants.length} variantes, ` +
      `${allSessions.length} turnos de caja, ${allSales.length} ventas, ${allReservations.length} reservas, ${allMovs.length} movimientos de stock, ${audits.length} eventos de bitácora, ${low} variantes con stock bajo`);
  });

  return { created: true, creds };
}

/* ───────────────────────── Programa principal ───────────────────────── */

export async function main() {
  loadEnv();
  const reset = process.argv.includes('--reset');
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'postgres',
    password: String(process.env.DB_PASSWORD ?? ''),
    database: process.env.DB_DATABASE || 'ecommerce_ropa',
    entities: [path.join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  });

  console.log(`\n=== Datos demo sobre "${ds.options.database as string}" ${reset ? '(con reinicio de las empresas demo)' : ''} ===`);
  await ds.initialize();
  try {
    const g = await ensureGlobals(ds);
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const all: CredentialRow[] = [];
    for (const def of COMPANIES) all.push(...(await seedCompany(ds, def, g, hash, reset)).creds);

    if (all.length) {
      console.log(`\nCredenciales (contraseña de TODOS: ${DEMO_PASSWORD})`);
      console.log('─'.repeat(92));
      for (const c of all) console.log(`${c.company.padEnd(14)} ${c.role.padEnd(20)} ${c.email.padEnd(26)} ${c.where}`);
      console.log('─'.repeat(92));
    }
    console.log('\nListo. Inicia sesión en /login con cualquiera de esos correos.\n');
  } finally {
    await ds.destroy();
  }
}
