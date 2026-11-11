/**
 * Repositorio SQLite de la caja POS offline.
 *  - Copia local de la sucursal del cajero, sus existencias/precios y clientes mínimos.
 *  - Ventas locales con su detalle. Cada venta se guarda en UNA transacción junto con su
 *    operación de sincronización y el descuento de existencias, así que o queda todo o nada.
 */
import { getDatabase } from './sqlite';
import { OfflineOperation } from './offlineQueue.repository';
import { PosItem, remainingAfterSale } from '../pos/posLogic';

export interface PosBranch { id: number; name: string }
export interface PosClient { id: number; name: string; lastName: string; email: string | null; phone: string | null }

export interface RemotePosProduct {
  productId: number; variantId: number; productName: string; sku: string; size: string; color: string;
  price: number; finalPrice: number; available: number;
}

export interface LocalSaleLine { variantId: number; productName: string; size: string; color: string; quantity: number; unitPrice: number }

export interface LocalSale {
  operationId: string;
  createdAt: string;
  total: number;
  clientName: string | null;
  status: OfflineOperation['status'];
  lastError?: string | null;
  saleId?: number;
  conflicts?: { type: string; message: string }[];
  items: LocalSaleLine[];
}

export const posRepository = {
  async getMeta(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_metadata WHERE key = ?', [key]);
    return row?.value ?? null;
  },

  async setMeta(key: string, value: string) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, Date.now()],
    );
  },

  /** Reemplaza la copia local de la sucursal con lo descargado (una sola transacción). */
  async saveSnapshot(branch: PosBranch, products: RemotePosProduct[], clients: PosClient[]) {
    const db = await getDatabase();
    const now = Date.now();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO pos_branches (id, name, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
        [branch.id, branch.name, now],
      );
      await txn.runAsync('DELETE FROM pos_inventory WHERE branch_id = ?', [branch.id]);
      for (const p of products) {
        await txn.runAsync(
          `INSERT INTO pos_inventory (variant_id, branch_id, product_id, product_name, sku, size, color, base_price, final_price, available, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.variantId, branch.id, p.productId, p.productName, p.sku, p.size, p.color, p.price, p.finalPrice, p.available, now],
        );
      }
      for (const c of clients) {
        await txn.runAsync(
          `INSERT INTO pos_clients (id, name, last_name, email, phone, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_name = excluded.last_name,
             email = excluded.email, phone = excluded.phone, updated_at = excluded.updated_at`,
          [c.id, c.name, c.lastName, c.email, c.phone, now],
        );
      }
    });
    await this.setMeta('pos_downloaded_at', String(now));
  },

  async getBranch(id: number): Promise<PosBranch | null> {
    const db = await getDatabase();
    return db.getFirstAsync<PosBranch>('SELECT id, name FROM pos_branches WHERE id = ?', [id]);
  },

  async searchInventory(branchId: number, search: string): Promise<PosItem[]> {
    const db = await getDatabase();
    const like = `%${search.trim()}%`;
    const rows = await db.getAllAsync<any>(
      `SELECT variant_id, product_name, size, color, final_price, available FROM pos_inventory
        WHERE branch_id = ? AND available > 0 AND (product_name LIKE ? OR sku LIKE ?)
        ORDER BY product_name, size LIMIT 80`,
      [branchId, like, like],
    );
    return rows.map((r) => ({
      variantId: r.variant_id, productName: r.product_name, size: r.size ?? '', color: r.color ?? '',
      finalPrice: r.final_price, available: r.available,
    }));
  },

  async searchClients(search: string): Promise<PosClient[]> {
    const db = await getDatabase();
    const like = `%${search.trim()}%`;
    const rows = await db.getAllAsync<any>(
      `SELECT id, name, last_name, email, phone FROM pos_clients
        WHERE name LIKE ? OR last_name LIKE ? OR email LIKE ? ORDER BY name LIMIT 20`,
      [like, like, like],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, lastName: r.last_name, email: r.email, phone: r.phone }));
  },

  /**
   * Registra una venta de contado sin conexión: operación de sincronización (PENDIENTE),
   * venta local, su detalle y el descuento de existencias conocidas, todo atómico.
   */
  async createLocalSale(
    op: OfflineOperation,
    sale: { branchId: number; clientId: number | null; clientName: string | null; total: number },
    lines: LocalSaleLine[],
  ) {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO offline_operations (operation_id, tenant_id, user_id, type, client_created_at, payload, summary, status, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [op.operationId, op.tenantId, op.userId, op.type, op.clientCreatedAt, JSON.stringify(op.payload), op.summary, op.status, op.attempts],
      );
      await txn.runAsync(
        `INSERT INTO local_sales (operation_id, tenant_id, branch_id, user_id, client_id, client_name, payment_method, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'EFECTIVO', ?, ?)`,
        [op.operationId, op.tenantId, sale.branchId, op.userId, sale.clientId, sale.clientName, sale.total, op.clientCreatedAt],
      );
      for (const l of lines) {
        await txn.runAsync(
          `INSERT INTO local_sale_items (operation_id, variant_id, product_name, size, color, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [op.operationId, l.variantId, l.productName, l.size, l.color, l.quantity, l.unitPrice, Math.round(l.unitPrice * l.quantity * 100) / 100],
        );
        const cur = await txn.getFirstAsync<{ available: number }>(
          'SELECT available FROM pos_inventory WHERE variant_id = ? AND branch_id = ?', [l.variantId, sale.branchId]);
        if (cur) {
          await txn.runAsync(
            'UPDATE pos_inventory SET available = ? WHERE variant_id = ? AND branch_id = ?',
            [remainingAfterSale(cur.available, l.quantity), l.variantId, sale.branchId],
          );
        }
      }
    });
  },

  /** Ventas locales del cajero con su estado de sincronización (join con la cola). */
  async listLocalSales(tenantId: number, userId: number): Promise<LocalSale[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT s.operation_id, s.created_at, s.total, s.client_name, o.status, o.last_error, o.result, o.conflicts
         FROM local_sales s JOIN offline_operations o ON o.operation_id = s.operation_id
        WHERE s.tenant_id = ? AND s.user_id = ? ORDER BY s.created_at DESC LIMIT 100`,
      [tenantId, userId],
    );
    const out: LocalSale[] = [];
    for (const r of rows) {
      const items = await db.getAllAsync<any>(
        'SELECT variant_id, product_name, size, color, quantity, unit_price FROM local_sale_items WHERE operation_id = ?', [r.operation_id]);
      const result = r.result ? JSON.parse(r.result) : undefined;
      out.push({
        operationId: r.operation_id, createdAt: r.created_at, total: r.total, clientName: r.client_name,
        status: r.status, lastError: r.last_error, saleId: result?.saleId,
        conflicts: r.conflicts ? JSON.parse(r.conflicts) : undefined,
        items: items.map((i) => ({ variantId: i.variant_id, productName: i.product_name, size: i.size, color: i.color, quantity: i.quantity, unitPrice: i.unit_price })),
      });
    }
    return out;
  },
};
