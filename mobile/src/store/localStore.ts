import type { SQLiteDatabase } from 'expo-sqlite';

// Columnas opcionales por tabla (migraciones idempotentes; SQLite no soporta IF NOT EXISTS en ADD COLUMN).
const OPTIONAL_COLUMNS: Record<string, Array<[string, string]>> = {
  visits: [['anomaly_type', 'TEXT'], ['skip_reason', 'TEXT'], ['last_restock_date', 'TEXT']],
  competition_reports: [['visit_id', 'TEXT']],
  location_pings: [['user_id', 'TEXT'], ['synced', 'INTEGER NOT NULL DEFAULT 0']],
};

/** Pura: dada la columna existente por tabla, devuelve los ALTER TABLE faltantes. */
export function buildMigrations(existing: Record<string, Set<string>>): string[] {
  const out: string[] = [];
  for (const [table, cols] of Object.entries(OPTIONAL_COLUMNS)) {
    if (!(table in existing)) continue; // Only process tables that exist in the database
    const have = existing[table];
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
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS sync_log (
    log_id TEXT PRIMARY KEY, ts TEXT NOT NULL, level TEXT NOT NULL,
    event TEXT NOT NULL, detail TEXT, user_id TEXT, synced INTEGER NOT NULL DEFAULT 0
  );
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
