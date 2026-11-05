import type { SQLiteDatabase } from 'expo-sqlite';

// Columnas opcionales por tabla (migraciones idempotentes; SQLite no soporta IF NOT EXISTS en ADD COLUMN).
const OPTIONAL_COLUMNS: Record<string, Array<[string, string]>> = {
  // photos_synced DEFAULT 1: las filas viejas ya sincronizadas subieron sus fotos con el
  // motor anterior (fotos-antes-que-registro); los inserts nuevos ponen 0 explícitamente.
  // photo_next_try nulo y photo_attempts 0: las filas con fotos pendientes de versiones
  // anteriores quedan elegibles de inmediato.
  visits: [['anomaly_type', 'TEXT'], ['skip_reason', 'TEXT'], ['last_restock_date', 'TEXT'], ['photos_synced', 'INTEGER NOT NULL DEFAULT 1'], ['supervisor_present_user_id', 'TEXT'], ['photo_attempts', 'INTEGER NOT NULL DEFAULT 0'], ['photo_next_try', 'TEXT'], ['photos_done', 'INTEGER NOT NULL DEFAULT 0']],
  competition_reports: [['visit_id', 'TEXT'], ['photos_synced', 'INTEGER NOT NULL DEFAULT 1'], ['photo_attempts', 'INTEGER NOT NULL DEFAULT 0'], ['photo_next_try', 'TEXT'], ['photos_done', 'INTEGER NOT NULL DEFAULT 0']],
  location_pings: [['user_id', 'TEXT'], ['synced', 'INTEGER NOT NULL DEFAULT 0']],
  sessions: [['app_version', 'TEXT']],
};

/** Pura: dada la columna existente por tabla, devuelve los ALTER TABLE faltantes. */
export function buildMigrations(existing: Record<string, Set<string>>): string[] {
  const out: string[] = [];
  for (const [table, cols] of Object.entries(OPTIONAL_COLUMNS)) {
    const have = existing[table] ?? new Set<string>();
    for (const [col, type] of cols) {
      if (!have.has(col)) out.push(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  }
  return out;
}

const CREATE_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, route_id TEXT NOT NULL,
    session_start TEXT NOT NULL, session_end TEXT, start_lat REAL, start_lng REAL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS location_pings (
    ping_id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    visit_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT NOT NULL, user_id TEXT NOT NULL,
    check_in_time TEXT NOT NULL, lat REAL, lng REAL, photo_uri TEXT, observations TEXT,
    status TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS competition_reports (
    report_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT, user_id TEXT NOT NULL,
    brand_id TEXT, activation_type TEXT, photo_uri TEXT, notes TEXT, created_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY, sku TEXT NOT NULL, name TEXT NOT NULL, brand TEXT
  );
  CREATE TABLE IF NOT EXISTS visit_anomaly_products (
    visit_id TEXT NOT NULL, anomaly_type TEXT NOT NULL, product_id TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (visit_id, anomaly_type, product_id)
  );
  CREATE TABLE IF NOT EXISTS restock_products (
    visit_id TEXT NOT NULL, product_id TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (visit_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS sync_log (
    log_id TEXT PRIMARY KEY, ts TEXT NOT NULL, level TEXT NOT NULL,
    event TEXT NOT NULL, detail TEXT, user_id TEXT, synced INTEGER NOT NULL DEFAULT 0
  );
`;

// Van DESPUES de las columnas opcionales: referencian synced/photos_synced/user_id, que en BD viejas se agregan por migracion.
const INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_visits_user_sync ON visits(user_id, synced, photos_synced);
  CREATE INDEX IF NOT EXISTS idx_visits_checkin ON visits(check_in_time);
  CREATE INDEX IF NOT EXISTS idx_reports_user_sync ON competition_reports(user_id, synced, photos_synced);
  CREATE INDEX IF NOT EXISTS idx_pings_synced ON location_pings(synced);
  CREATE INDEX IF NOT EXISTS idx_pings_ts ON location_pings(timestamp);
  CREATE INDEX IF NOT EXISTS idx_synclog_sync_user ON sync_log(synced, user_id);
`;

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_SQL);
  const tables = Object.keys(OPTIONAL_COLUMNS);
  const existing: Record<string, Set<string>> = {};
  for (const t of tables) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    existing[t] = new Set(rows.map((r) => r.name));
  }
  for (const stmt of buildMigrations(existing)) {
    await db.execAsync(stmt);
  }
  await db.execAsync(INDEX_SQL);
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { openDatabaseAsync } = await import('expo-sqlite');
      const db = await openDatabaseAsync('poncebenzo.db');
      await initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, key);
  return row?.value ?? null;
}
export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, key, value);
}
