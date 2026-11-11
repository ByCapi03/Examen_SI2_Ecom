/**
 * Estado (activa / suspendida) de las empresas, con caché corto para no consultar la BD en cada petición.
 * Lo usan el TenantGuard (rutas autenticadas) y el middleware de contexto (rutas públicas con sesión).
 */
import { DataSource } from 'typeorm';

const cache = new Map<number, { ok: boolean; at: number }>();
const TTL_MS = 30_000;

export async function isTenantActive(ds: DataSource, tenantId: number): Promise<boolean> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;
  const rows = await ds.query('SELECT active FROM tenants WHERE id=$1', [tenantId]);
  const ok = rows[0]?.active === true;
  cache.set(tenantId, { ok, at: Date.now() });
  return ok;
}

/** Llamar al suspender/reactivar para que el cambio surta efecto de inmediato. */
export function invalidateTenantStatus(tenantId?: number) {
  if (tenantId) cache.delete(tenantId); else cache.clear();
}

export const SUSPENDED_MESSAGE = 'Tu empresa está suspendida. Contacta al soporte de la plataforma.';
