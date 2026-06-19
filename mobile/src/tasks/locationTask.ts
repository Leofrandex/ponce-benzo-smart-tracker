import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { insertLocationPing } from '../services/db';
import { flushPings } from '../services/sync/syncClient';
import { newId } from '../services/sync/ids';
import { supabase } from '../services/supabase';

export const BACKGROUND_LOCATION_TASK = 'pb-background-location';

// Mínimo entre pings (ms). El task es la ÚNICA fuente de pings; foreground sólo
// actualiza el chip de GPS. Android entrega ubicaciones en lotes y más seguido
// que el timeInterval, así que el throttle real se hace acá leyendo el último
// ping guardado (estado compartido y a prueba de reinicios del JS).
const MIN_PING_GAP_MS = 28_000;

// Must be defined at module level — before any startLocationUpdatesAsync call
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  try {
    const { openDatabaseAsync } = require('expo-sqlite') as typeof import('expo-sqlite');
    const db = await openDatabaseAsync('poncebenzo.db');

    // Sólo se pinguea si hay una jornada abierta.
    const open = await db.getFirstAsync<{ session_id: string; user_id: string }>(
      `SELECT session_id, user_id FROM sessions WHERE session_end IS NULL ORDER BY session_start DESC LIMIT 1`,
    );

    if (open) {
      // Throttle compartido: ¿pasaron ≥28s desde el último ping guardado?
      const last = await db.getFirstAsync<{ timestamp: string }>(
        `SELECT timestamp FROM location_pings ORDER BY timestamp DESC LIMIT 1`,
      );
      const lastMs = last?.timestamp ? new Date(last.timestamp).getTime() : 0;

      if (Date.now() - lastMs >= MIN_PING_GAP_MS) {
        // Una sola ubicación por ciclo: la más reciente del lote.
        const loc = locations[locations.length - 1];
        await insertLocationPing(db, {
          ping_id: newId(),
          session_id: open.session_id,
          user_id: open.user_id,
          timestamp: new Date(loc.timestamp).toISOString(),
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
    }

    // Subir los pings pendientes ahora, sin esperar al foreground.
    await flushPings(db, supabase);
  } catch (e) {
    console.warn('[LocationTask] background ping/flush failed:', e);
  }
});
