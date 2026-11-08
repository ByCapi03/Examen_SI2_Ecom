/**
 * TENANT SUBSCRIBER (TypeORM)
 * Segunda línea de defensa del aislamiento SaaS a nivel ORM:
 *  1. Si una entidad con columna `tenantId` se inserta sin tenant, lo asigna
 *     automáticamente desde el contexto autenticado (JWT) o, como respaldo,
 *     desde la entidad padre (sucursal o venta).
 *  2. Si el código intenta insertar un registro con un tenant distinto al del
 *     usuario autenticado, la operación se rechaza (anti-suplantación).
 * La tercera línea de defensa son las FKs compuestas (tenantId, xxxId) en PostgreSQL.
 */
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { DEFAULT_TENANT_ID, getTenantStore } from './tenant-context';

/** Entidades que pueden crearse desde rutas públicas (registro/activación). */
const PUBLIC_CREATABLE = new Set(['User', 'Client']);

// @EventSubscriber es obligatorio: TypeORM solo instancia subscribers decorados
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface<any> {
  async beforeInsert(event: InsertEvent<any>) {
    const entity = event.entity;
    if (!entity) return;
    const hasTenantColumn = event.metadata.columns.some((c) => c.propertyName === 'tenantId');
    if (!hasTenantColumn) return;

    const store = getTenantStore();
    const authTenant = store?.tenantId;

    if (entity.tenantId != null) {
      if (authTenant && Number(entity.tenantId) !== Number(authTenant)) {
        throw new ForbiddenException(
          `Aislamiento SaaS: intento de escribir ${event.metadata.name} en otro tenant`,
        );
      }
      return;
    }

    if (authTenant) {
      entity.tenantId = authTenant;
      return;
    }

    // Respaldo: heredar el tenant de la entidad padre (webhooks, cron, sync).
    if (entity.branchId) {
      const rows = await event.manager.query('SELECT "tenantId" FROM branches WHERE id = $1', [entity.branchId]);
      if (rows[0]?.tenantId) { entity.tenantId = Number(rows[0].tenantId); return; }
    }
    if (entity.saleId) {
      const rows = await event.manager.query('SELECT "tenantId" FROM sales WHERE id = $1', [entity.saleId]);
      if (rows[0]?.tenantId) { entity.tenantId = Number(rows[0].tenantId); return; }
    }

    if (PUBLIC_CREATABLE.has(event.metadata.name)) {
      entity.tenantId = store?.publicTenantId ?? DEFAULT_TENANT_ID;
      return;
    }

    throw new InternalServerErrorException(
      `No se pudo determinar el tenant para ${event.metadata.name}`,
    );
  }
}
