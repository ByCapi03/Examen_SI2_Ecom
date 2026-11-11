import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const DB_VERSION = 2;

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
};

