import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { isTenantActive, SUSPENDED_MESSAGE } from '../tenancy/tenant-status';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector, private dataSource: DataSource) {}

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
    if (!(await isTenantActive(this.dataSource, Number(user.tenantId)))) {
      throw new ForbiddenException(SUSPENDED_MESSAGE);
    }

    return true;
  }
}

