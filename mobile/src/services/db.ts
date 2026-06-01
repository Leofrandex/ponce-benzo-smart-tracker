import type { SQLiteDatabase } from 'expo-sqlite';

// ── Schema ────────────────────────────────────────────────────────────────────

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      session_id   TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      route_id     TEXT NOT NULL,
      session_start TEXT NOT NULL,
      session_end  TEXT,
      start_lat    REAL,
      start_lng    REAL,
      synced       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS location_pings (
      ping_id      TEXT PRIMARY KEY,
      session_id   TEXT,
      timestamp    TEXT NOT NULL,
      lat          REAL NOT NULL,
      lng          REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      visit_id     TEXT PRIMARY KEY,
      session_id   TEXT,
      store_id     TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      lat          REAL,
      lng          REAL,
      photo_uri    TEXT,
      observations TEXT,
      status       TEXT NOT NULL,
      synced       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS competition_reports (
      report_id       TEXT PRIMARY KEY,
      session_id      TEXT,
      store_id        TEXT,
      user_id         TEXT NOT NULL,
      brand_id        TEXT,
      activation_type TEXT,
      photo_uri       TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      synced          INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migraciones idempotentes de columnas (SQLite no soporta ADD COLUMN IF NOT EXISTS)
  const visitCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(visits)`);
  const have = new Set(visitCols.map((c) => c.name));
  const toAdd: Array<[string, string]> = [
    ['anomaly_type', 'TEXT'],
    ['skip_reason', 'TEXT'],
    ['last_restock_date', 'TEXT'],
  ];
  for (const [col, type] of toAdd) {
    if (!have.has(col)) {
      await db.execAsync(`ALTER TABLE visits ADD COLUMN ${col} ${type}`);
    }
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionRow {
  session_id: string;
  user_id: string;
  route_id: string;
  session_start: string;
  session_end: string | null;
  start_lat: number | null;
  start_lng: number | null;
  synced: number;
}

export async function insertSession(
  db: SQLiteDatabase,
  data: Omit<SessionRow, 'session_end' | 'synced'>,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sessions (session_id, user_id, route_id, session_start, start_lat, start_lng)
     VALUES (?, ?, ?, ?, ?, ?)`,
    data.session_id,
    data.user_id,
    data.route_id,
    data.session_start,
    data.start_lat ?? null,
    data.start_lng ?? null,
  );
}

export async function updateSessionEnd(
  db: SQLiteDatabase,
  sessionId: string,
  endTime: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE sessions SET session_end = ? WHERE session_id = ?`,
    endTime,
    sessionId,
  );
}

// ── Visits ────────────────────────────────────────────────────────────────────

export interface VisitRow {
  visit_id: string;
  session_id: string | null;
  store_id: string;
  user_id: string;
  check_in_time: string;
  lat: number | null;
  lng: number | null;
  photo_uri: string | null;
  observations: string | null;
  status: string;
  anomaly_type: string | null;
  skip_reason: string | null;
  last_restock_date: string | null;
  synced: number;
}

export async function insertVisit(db: SQLiteDatabase, data: VisitRow): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO visits
      (visit_id, session_id, store_id, user_id, check_in_time, lat, lng, photo_uri, observations, status, anomaly_type, skip_reason, last_restock_date, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.visit_id,
    data.session_id ?? null,
    data.store_id,
    data.user_id,
    data.check_in_time,
    data.lat ?? null,
    data.lng ?? null,
    data.photo_uri ?? null,
    data.observations ?? null,
    data.status,
    data.anomaly_type ?? null,
    data.skip_reason ?? null,
    data.last_restock_date ?? null,
    data.synced,
  );
}

export async function getTodayVisits(db: SQLiteDatabase, userId: string): Promise<VisitRow[]> {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  return db.getAllAsync<VisitRow>(
    `SELECT * FROM visits
     WHERE user_id = ? AND check_in_time LIKE ?
     ORDER BY check_in_time DESC`,
    userId,
    `${today}%`,
  );
}

export async function getUnsyncedCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM visits WHERE synced = 0`,
  );
  return row?.count ?? 0;
}

// ── Location pings (background tracking) ─────────────────────────────────────

// Called from background task — must be synchronous (no async/await available)
export function insertLocationPingSync(
  sessionId: string | null,
  timestamp: string,
  lat: number,
  lng: number,
): void {
  // openDatabaseSync gives a direct handle without the React context
  const { openDatabaseSync } = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = openDatabaseSync('poncebenzo.db');
  db.runSync(
    `INSERT INTO location_pings (ping_id, session_id, timestamp, lat, lng)
     VALUES (?, ?, ?, ?, ?)`,
    `ping-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId ?? null,
    timestamp,
    lat,
    lng,
  );
}
