/**
 * Verifica la migración v3 y el repositorio de la caja POS contra un SQLite REAL (node:sqlite),
 * sustituyendo expo-sqlite por un adaptador mínimo con la misma API asíncrona.
 * Ejecutar desde mobile/ (Node >= 22):
 *   ../backend/node_modules/.bin/ts-node --skip-project --compiler-options '{"module":"commonjs","esModuleInterop":true,"target":"es2020"}' scripts/pos-sqlite.check.ts
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const Module = require('module');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

class Adapter {
  db = new DatabaseSync(':memory:');
  async execAsync(sql: string) { this.db.exec(sql); }
  async runAsync(sql: string, params: any[] = []) { const r = this.db.prepare(sql).run(...params); return { changes: r.changes }; }
  async getFirstAsync(sql: string, params: any[] = []) { return this.db.prepare(sql).get(...params) ?? null; }
  async getAllAsync(sql: string, params: any[] = []) { return this.db.prepare(sql).all(...params); }
  async withTransactionAsync(fn: () => Promise<void>) {
    this.db.exec('BEGIN');
    try { await fn(); this.db.exec('COMMIT'); } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
const shared = new Adapter();
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: any[]) {
  if (request === 'expo-sqlite') return require.resolve('./.expo-sqlite-shim.js');
  return origResolve.call(this, request, ...rest);
};
require('fs').writeFileSync(__dirname + '/.expo-sqlite-shim.js', 'module.exports = { openDatabaseAsync: async () => global.__sqliteAdapter };');
(global as any).__sqliteAdapter = shared;

(async () => {
  const { getDatabase } = require('../src/database/sqlite');
  const { posRepository } = require('../src/database/pos.repository');
  const db = await getDatabase();
  const version = (await db.getFirstAsync('PRAGMA user_version')).user_version;
  assert.equal(version, 3, 'migración hasta la versión 3');

  const branch = { id: 5, name: 'Sucursal Central' };
  const products = [
    { productId: 1, variantId: 10, productName: 'Vestido', sku: 'V-10', size: 'M', color: 'Negro', price: 100, finalPrice: 90, available: 3 },
    { productId: 2, variantId: 11, productName: 'Blusa', sku: 'B-11', size: 'S', color: 'Rojo', price: 60, finalPrice: 60, available: 1 },
  ];
  await posRepository.saveSnapshot(branch, products, [{ id: 7, name: 'Ana', lastName: 'Rojas', email: 'ana@x.com', phone: null }]);
  assert.equal((await posRepository.searchInventory(5, 'ves')).length, 1, 'búsqueda de existencias');
  assert.equal((await posRepository.searchClients('rojas')).length, 1, 'búsqueda de clientes');

  const op = (id: string) => ({ operationId: id, tenantId: 1, userId: 9, type: 'POS_CASH_SALE', clientCreatedAt: new Date().toISOString(),
    payload: { items: [{ variantId: 10, quantity: 2, unitPrice: 90 }] }, summary: 'Venta', status: 'PENDIENTE', attempts: 0 });
  const line = { variantId: 10, productName: 'Vestido', size: 'M', color: 'Negro', quantity: 2, unitPrice: 90 };

  await posRepository.createLocalSale(op('aaaaaaaa-0000-4000-8000-000000000001'), { branchId: 5, clientId: 7, clientName: 'Ana Rojas', total: 180 }, [line]);
  assert.equal((await db.getFirstAsync('SELECT available FROM pos_inventory WHERE variant_id = 10')).available, 1, 'descuenta la existencia local');
  let sales = await posRepository.listLocalSales(1, 9);
  assert.equal(sales.length, 1);
  assert.equal(sales[0].status, 'PENDIENTE', 'estado derivado de la cola (sin duplicarlo)');
  assert.equal(sales[0].items[0].quantity, 2);

  // Atomicidad: una venta que falla a mitad (cantidad inválida) no deja ni cola, ni venta, ni descuento
  await assert.rejects(posRepository.createLocalSale(op('aaaaaaaa-0000-4000-8000-000000000002'), { branchId: 5, clientId: null, clientName: null, total: 0 }, [{ ...line, quantity: 0 }]));
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM offline_operations WHERE operation_id LIKE '%0002'")).n, 0, 'rollback de la cola');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) n FROM local_sales')).n, 1, 'rollback de la venta');
  assert.equal((await db.getFirstAsync('SELECT available FROM pos_inventory WHERE variant_id = 10')).available, 1, 'rollback del stock');

  // Vender más de lo conocido nunca deja existencia negativa
  await posRepository.createLocalSale(op('aaaaaaaa-0000-4000-8000-000000000003'), { branchId: 5, clientId: null, clientName: null, total: 270 }, [{ ...line, quantity: 3 }]);
  assert.equal((await db.getFirstAsync('SELECT available FROM pos_inventory WHERE variant_id = 10')).available, 0, 'existencia no negativa');

  // Integridad referencial: quitar la operación de la cola elimina su venta y detalle (ON DELETE CASCADE)
  await db.runAsync("DELETE FROM offline_operations WHERE operation_id = 'aaaaaaaa-0000-4000-8000-000000000001'");
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM local_sales WHERE operation_id LIKE '%0001'")).n, 0);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM local_sale_items WHERE operation_id LIKE '%0001'")).n, 0);

  // Una venta no puede existir sin operación de sincronización ni con otro método de pago
  await assert.rejects(db.runAsync("INSERT INTO local_sales (operation_id, tenant_id, branch_id, user_id, total, created_at) VALUES ('x', 1, 5, 9, 1, 'now')"), /FOREIGN KEY/);
  await assert.rejects(db.runAsync("INSERT INTO local_sales (operation_id, tenant_id, branch_id, user_id, payment_method, total, created_at) VALUES ('aaaaaaaa-0000-4000-8000-000000000003', 1, 5, 9, 'TARJETA', 1, 'now')"), /CHECK/);

  // Re-descargar reemplaza las existencias de la sucursal sin tocar las ventas locales
  await posRepository.saveSnapshot(branch, products, []);
  assert.equal((await db.getFirstAsync('SELECT available FROM pos_inventory WHERE variant_id = 10')).available, 3);
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) n FROM local_sales')).n, 1, 'las ventas locales sobreviven a la descarga');

  require('fs').unlinkSync(__dirname + '/.expo-sqlite-shim.js');
  console.log('✔ pos-sqlite: migración, atomicidad, integridad referencial y descuento de existencias verificados');
})().catch((e) => { try { require('fs').unlinkSync(__dirname + '/.expo-sqlite-shim.js'); } catch { /* */ } console.error('✖', e); process.exit(1); });
