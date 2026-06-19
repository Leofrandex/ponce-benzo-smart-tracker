import type { SQLiteDatabase } from 'expo-sqlite';
import { resolveTodayState, selectStaleOpen, type SessionLike, type TodayState } from './sessionState';
import { newId } from '../services/sync/ids';
import { logEvent } from '../diagnostics/log';

async function allSessions(db: SQLiteDatabase, userId: string): Promise<SessionLike[]> {
  return db.getAllAsync<SessionLike>(
    `SELECT session_id, user_id, session_start, session_end FROM sessions WHERE user_id = ?`, userId,
  );
}

export async function resolveToday(db: SQLiteDatabase, userId: string): Promise<{ state: TodayState; session: SessionLike | null }> {
  return resolveTodayState(await allSessions(db, userId), userId, new Date().toISOString());
}

export async function closeStaleSessions(db: SQLiteDatabase, userId: string): Promise<void> {
  const stale = selectStaleOpen(await allSessions(db, userId), userId, new Date().toISOString());
  for (const s of stale) {
    await db.runAsync(`UPDATE sessions SET session_end = session_start, synced = 0 WHERE session_id = ?`, s.session_id);
    await logEvent(db, 'warn', 'session_stale_closed', s.session_id, userId);
  }
}

export async function startSession(
  db: SQLiteDatabase,
  p: { userId: string; routeId: string; startLat: number | null; startLng: number | null },
): Promise<string> {
  const sid = newId();
  const startIso = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sessions (session_id, user_id, route_id, session_start, start_lat, start_lng, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    sid, p.userId, p.routeId, startIso, p.startLat ?? null, p.startLng ?? null,
  );
  if (p.startLat != null && p.startLng != null) {
    await db.runAsync(
      `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      newId(), sid, p.userId, startIso, p.startLat, p.startLng,
    );
  }
  await logEvent(db, 'info', 'session_start', sid, p.userId);
  return sid;
}

export async function endSession(db: SQLiteDatabase, userId: string): Promise<string | null> {
  const { state, session } = await resolveToday(db, userId);
  if (state !== 'ACTIVE' || !session) {
    await logEvent(db, 'warn', 'session_end_noop', `state=${state}`, userId);
    return null;
  }
  const endIso = new Date().toISOString();
  await db.runAsync(`UPDATE sessions SET session_end = ?, synced = 0 WHERE session_id = ?`, endIso, session.session_id);
  await logEvent(db, 'info', 'session_end', session.session_id, userId);
  return session.session_id;
}
