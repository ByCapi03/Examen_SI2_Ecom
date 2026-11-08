/**
 * GESTOR DE SINCRONIZACIÓN
 *  - enqueue(): registra una operación offline en la cola local (IndexedDB).
 *  - flush():   envía las operaciones pendientes a POST /sync/batch en orden
 *               cronológico. Se ejecuta al recuperar conexión, al iniciar la
 *               app y periódicamente. Es seguro reintentar: el servidor es
 *               idempotente por operationId.
 */
import { api } from '../api/axios';
import { outboxAll, outboxDelete, outboxPut, type OutboxItem } from './db';

type Listener = () => void;
const listeners = new Set<Listener>();
let flushing = false;
let lastSyncAt: string | null = localStorage.getItem('offline:lastSyncAt');
let lastSyncError: string | null = null;

export const syncEvents = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  emit() { listeners.forEach((fn) => fn()); },
};

export function getSyncMeta() {
  return { flushing, lastSyncAt, lastSyncError };
}

function currentUser(): { id: number; tenantId: number } | null {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export function newOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Respaldo RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Indica si un error de axios se debe a falta de conectividad (no a un rechazo del servidor). */
export function isNetworkError(err: any): boolean {
  return !navigator.onLine || (!!err && !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || err.code === 'ECONNABORTED'));
}

export async function enqueue(type: OutboxItem['type'], payload: Record<string, any>, summary: string): Promise<OutboxItem> {
  const user = currentUser();
  if (!user?.tenantId) throw new Error('Debe iniciar sesión para operar sin conexión');
  const item: OutboxItem = {
    operationId: newOperationId(),
    tenantId: user.tenantId,
    userId: user.id,
    type,
    clientCreatedAt: new Date().toISOString(),
    payload,
    summary,
    status: 'PENDIENTE',
    attempts: 0,
  };
  await outboxPut(item);
  syncEvents.emit();
  return item;
}

export async function getQueue(): Promise<OutboxItem[]> {
  const user = currentUser();
  return outboxAll(user?.tenantId);
}

export async function pendingCount(): Promise<number> {
  return (await getQueue()).filter((i) => i.status === 'PENDIENTE' || i.status === 'ERROR').length;
}

export async function discard(operationId: string) {
  await outboxDelete(operationId);
  syncEvents.emit();
}

export async function flush(): Promise<{ sent: number } | null> {
  if (flushing || !navigator.onLine || !localStorage.getItem('token')) return null;
  const user = currentUser();
  const pending = (await outboxAll(user?.tenantId)).filter(
    (i) => (i.status === 'PENDIENTE' || i.status === 'ERROR') && i.userId === user?.id,
  );
  if (!pending.length) return { sent: 0 };

  flushing = true;
  syncEvents.emit();
  try {
    for (const item of pending) { item.status = 'SINCRONIZANDO'; item.attempts += 1; await outboxPut(item); }
    const res = await api.post('/sync/batch', {
      deviceId: deviceId(),
      operations: pending.map((i) => ({
        operationId: i.operationId, type: i.type, clientCreatedAt: i.clientCreatedAt, ...i.payload,
      })),
    });
    const results: any[] = res.data?.results ?? [];
    for (const item of pending) {
      const r = results.find((x) => x.operationId === item.operationId);
      if (!r) { item.status = 'ERROR'; item.lastError = 'Sin respuesta del servidor'; }
      else {
        item.result = r.result;
        item.conflicts = r.conflicts;
        item.syncedAt = new Date().toISOString();
        item.lastError = r.status === 'REJECTED' ? r.message : undefined;
        item.status = r.status === 'REJECTED' ? 'RECHAZADA'
          : r.status === 'APPLIED_WITH_CONFLICT' ? 'CON_CONFLICTO' : 'SINCRONIZADA';
      }
      await outboxPut(item);
    }
    lastSyncAt = new Date().toISOString();
    lastSyncError = null;
    localStorage.setItem('offline:lastSyncAt', lastSyncAt);
    return { sent: pending.length };
  } catch (err: any) {
    lastSyncError = err?.response?.data?.message || err?.message || 'Error de sincronización';
    for (const item of pending) { item.status = 'ERROR'; item.lastError = lastSyncError ?? undefined; await outboxPut(item); }
    return null;
  } finally {
    flushing = false;
    syncEvents.emit();
  }
}

function deviceId(): string {
  let id = localStorage.getItem('offline:deviceId');
  if (!id) { id = `web-${newOperationId().slice(0, 8)}`; localStorage.setItem('offline:deviceId', id); }
  return id;
}

let started = false;
/** Arranca la sincronización automática (una sola vez por pestaña). */
export function startAutoSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => { syncEvents.emit(); void flush(); });
  window.addEventListener('offline', () => syncEvents.emit());
  setInterval(() => { void flush(); }, 30000);
  void flush();
}
