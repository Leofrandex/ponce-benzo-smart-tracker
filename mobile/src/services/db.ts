import type { SQLiteDatabase } from 'expo-sqlite';

// ── Type exports (used by payloads.ts, syncEngine.ts, contexts) ───────────────

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
  /** 0 = fotos aún no subidas (el registro puede estar arriba sin ellas). */
  photos_synced?: number;
}

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

// Types used by payloads.ts / syncEngine.ts (sync queue)
export interface PingRow {
  ping_id: string; session_id: string | null; user_id: string | null;
  timestamp: string; lat: number; lng: number;
}
export interface CompetitionRawRow {
  report_id: string; session_id: string | null; visit_id: string | null; store_id: string | null;
  user_id: string; brand_id: string | null; activation_type: string | null;
  photo_uri: string | null; notes: string | null; created_at: string;
}

// ── Visits ────────────────────────────────────────────────────────────────────

export async function insertVisit(db: SQLiteDatabase, data: VisitRow): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO visits
      (visit_id, session_id, store_id, user_id, check_in_time, lat, lng, photo_uri, observations, status, anomaly_type, skip_reason, last_restock_date, synced, photos_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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

/**
 * Puro: rango [inicio, fin) del día LOCAL del dispositivo, expresado en UTC.
 * Antes se filtraba por el día UTC del ISO: en Venezuela (UTC-4) el "día" cambiaba
 * a las 8:00 PM hora local y las visitas de la mañana desaparecían de la ruta.
 */
export function localDayRangeUtc(now: Date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // medianoche local
  return { startIso: start.toISOString(), endIso: new Date(start.getTime() + 86_400_000).toISOString() };
}

export async function getTodayVisits(db: SQLiteDatabase, userId: string): Promise<VisitRow[]> {
  const { startIso, endIso } = localDayRangeUtc();
  return db.getAllAsync<VisitRow>(
    `SELECT * FROM visits
     WHERE user_id = ? AND check_in_time >= ? AND check_in_time < ?
     ORDER BY check_in_time DESC`,
    userId,
    startIso,
    endIso,
  );
}

// ── Competition reports ──────────────────────────────────────────────────────

export async function insertCompetitionReport(
  db: SQLiteDatabase,
  data: CompetitionReportRow,
): Promise<void> {
  // La columna photo_uri es TEXT; guardamos el array de fotos como JSON
  // para soportar varias sin migrar el schema.
  await db.runAsync(
    `INSERT OR REPLACE INTO competition_reports
      (report_id, session_id, visit_id, store_id, user_id, brand_id, activation_type, photo_uri, notes, created_at, synced, photos_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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
