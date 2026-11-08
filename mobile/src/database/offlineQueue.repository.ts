/**
 * Repositorio SQLite de la cola de operaciones offline.
 * Cada operación lleva un UUID generado en el dispositivo: si se reenvía,
 * el backend la reconoce como DUPLICATE y no la vuelve a aplicar.
 */
import { getDatabase } from './sqlite';

export type OfflineStatus = 'PENDIENTE' | 'SINCRONIZANDO' | 'SINCRONIZADA' | 'CON_CONFLICTO' | 'RECHAZADA' | 'ERROR';

export interface OfflineOperation {
  operationId: string;
  tenantId: number;
  userId: number;
  type: 'RESERVATION' | 'POS_CASH_SALE';
  clientCreatedAt: string;
  payload: Record<string, any>;
  summary: string;
  status: OfflineStatus;
  attempts: number;
  lastError?: string | null;
  result?: any;
  conflicts?: { type: string; message: string; detail?: any }[];
  syncedAt?: string | null;
}

const toRow = (r: any): OfflineOperation => ({
  operationId: r.operation_id,
  tenantId: r.tenant_id,
  userId: r.user_id,
  type: r.type,
  clientCreatedAt: r.client_created_at,
  payload: JSON.parse(r.payload),
  summary: r.summary,
  status: r.status,
  attempts: r.attempts,
  lastError: r.last_error,
  result: r.result ? JSON.parse(r.result) : undefined,
  conflicts: r.conflicts ? JSON.parse(r.conflicts) : undefined,
  syncedAt: r.synced_at,
});

export const offlineQueueRepository = {
  async insert(op: OfflineOperation) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO offline_operations (operation_id, tenant_id, user_id, type, client_created_at, payload, summary, status, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [op.operationId, op.tenantId, op.userId, op.type, op.clientCreatedAt, JSON.stringify(op.payload), op.summary, op.status, op.attempts],
    );
  },

  async list(tenantId: number, userId: number): Promise<OfflineOperation[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM offline_operations WHERE tenant_id = ? AND user_id = ? ORDER BY client_created_at ASC`,
      [tenantId, userId],
    );
    return rows.map(toRow);
  },

  async pending(tenantId: number, userId: number): Promise<OfflineOperation[]> {
    return (await this.list(tenantId, userId)).filter((o) => o.status === 'PENDIENTE' || o.status === 'ERROR');
  },

  async update(op: OfflineOperation) {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE offline_operations SET status = ?, attempts = ?, last_error = ?, result = ?, conflicts = ?, synced_at = ?
        WHERE operation_id = ?`,
      [op.status, op.attempts, op.lastError ?? null, op.result ? JSON.stringify(op.result) : null,
        op.conflicts ? JSON.stringify(op.conflicts) : null, op.syncedAt ?? null, op.operationId],
    );
  },

  async remove(operationId: string) {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM offline_operations WHERE operation_id = ?`, [operationId]);
  },
};
