import { jwtSecret } from '../config/jwt-secret';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { tenantStorage, TenantStore } from './tenant-context';
import { isTenantActive } from './tenant-status';
import { originOf } from '../public-url';

/**
 * Abre un contexto ALS por petición y, si viene la cabecera X-Tenant-Slug,
 * resuelve el tenant público (para vitrina y registro de clientes).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private static slugCache = new Map<string, { id: number | undefined; at: number }>();

  constructor(private readonly dataSource: DataSource) {}

  async use(req: any, _res: any, next: () => void) {
    const store: TenantStore = { origin: originOf(req.headers) };
    const slug = String(req.headers['x-tenant-slug'] || '').trim().toLowerCase();
    if (slug) {
      store.publicSlug = slug;
      store.publicTenantId = await this.resolveSlug(slug);
    }
    // Sesión iniciada: el tenant del token manda sobre la cabecera (rutas públicas sin guard,
    // p. ej. el catálogo de la app móvil, que no envía slug).
    const auth = String(req.headers['authorization'] || '');
    if (auth.startsWith('Bearer ')) {
      try {
        const payload: any = jwt.verify(auth.slice(7), jwtSecret());
        if (payload?.tenantId) {
          store.publicTenantId = Number(payload.tenantId);
          // Empresa suspendida: la vitrina por token (app móvil) también se bloquea
          if (!(await isTenantActive(this.dataSource, Number(payload.tenantId)))) store.suspended = true;
        }
      } catch { /* token inválido: lo rechazará el guard donde aplique */ }
    }
    tenantStorage.run(store, () => next());
  }

  private async resolveSlug(slug: string): Promise<number | undefined> {
    const cached = TenantContextMiddleware.slugCache.get(slug);
    if (cached && Date.now() - cached.at < 60_000) return cached.id;
    try {
      const rows = await this.dataSource.query(
        'SELECT id FROM tenants WHERE slug = $1 AND active = true LIMIT 1',
        [slug],
      );
      const id = rows[0]?.id ? Number(rows[0].id) : undefined;
      TenantContextMiddleware.slugCache.set(slug, { id, at: Date.now() });
      return id;
    } catch {
      return undefined;
    }
  }
}
