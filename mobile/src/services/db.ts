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
    -- Writer en insertCompetitionReport (las fotos se guardan como JSON en photo_uri).
  `);

  // Migraciones idempotentes de columnas (SQLite no soporta ADD COLUMN IF NOT EXISTS)
  const addColumnsIfMissing = async (table: string, cols: Array<[string, string]>) => {
    const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    const have = new Set(existing.map((c) => c.name));
    for (const [col, type] of cols) {
      if (!have.has(col)) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }
  };
  await db.withTransactionAsync(async () => {
    await addColumnsIfMissing('visits', [
      ['anomaly_type', 'TEXT'],
      ['skip_reason', 'TEXT'],
      ['last_restock_date', 'TEXT'],
    ]);
    await addColumnsIfMissing('competition_reports', [
      ['visit_id', 'TEXT'], // v2.0: reporte ligado al check-in
    ]);
    await addColumnsIfMissing('location_pings', [
      ['user_id', 'TEXT'],
      ['synced', 'INTEGER NOT NULL DEFAULT 0'],
    ]);
  });
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

/** Sesión abierta (session_end IS NULL) más reciente del usuario, o null. */
export async function getOpenSession(
  db: SQLiteDatabase,
  userId: string,
): Promise<SessionRow | null> {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions
     WHERE user_id = ? AND session_end IS NULL
     ORDER BY session_start DESC LIMIT 1`,
    userId,
  );
  return row ?? null;
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

// ── Location pings ────────────────────────────────────────────────────────────

// Writer async para el foreground (watchPositionAsync). El background usa la versión sync.
export async function insertLocationPing(
  db: SQLiteDatabase,
  data: { ping_id: string; session_id: string | null; user_id: string; timestamp: string; lat: number; lng: number },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    data.ping_id,
    data.session_id,
    data.user_id,
    data.timestamp,
    data.lat,
    data.lng,
  );
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
  // El task de background no conoce la sesión: se resuelve desde la jornada abierta
  const open = db.getFirstSync<{ session_id: string; user_id: string }>(
    `SELECT session_id, user_id FROM sessions
     WHERE session_end IS NULL ORDER BY session_start DESC LIMIT 1`,
  );
  db.runSync(
    `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?)`,
    require('./sync/ids').newId(),
    sessionId ?? open?.session_id ?? null,
    open?.user_id ?? null,
    timestamp,
    lat,
    lng,
  );
}

// ── Competition reports ──────────────────────────────────────────────────────

export interface CompetitionReportRow {
  report_id: string;
  session_id: string | null;
  visit_id: string | null;
  store_id: string | null;
  user_id: string;
  brand_id: string | null;
  activation_type: string | null;
  photo_uris: string[];
  notes: string | null;
  created_at: string;
  synced: number;
}

export async function insertCompetitionReport(
  db: SQLiteDatabase,
  data: CompetitionReportRow,
): Promise<void> {
  // La columna photo_uri es TEXT; guardamos el array de fotos como JSON
  // para soportar varias sin migrar el schema.
  await db.runAsync(
    `INSERT OR REPLACE INTO competition_reports
      (report_id, session_id, visit_id, store_id, user_id, brand_id, activation_type, photo_uri, notes, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.report_id,
    data.session_id ?? null,
    data.visit_id ?? null,
    data.store_id ?? null,
    data.user_id,
    data.brand_id ?? null,
    data.activation_type ?? null,
    JSON.stringify(data.photo_uris ?? []),
    data.notes ?? null,
    data.created_at,
    data.synced,
  );
}

export async function getUnsyncedCompetitionCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM competition_reports WHERE synced = 0`,
  );
  return row?.count ?? 0;
}

// ── Sync queue ────────────────────────────────────────────────────────────────
export interface PingRow {
  ping_id: string; session_id: string | null; user_id: string | null;
  timestamp: string; lat: number; lng: number;
}
export interface CompetitionRawRow {
  report_id: string; session_id: string | null; visit_id: string | null; store_id: string | null;
  user_id: string; brand_id: string | null; activation_type: string | null;
  photo_uri: string | null; notes: string | null; created_at: string;
}
export function getUnsyncedSessions(db: SQLiteDatabase): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(`SELECT * FROM sessions WHERE synced = 0`);
}
export function getUnsyncedPings(db: SQLiteDatabase): Promise<PingRow[]> {
  return db.getAllAsync<PingRow>(`SELECT ping_id, session_id, user_id, timestamp, lat, lng FROM location_pings WHERE synced = 0`);
}
export function getUnsyncedVisits(db: SQLiteDatabase): Promise<VisitRow[]> {
  return db.getAllAsync<VisitRow>(`SELECT * FROM visits WHERE synced = 0`);
}
export function getUnsyncedCompetition(db: SQLiteDatabase): Promise<CompetitionRawRow[]> {
  return db.getAllAsync<CompetitionRawRow>(`SELECT report_id, session_id, visit_id, store_id, user_id, brand_id, activation_type, photo_uri, notes, created_at FROM competition_reports WHERE synced = 0`);
}
export async function markSynced(db: SQLiteDatabase, table: 'sessions'|'location_pings'|'visits'|'competition_reports', idCol: string, id: string): Promise<void> {
  await db.runAsync(`UPDATE ${table} SET synced = 1 WHERE ${idCol} = ?`, id);
}
export async function getTotalUnsyncedCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE synced=0) +
       (SELECT COUNT(*) FROM location_pings WHERE synced=0) +
       (SELECT COUNT(*) FROM visits WHERE synced=0) +
       (SELECT COUNT(*) FROM competition_reports WHERE synced=0) AS n`);
  return row?.n ?? 0;
}
