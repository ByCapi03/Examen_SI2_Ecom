import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './sqlite';
import { Cart, CartItem } from '../context/CartContext';

const LEGACY_CART_KEY = '@boutique_cart';

export const cartRepository = {
  /**
   * Migra los datos de AsyncStorage a SQLite si existen.
   */
  async migrateFromAsyncStorage(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(LEGACY_CART_KEY);
      if (saved) {
        const parsed: Cart = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          console.log('[SQLite Cart] Migrando carrito desde AsyncStorage...');
          await this.saveCart(parsed);
        }
        await AsyncStorage.removeItem(LEGACY_CART_KEY);
        console.log('[SQLite Cart] Carrito migrado y eliminado de AsyncStorage.');
      }
    } catch (e) {
      console.error('[SQLite Cart] Error durante la migración de AsyncStorage:', e);
    }
  },

  /**
   * Carga el carrito completo desde SQLite.
   */
  async loadCart(): Promise<Cart> {
    const db = await getDatabase();

    // 1. Obtener cabecera
    const header = await db.getFirstAsync<{ branch_id: number | null; branch_name: string | null }>(
      `SELECT branch_id, branch_name FROM cart_header WHERE id = 1;`
    );

    // 2. Obtener items
    const itemsRows = await db.getAllAsync<any>(
      `SELECT * FROM cart_items ORDER BY rowid ASC;`
    );

    const items: CartItem[] = itemsRows.map((r) => ({
      productId: r.product_id,
      variantId: r.variant_id,
      productName: r.product_name,
      imageUrl: r.image_url,
      size: r.size,
      color: r.color,
      price: r.price,
      basePrice: r.base_price,
      quantity: r.quantity,
      available: r.available,
    }));

    return {
      branchId: header?.branch_id ?? null,
      branchName: header?.branch_name ?? null,
      items,
    };
  },

  /**
   * Guarda o actualiza el carrito completo en SQLite dentro de una sola transacción.
   */
  async saveCart(cart: Cart): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withTransactionAsync(async () => { const txn = db;
      // 1. Guardar o actualizar cabecera
      await txn.runAsync(
        `INSERT INTO cart_header (id, branch_id, branch_name, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           branch_id = excluded.branch_id,
           branch_name = excluded.branch_name,
           updated_at = excluded.updated_at;`,
        [cart.branchId, cart.branchName, now]
      );

      // 2. Reemplazar ítems
      await txn.runAsync(`DELETE FROM cart_items;`);

      for (const item of cart.items) {
        await txn.runAsync(
          `INSERT INTO cart_items (
            variant_id, product_id, product_name, image_url, size, color, price, base_price, quantity, available
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.variantId,
            item.productId,
            item.productName,
            item.imageUrl || null,
            item.size,
            item.color,
            Number(item.price) || 0,
            item.basePrice ? Number(item.basePrice) : null,
            item.quantity,
            item.available,
          ]
        );
      }
    });
  },

  /**
   * Vacía el carrito en SQLite.
   */
  async clearCart(): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withTransactionAsync(async () => { const txn = db;
      await txn.runAsync(
        `INSERT INTO cart_header (id, branch_id, branch_name, updated_at)
         VALUES (1, NULL, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET
           branch_id = NULL,
           branch_name = NULL,
           updated_at = excluded.updated_at;`,
        [now]
      );
      await txn.runAsync(`DELETE FROM cart_items;`);
    });
  },
};

