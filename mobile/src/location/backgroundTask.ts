import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getDb } from '../store/localStore';
import { shouldEmitPing } from './pingThrottle';
import { logEvent } from '../diagnostics/log';
import { flush } from '../sync/syncEngine';
import { supabase } from '../services/supabase';
import { newId } from '../services/sync/ids';

export const BACKGROUND_LOCATION_TASK = 'pb-background-location';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) { console.warn('[bgTask] error:', error.message); return; }
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  if (!locations?.length) return;

  try {
    const db = await getDb(); // HANDLE COMPARTIDO — clave del throttle confiable
    const open = await db.getFirstAsync<{ session_id: string; user_id: string }>(
      `SELECT session_id, user_id FROM sessions WHERE session_end IS NULL ORDER BY session_start DESC LIMIT 1`,
    );
    if (!open) return;

    const last = await db.getFirstAsync<{ ts: string }>(
      `SELECT timestamp AS ts FROM location_pings ORDER BY timestamp DESC LIMIT 1`,
    );
    const lastMs = last?.ts ? new Date(last.ts).getTime() : null;

    if (shouldEmitPing(lastMs, Date.now())) {
      const loc = locations[locations.length - 1]; // sólo la más reciente del lote
      await db.runAsync(
        `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        newId(), open.session_id, open.user_id, new Date(loc.timestamp).toISOString(),
        loc.coords.latitude, loc.coords.longitude,
      );
      await logEvent(db, 'info', 'ping_insert', `${loc.coords.latitude.toFixed(5)},${loc.coords.longitude.toFixed(5)}`, open.user_id);
    } else {
      await logEvent(db, 'info', 'ping_skip', `throttle`, open.user_id);
    }

    // Flush COMPLETO (sesiones + visitas + reportes + pings + fotos), no sólo pings:
    // el timer JS de SyncContext se suspende con la app en background, así que este
    // callback es la única vía para que el último punto de la ruta suba si el
    // promotor guarda el teléfono al terminar. Todos los requests tienen deadline.
    await flush(db, supabase);
  } catch (e) {
    console.warn('[bgTask] failed:', e);
  }
});
