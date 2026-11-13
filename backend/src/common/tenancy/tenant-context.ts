/**
 * TENANT CONTEXT (AsyncLocalStorage)
 * Mantiene el tenant de la petición HTTP en curso sin tener que pasarlo
 * manualmente por cada capa. El valor autoritativo SIEMPRE proviene del JWT
 * verificado por AuthGuard; el slug público (cabecera X-Tenant-Slug) solo se
 * usa para rutas anónimas (vitrina pública, registro de clientes).
 */
import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { resolvePublicWebUrl } from '../public-url';

export interface TenantStore {
  /** Tenant autenticado (JWT). Tiene prioridad absoluta. */
  tenantId?: number;
  /** Tenant público resuelto por slug (solo rutas @Public). */
  publicTenantId?: number;
  /** Slug recibido en X-Tenant-Slug (aunque no exista), para distinguir "no indicó tienda" de "tienda inexistente". */
  publicSlug?: string;
  /** La empresa del token está suspendida (rutas públicas con sesión). */
  suspended?: boolean;
  userId?: number;
  /** Origen del navegador que hizo la petición (para armar enlaces y QR accesibles desde el celular). */
  origin?: string;
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
  if (store?.suspended) throw new ForbiddenException('Tu empresa está suspendida. Contacta al soporte de la plataforma.');
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

/** Dirección pública del frontend para QR y enlaces (ver common/public-url.ts). */
export function currentPublicWebUrl(): string {
  return resolvePublicWebUrl({
    explicit: process.env.QR_PUBLIC_WEB_URL,
    frontendUrl: process.env.FRONTEND_URL,
    origin: tenantStorage.getStore()?.origin,
  });
}
