import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  /** Caché corto del estado de las empresas para no consultar la BD en cada petición. */
  private static active = new Map<number, { ok: boolean; at: number }>();

  constructor(private reflector: Reflector, private dataSource: DataSource) {}

  /** Llamar al suspender/reactivar para que el cambio surta efecto de inmediato. */
  static invalidate(tenantId?: number) {
    if (tenantId) TenantGuard.active.delete(tenantId); else TenantGuard.active.clear();
  }

  private async isActive(tenantId: number) {
    const hit = TenantGuard.active.get(tenantId);
    if (hit && Date.now() - hit.at < 30_000) return hit.ok;
    const rows = await this.dataSource.query('SELECT active FROM tenants WHERE id=$1', [tenantId]);
    const ok = rows[0]?.active === true;
    TenantGuard.active.set(tenantId, { ok, at: Date.now() });
    return ok;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Aislamiento SaaS: El token no contiene un TenantId válido');
    }

    // Empresa suspendida por el SuperAdmin: se bloquea toda operación autenticada
    if (!(await this.isActive(Number(user.tenantId)))) {
      throw new ForbiddenException('Tu empresa está suspendida. Contacta al soporte de la plataforma.');
    }

    return true;
  }
}

