/**
 * SERVICIO DE SINCRONIZACIÓN (móvil)
 * Encola operaciones hechas sin conexión en SQLite y las envía a
 * POST /sync/batch cuando vuelve la conectividad (al reactivar la app,
 * periódicamente o manualmente).
 */
import { secureStorage } from '../storage/secureStorage';
import { api } from '../api/api';
import { offlineQueueRepository, OfflineOperation } from '../database/offlineQueue.repository';

type Listener = () => void;
const listeners = new Set<Listener>();
let flushing = false;

export const syncEvents = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  emit() { listeners.forEach((fn) => fn()); },
};

export function isFlushing() { return flushing; }

/** UUID v4 (no depende de crypto nativo). */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** true si el error de axios es por falta de red (no un rechazo del servidor). */
export function isNetworkError(err: any): boolean {
  return !!err && !err.response && (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED');
}

async function currentUser(): Promise<{ id: number; tenantId: number } | null> {
  try {
    const raw = await secureStorage.getItem('userData');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function enqueue(type: OfflineOperation['type'], payload: Record<string, any>, summary: string) {
  const user = await currentUser();
  if (!user?.tenantId) throw new Error('Debes iniciar sesión para guardar operaciones sin conexión');
  const op: OfflineOperation = {
    operationId: uuidv4(),
    tenantId: user.tenantId,
    userId: user.id,
    type,
    clientCreatedAt: new Date().toISOString(),
    payload,
    summary,
    status: 'PENDIENTE',
    attempts: 0,
  };
  await offlineQueueRepository.insert(op);
  syncEvents.emit();
  return op;
}

export async function getQueue(): Promise<OfflineOperation[]> {
  const user = await currentUser();
  if (!user?.tenantId) return [];
  return offlineQueueRepository.list(user.tenantId, user.id);
}

export async function removeOperation(operationId: string) {
  await offlineQueueRepository.remove(operationId);
  syncEvents.emit();
}

export async function flush(): Promise<number> {
  if (flushing) return 0;
  const user = await currentUser();
  if (!user?.tenantId) return 0;
  const pending = await offlineQueueRepository.pending(user.tenantId, user.id);
  if (!pending.length) return 0;

  flushing = true;
  syncEvents.emit();
  try {
    const res = await api.post('/sync/batch', {
      deviceId: 'mobile-app',
      operations: pending.map((o) => ({ operationId: o.operationId, type: o.type, clientCreatedAt: o.clientCreatedAt, ...o.payload })),
    }, { timeout: 15000 });
    const results: any[] = res.data?.results ?? [];
    for (const op of pending) {
      const r = results.find((x) => x.operationId === op.operationId);
      op.attempts += 1;
      if (!r) { op.status = 'ERROR'; op.lastError = 'Sin respuesta del servidor'; }
      else {
        op.result = r.result;
        op.conflicts = r.conflicts;
        op.syncedAt = new Date().toISOString();
        op.lastError = r.status === 'REJECTED' ? r.message : null;
        op.status = r.status === 'REJECTED' ? 'RECHAZADA' : r.status === 'APPLIED_WITH_CONFLICT' ? 'CON_CONFLICTO' : 'SINCRONIZADA';
      }
      await offlineQueueRepository.update(op);
    }
    return pending.length;
  } catch (err: any) {
    // Sin red: se reintentará luego. Error del servidor: se registra el motivo.
    for (const op of pending) {
      op.attempts += 1;
      op.status = 'ERROR';
      op.lastError = isNetworkError(err) ? 'Sin conexión, se reintentará' : (err?.response?.data?.message ?? 'Error de sincronización');
      await offlineQueueRepository.update(op);
    }
    return 0;
  } finally {
    flushing = false;
    syncEvents.emit();
  }
}
