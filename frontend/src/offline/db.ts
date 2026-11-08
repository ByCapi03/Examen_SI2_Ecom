/**
 * ALMACENAMIENTO LOCAL (IndexedDB) — sin dependencias externas
 *  - "cache":  respuestas GET de la API para trabajar sin conexión
 *              (catálogo POS, vitrina, sucursales, sesión de caja...).
 *  - "outbox": cola de operaciones pendientes generadas offline, cada una con
 *              un UUID que garantiza idempotencia al sincronizar.
 * Todas las claves se prefijan con el tenant para que dos empresas que usen el
 * mismo navegador nunca mezclen datos locales.
 */
const DB_NAME = 'fashionstore-offline';
const DB_VERSION = 1;

export type OutboxStatus = 'PENDIENTE' | 'SINCRONIZANDO' | 'SINCRONIZADA' | 'CON_CONFLICTO' | 'RECHAZADA' | 'ERROR';

export interface OutboxItem {
  operationId: string;
  tenantId: number;
  userId: number;
  type: 'POS_CASH_SALE' | 'RESERVATION';
  clientCreatedAt: string;
  payload: Record<string, any>;
  /** Texto legible para la UI (p. ej. "Venta efectivo Bs 250 — 3 ítems"). */
  summary: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  result?: any;
  conflicts?: { type: string; message: string; detail?: any }[];
  syncedAt?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'operationId' });
        store.createIndex('tenantId', 'tenantId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export function currentTenantKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.tenantId ? `t${user.tenantId}` : 'public';
  } catch {
    return 'public';
  }
}

// ------------------------------------------------------------------ cache
export async function cacheSet(key: string, data: unknown) {
  try {
    await tx('cache', 'readwrite', (s) => s.put({ data, savedAt: new Date().toISOString() }, `${currentTenantKey()}:${key}`));
  } catch { /* almacenamiento no disponible: se ignora */ }
}

export async function cacheGet<T = any>(key: string): Promise<{ data: T; savedAt: string } | undefined> {
  try {
    return await tx('cache', 'readonly', (s) => s.get(`${currentTenantKey()}:${key}`));
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ outbox
export async function outboxPut(item: OutboxItem) {
  await tx('outbox', 'readwrite', (s) => s.put(item));
}

export async function outboxAll(tenantId?: number): Promise<OutboxItem[]> {
  try {
    const all: OutboxItem[] = await tx('outbox', 'readonly', (s) => s.getAll());
    return all
      .filter((i) => tenantId == null || i.tenantId === tenantId)
      .sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
  } catch {
    return [];
  }
}

export async function outboxDelete(operationId: string) {
  await tx('outbox', 'readwrite', (s) => s.delete(operationId));
}
