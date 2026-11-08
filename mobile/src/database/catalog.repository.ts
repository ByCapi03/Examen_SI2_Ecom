import { getDatabase } from './sqlite';
import { ProductSummary, ProductDetail, VariantInfo } from '../types';

export const catalogRepository = {
  /**
   * Guarda o actualiza una lista de productos en el catálogo local dentro de una sola transacción.
   */
  async saveProducts(products: ProductSummary[]): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const p of products) {
        // Upsert de categorías únicas
        if (p.categoryId && p.categoryName) {
          await txn.runAsync(
            `INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
            [p.categoryId, p.categoryName]
          );
        }

        // Upsert del producto
        const discountStr = p.discount ? JSON.stringify(p.discount) : null;
        await txn.runAsync(
          `INSERT INTO products (
            id, name, price, base_price, final_price, category_id, category_name,
            collection_name, season_name, image_url, discount_json,
            ar_enabled, ar_image_url, ar_torso_url, ar_left_sleeve_url, ar_right_sleeve_url, ar_type, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            price = excluded.price,
            base_price = excluded.base_price,
            final_price = excluded.final_price,
            category_id = excluded.category_id,
            category_name = excluded.category_name,
            collection_name = excluded.collection_name,
            season_name = excluded.season_name,
            image_url = excluded.image_url,
            discount_json = excluded.discount_json,
            ar_enabled = excluded.ar_enabled,
            ar_image_url = excluded.ar_image_url,
            ar_torso_url = excluded.ar_torso_url,
            ar_left_sleeve_url = excluded.ar_left_sleeve_url,
            ar_right_sleeve_url = excluded.ar_right_sleeve_url,
            ar_type = excluded.ar_type,
            updated_at = excluded.updated_at;`,
          [
            p.id,
            p.name,
            Number(p.price) || 0,
            Number(p.basePrice) || 0,
            Number(p.finalPrice) || 0,
            p.categoryId || null,
            p.categoryName || '',
            p.collectionName || null,
            p.seasonName || null,
            p.imageUrl || null,
            discountStr,
            p.arEnabled ? 1 : 0,
            p.arImageUrl || null,
            p.arTorsoUrl || null,
            p.arLeftSleeveUrl || null,
            p.arRightSleeveUrl || null,
            p.arType || null,
            now,
          ]
        );
      }

      // Guardar timestamp de última sincronización
      await txn.runAsync(
        `INSERT INTO sync_metadata (key, value, updated_at) VALUES ('last_catalog_sync', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        [new Date(now).toISOString(), now]
      );
    });
  },

  /**
   * Obtiene todos los productos guardados localmente.
   */
  async getAllProducts(): Promise<ProductSummary[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM products ORDER BY name ASC;`
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.price,
      basePrice: r.base_price,
      finalPrice: r.final_price,
      discount: r.discount_json ? JSON.parse(r.discount_json) : null,
      categoryId: r.category_id,
      categoryName: r.category_name,
      collectionName: r.collection_name,
      seasonName: r.season_name,
      imageUrl: r.image_url,
      arEnabled: Boolean(r.ar_enabled),
      arImageUrl: r.ar_image_url,
      arTorsoUrl: r.ar_torso_url,
      arLeftSleeveUrl: r.ar_left_sleeve_url,
      arRightSleeveUrl: r.ar_right_sleeve_url,
      arType: r.ar_type,
    }));
  },

  /**
   * Guarda el detalle de un producto y sus variantes.
   */
  async saveProductDetail(product: ProductDetail): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Guardar o actualizar producto
      const discountStr = product.discount ? JSON.stringify(product.discount) : null;
      await txn.runAsync(
        `INSERT INTO products (
          id, name, price, base_price, final_price, category_name,
          collection_name, season_name, image_url, discount_json,
          ar_enabled, ar_image_url, ar_torso_url, ar_left_sleeve_url, ar_right_sleeve_url, ar_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          price = excluded.price,
          base_price = excluded.base_price,
          final_price = excluded.final_price,
          category_name = excluded.category_name,
          collection_name = excluded.collection_name,
          season_name = excluded.season_name,
          image_url = excluded.image_url,
          discount_json = excluded.discount_json,
          ar_enabled = excluded.ar_enabled,
          ar_image_url = excluded.ar_image_url,
          ar_torso_url = excluded.ar_torso_url,
          ar_left_sleeve_url = excluded.ar_left_sleeve_url,
          ar_right_sleeve_url = excluded.ar_right_sleeve_url,
          ar_type = excluded.ar_type,
          updated_at = excluded.updated_at;`,
        [
          product.id,
          product.name,
          Number(product.price) || 0,
          Number(product.basePrice) || 0,
          Number(product.finalPrice) || 0,
          product.categoryName || '',
          product.collectionName || null,
          product.seasonName || null,
          product.imageUrl || null,
          discountStr,
          product.arEnabled ? 1 : 0,
          product.arImageUrl || null,
          product.arTorsoUrl || null,
          product.arLeftSleeveUrl || null,
          product.arRightSleeveUrl || null,
          product.arType || null,
          now,
        ]
      );

      // 2. Guardar variantes
      if (product.variants && product.variants.length > 0) {
        for (const v of product.variants) {
          await txn.runAsync(
            `INSERT INTO product_variants (
              id, product_id, sku, size_id, size_name, color_id, color_name, color_hex_code,
              preview_image_url, preview_ar_image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              sku = excluded.sku,
              size_id = excluded.size_id,
              size_name = excluded.size_name,
              color_id = excluded.color_id,
              color_name = excluded.color_name,
              color_hex_code = excluded.color_hex_code,
              preview_image_url = excluded.preview_image_url,
              preview_ar_image_url = excluded.preview_ar_image_url;`,
            [
              v.id,
              product.id,
              v.sku,
              v.sizeId,
              v.sizeName,
              v.colorId,
              v.colorName,
              v.colorHexCode || null,
              v.previewImageUrl || null,
              v.previewArImageUrl || null,
            ]
          );
        }
      }
    });
  },

  /**
   * Obtiene un producto y sus variantes desde SQLite.
   */
  async getProductDetail(productId: number): Promise<ProductDetail | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM products WHERE id = ?;`,
      [productId]
    );

    if (!row) return null;

    const variantRows = await db.getAllAsync<any>(
      `SELECT * FROM product_variants WHERE product_id = ? ORDER BY size_name, color_name ASC;`,
      [productId]
    );

    const variants: VariantInfo[] = variantRows.map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeId: v.size_id,
      sizeName: v.size_name,
      colorId: v.color_id,
      colorName: v.color_name,
      colorHexCode: v.color_hex_code,
      previewImageUrl: v.preview_image_url,
      previewArImageUrl: v.preview_ar_image_url,
    }));

    return {
      id: row.id,
      name: row.name,
      price: row.price,
      basePrice: row.base_price,
      finalPrice: row.final_price,
      discount: row.discount_json ? JSON.parse(row.discount_json) : null,
      categoryName: row.category_name,
      collectionName: row.collection_name,
      seasonName: row.season_name,
      imageUrl: row.image_url,
      arEnabled: Boolean(row.ar_enabled),
      arImageUrl: row.ar_image_url,
      arTorsoUrl: row.ar_torso_url,
      arLeftSleeveUrl: row.ar_left_sleeve_url,
      arRightSleeveUrl: row.ar_right_sleeve_url,
      arType: row.ar_type,
      variants,
    };
  },

  /**
   * Obtiene la fecha legible de la última sincronización.
   */
  async getLastSyncDate(): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = 'last_catalog_sync';`
    );
    return row?.value || null;
  },
};

