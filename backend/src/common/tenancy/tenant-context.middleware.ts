import { Injectable, NestMiddleware } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { tenantStorage, TenantStore } from './tenant-context';

/**
 * Abre un contexto ALS por petición y, si viene la cabecera X-Tenant-Slug,
 * resuelve el tenant público (para vitrina y registro de clientes).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private static slugCache = new Map<string, { id: number | undefined; at: number }>();

  constructor(private readonly dataSource: DataSource) {}

  async use(req: any, _res: any, next: () => void) {
    const store: TenantStore = {};
    const slug = String(req.headers['x-tenant-slug'] || '').trim().toLowerCase();
    if (slug) {
      store.publicTenantId = await this.resolveSlug(slug);
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
