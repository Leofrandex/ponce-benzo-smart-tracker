import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { insertLocationPingSync } from '../services/db';
import { flushPings } from '../services/sync/syncClient';
import { supabase } from '../services/supabase';

export const BACKGROUND_LOCATION_TASK = 'pb-background-location';

// Must be defined at module level — before any startLocationUpdatesAsync call
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  // 1. Guardar cada ping en SQLite (síncrono, resuelve la sesión abierta adentro).
  for (const loc of locations) {
    try {
      insertLocationPingSync(
        null, // resuelto desde la sesión abierta dentro de insertLocationPingSync
        new Date(loc.timestamp).toISOString(),
        loc.coords.latitude,
        loc.coords.longitude,
      );
    } catch (e) {
      console.warn('[LocationTask] failed to save ping:', e);
    }
  }

  // 2. Subir los pings pendientes AHORA, sin esperar a que vuelva el foreground.
  //    En el APK el task corre en segundo plano; sin esto los pings se acumulaban
  //    y sólo se descargaban "de golpe" al reabrir la app.
  try {
    const { openDatabaseAsync } = require('expo-sqlite') as typeof import('expo-sqlite');
    const db = await openDatabaseAsync('poncebenzo.db');
    await flushPings(db, supabase);
  } catch (e) {
    console.warn('[LocationTask] background ping flush failed:', e);
  }
});
