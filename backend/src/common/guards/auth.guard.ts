/**
 * AUTH GUARD
 * Seguridad: Actúa como una barrera o "portero" para las rutas protegidas.
 * Extrae el Bearer Token (JWT) de los Headers, lo verifica usando la clave secreta
 * y adjunta la información del usuario (id, roles, sucursal) al objeto `request.user`.
 * Si el token no existe, es inválido o expiró, rechaza la petición con 401 Unauthorized.
 */
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Token no provisto');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'defaultSecret';
      const payload = await this.jwtService.verifyAsync(token, {
        secret: secret
      });
      // Attach the payload to the request object
      // Payload has: sub, email, roles, branchId, tenantId
      (request as any).user = payload;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
