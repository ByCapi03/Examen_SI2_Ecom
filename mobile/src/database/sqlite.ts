import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const DB_VERSION = 3;

/**
 * Obtiene o inicializa la conexión con la base de datos local SQLite.
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync('fashionstore.db');

  // Habilitar Foreign Keys y modo WAL para mejor concurrencia
  await db.execAsync('PRAGMA foreign_keys = ON;');
  try { await db.execAsync('PRAGMA journal_mode = WAL;'); } catch { /* el navegador no admite WAL */ }

  await runMigrations(db);

  dbInstance = db;
  return dbInstance;
};

/**
 * Ejecución de migraciones versionadas usando PRAGMA user_version.
 */
const runMigrations = async (db: SQLite.SQLiteDatabase) => {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version || 0;

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => { const txn = db;
      // 1. Tabla de metadatos de sincronización
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // 2. Tabla de Categorías
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );
      `);

      // 3. Tabla de Productos del Catálogo
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          base_price REAL NOT NULL,
          final_price REAL NOT NULL,
          category_id INTEGER,
          category_name TEXT NOT NULL,
          collection_name TEXT,
          season_name TEXT,
          image_url TEXT,
          discount_json TEXT,
          ar_enabled INTEGER DEFAULT 0,
          ar_image_url TEXT,
          ar_torso_url TEXT,
          ar_left_sleeve_url TEXT,
          ar_right_sleeve_url TEXT,
          ar_type TEXT,
          updated_at INTEGER NOT NULL
        );
      `);

      // 4. Tabla de Variantes de Productos
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id INTEGER PRIMARY KEY,
          product_id INTEGER NOT NULL,
          sku TEXT NOT NULL,
          size_id INTEGER NOT NULL,
          size_name TEXT NOT NULL,
          color_id INTEGER NOT NULL,
          color_name TEXT NOT NULL,
          color_hex_code TEXT,
          preview_image_url TEXT,
          preview_ar_image_url TEXT,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        );
      `);

      // 5. Tabla Cabecera del Carrito (Singleton id = 1)
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS cart_header (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          branch_id INTEGER,
          branch_name TEXT,
          updated_at INTEGER NOT NULL
        );
      `);

      // 6. Tabla de Ítems del Carrito
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS cart_items (
          variant_id INTEGER PRIMARY KEY,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          image_url TEXT,
          size TEXT NOT NULL,
          color TEXT NOT NULL,
          price REAL NOT NULL,
          base_price REAL,
          quantity INTEGER NOT NULL,
          available INTEGER NOT NULL
        );
      `);

      // 7. Índices de Búsqueda y Filtros
      await txn.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_name);
        CREATE INDEX IF NOT EXISTS idx_products_season ON products (season_name);
        CREATE INDEX IF NOT EXISTS idx_products_collection ON products (collection_name);
        CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants (product_id);
      `);

      // Actualizar la versión de la base de datos
      await txn.execAsync(`PRAGMA user_version = ${DB_VERSION};`);
    });
    console.log('[SQLite] Migración a versión 1 completada exitosamente.');
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => { const txn = db;
      // 8. Cola de operaciones offline pendientes de sincronizar (idempotentes por UUID)
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_operations (
          operation_id TEXT PRIMARY KEY,
          tenant_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          client_created_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          summary TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDIENTE',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          result TEXT,
          conflicts TEXT,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_ops_status ON offline_operations (tenant_id, status);
      `);
      await txn.execAsync(`PRAGMA user_version = 2;`);
    });
    console.log('[SQLite] Migración a versión 2 (cola offline) completada.');
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => { const txn = db;
      // 9. Caja POS offline: sucursal autorizada, existencias conocidas, clientes mínimos
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS pos_branches (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pos_inventory (
          variant_id INTEGER NOT NULL,
          branch_id INTEGER NOT NULL,
          product_id INTEGER,
          product_name TEXT NOT NULL,
          sku TEXT,
          size TEXT,
          color TEXT,
          base_price REAL,
          final_price REAL NOT NULL,
          available INTEGER NOT NULL CHECK (available >= 0),
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (variant_id, branch_id),
          FOREIGN KEY (branch_id) REFERENCES pos_branches (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS pos_clients (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pos_inventory_branch ON pos_inventory (branch_id, product_name);
      `);
      // 10. Ventas locales y su detalle. El estado de sincronización NO se duplica:
      //     se obtiene de offline_operations (misma operation_id).
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS local_sales (
          operation_id TEXT PRIMARY KEY,
          tenant_id INTEGER NOT NULL,
          branch_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          client_id INTEGER,
          client_name TEXT,
          payment_method TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK (payment_method = 'EFECTIVO'),
          total REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (operation_id) REFERENCES offline_operations (operation_id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES pos_branches (id)
        );
        CREATE TABLE IF NOT EXISTS local_sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_id TEXT NOT NULL,
          variant_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          size TEXT,
          color TEXT,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY (operation_id) REFERENCES local_sales (operation_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_local_sales_user ON local_sales (tenant_id, user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_local_sale_items_op ON local_sale_items (operation_id);
      `);
      await txn.execAsync(`PRAGMA user_version = 3;`);
    });
    console.log('[SQLite] Migración a versión 3 (caja POS offline) completada.');
  }
};

