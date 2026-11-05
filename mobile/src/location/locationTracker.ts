import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { BACKGROUND_LOCATION_TASK } from './backgroundTask';
import { getDb } from '../store/localStore';
import { resolveToday, isAdhocSession } from '../session/sessionStore';
import { trackingAction } from './trackingAction';
import { logEvent } from '../diagnostics/log';

const STALE_PING_MS = 90_000;
let lastRestartMs: number | null = null; // espera entre reinicios; vive mientras viva el proceso

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

/** `background: false` = solo el seguimiento de UI en primer plano (reporte suelto: sin servicio de fondo ni pings). */
export async function startTracking(
  onUI: (loc: { lat: number; lng: number }) => void,
  opts: { background?: boolean } = {},
): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
    (loc) => onUI({ lat: loc.coords.latitude, lng: loc.coords.longitude }), // SÓLO UI
  );
  if (opts.background !== false) await startBackground();
  return () => sub.remove();
}

export async function ensureTracking(userId: string): Promise<void> {
  const db = await getDb();
  const { state, session } = await resolveToday(db, userId);
  if (state !== 'ACTIVE') return;
  if (await isAdhocSession(db, session?.session_id)) return; // el reporte suelto no usa GPS de fondo
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  const last = await db.getFirstAsync<{ ts: string }>(`SELECT timestamp AS ts FROM location_pings ORDER BY timestamp DESC LIMIT 1`);
  const nowMs = Date.now();
  const stale = !last?.ts || nowMs - new Date(last.ts).getTime() > STALE_PING_MS;
  const action = trackingAction({ running, stale, lastRestartMs, nowMs });
  if (action === 'none') return;
  lastRestartMs = nowMs;
  try {
    if (action === 'restart') {
      await logEvent(db, 'warn', 'tracking_restart', `running=${running} stale=${stale}`, userId);
      await stopBackground();
    }
    await startBackground();
  } catch (e) {
    await logEvent(db, 'error', 'tracking_restart_failed', (e as Error)?.message ?? String(e), userId);
  }
}
