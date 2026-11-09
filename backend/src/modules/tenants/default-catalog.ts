/**
 * CATÁLOGO INICIAL POR EMPRESA
 * Al dar de alta una empresa se le crean tallas y colores básicos propios para
 * que pueda registrar productos de inmediato. Cada empresa puede luego editar,
 * desactivar o ampliar su catálogo sin afectar a las demás.
 * Se usa SQL directo (ON CONFLICT DO NOTHING) para que sea idempotente y para
 * que el SUPERADMIN pueda sembrar el catálogo de OTRA empresa.
 */
import { DataSource, EntityManager } from 'typeorm';

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA'];
export const DEFAULT_COLORS = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Gris', 'Beige', 'Café'];

export async function seedDefaultCatalog(db: DataSource | EntityManager, tenantId: number) {
  for (const name of DEFAULT_SIZES) {
    await db.query(
      `INSERT INTO sizes ("tenantId", name, active) VALUES ($1, $2, true) ON CONFLICT ("tenantId", name) DO NOTHING`,
      [tenantId, name],
    );
  }
  for (const name of DEFAULT_COLORS) {
    await db.query(
      `INSERT INTO colors ("tenantId", name, active) VALUES ($1, $2, true) ON CONFLICT ("tenantId", name) DO NOTHING`,
      [tenantId, name],
    );
  }
}

/** Siembra el catálogo básico en toda empresa que aún no tenga tallas. */
export async function seedMissingCatalogs(db: DataSource): Promise<number[]> {
  const rows = await db.query(
    `SELECT t.id FROM tenants t WHERE NOT EXISTS (SELECT 1 FROM sizes s WHERE s."tenantId" = t.id) ORDER BY t.id`,
  );
  const ids = rows.map((r: any) => Number(r.id));
  for (const id of ids) await seedDefaultCatalog(db, id);
  return ids;
}
