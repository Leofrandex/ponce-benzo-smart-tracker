import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { insertLocationPingSync } from '../services/db';

export const BACKGROUND_LOCATION_TASK = 'pb-background-location';

// Must be defined at module level — before any startLocationUpdatesAsync call
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };

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
});
