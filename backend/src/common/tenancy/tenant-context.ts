/**
 * TENANT CONTEXT (AsyncLocalStorage)
 * Mantiene el tenant de la petición HTTP en curso sin tener que pasarlo
 * manualmente por cada capa. El valor autoritativo SIEMPRE proviene del JWT
 * verificado por AuthGuard; el slug público (cabecera X-Tenant-Slug) solo se
 * usa para rutas anónimas (vitrina pública, registro de clientes).
 */
import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, NotFoundException } from '@nestjs/common';

export interface TenantStore {
  /** Tenant autenticado (JWT). Tiene prioridad absoluta. */
  tenantId?: number;
  /** Tenant público resuelto por slug (solo rutas @Public). */
  publicTenantId?: number;
  /** Slug recibido en X-Tenant-Slug (aunque no exista), para distinguir "no indicó tienda" de "tienda inexistente". */
  publicSlug?: string;
  userId?: number;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export const DEFAULT_TENANT_ID = Number(process.env.DEFAULT_TENANT_ID || 1);

export function getTenantStore(): TenantStore | undefined {
  return tenantStorage.getStore();
}

/** Tenant autenticado de la petición actual (o undefined). */
export function getCurrentTenantId(): number | undefined {
  return tenantStorage.getStore()?.tenantId;
}

/** Tenant efectivo para rutas públicas: JWT > slug > tenant por defecto. */
export function getEffectiveTenantId(): number {
  const store = tenantStorage.getStore();
  return store?.tenantId ?? store?.publicTenantId ?? DEFAULT_TENANT_ID;
}

/**
 * Tenant OBLIGATORIO para la vitrina pública: JWT o slug de la tienda. A diferencia de
 * getEffectiveTenantId, nunca cae en una empresa por defecto (evita mostrar el catálogo de otra).
 */
export function requireTenantId(): number {
  const store = tenantStorage.getStore();
  const id = store?.tenantId ?? store?.publicTenantId;
  if (id) return id;
  if (store?.publicSlug) throw new NotFoundException('Tienda no encontrada');
  throw new BadRequestException('Indica la tienda (cabecera X-Tenant-Slug) o inicia sesión');
}

export function setAuthenticatedTenant(tenantId: number | undefined, userId?: number) {
  const store = tenantStorage.getStore();
  if (store) {
    store.tenantId = tenantId ? Number(tenantId) : undefined;
    store.userId = userId;
  }
}
