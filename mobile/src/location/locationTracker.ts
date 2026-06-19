import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { BACKGROUND_LOCATION_TASK } from './backgroundTask';
import { getDb } from '../store/localStore';
import { resolveToday } from '../session/sessionStore';
import { logEvent } from '../diagnostics/log';

const STALE_PING_MS = 90_000;

export async function requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  let bg = { status: 'denied' } as Location.LocationPermissionResponse;
  if (fg.status === 'granted') bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: fg.status === 'granted', background: bg.status === 'granted' };
}

export async function requestBatteryExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:com.poncebenzo.tracker' },
    );
  } catch { /* algunos OEM no exponen el intent; no es fatal */ }
}

async function startBackground(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Ponce & Benzo — Ruta activa',
      notificationBody: 'Registrando tu ubicación durante la ruta.',
      notificationColor: '#00205C',
    },
  });
}

export async function stopBackground(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

export async function startTracking(onUI: (loc: { lat: number; lng: number }) => void): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
    (loc) => onUI({ lat: loc.coords.latitude, lng: loc.coords.longitude }), // SÓLO UI
  );
  await startBackground();
  return () => sub.remove();
}

export async function ensureTracking(userId: string): Promise<void> {
  const db = await getDb();
  const { state } = await resolveToday(db, userId);
  if (state !== 'ACTIVE') return;
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  const last = await db.getFirstAsync<{ ts: string }>(`SELECT timestamp AS ts FROM location_pings ORDER BY timestamp DESC LIMIT 1`);
  const stale = !last?.ts || Date.now() - new Date(last.ts).getTime() > STALE_PING_MS;
  if (!running || stale) {
    await logEvent(db, 'warn', 'tracking_restart', `running=${running} stale=${stale}`, userId);
    await startBackground();
  }
}
