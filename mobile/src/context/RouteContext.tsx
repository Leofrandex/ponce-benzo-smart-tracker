import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { LocationSubscription } from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from './AuthContext';
import {
  insertSession,
  updateSessionEnd,
  getTodaySession,
  closeStaleSessions,
  insertVisit,
  insertLocationPing,
  getUnsyncedCount,
  insertCompetitionReport,
  getUnsyncedCompetitionCount,
} from '../services/db';
import { BACKGROUND_LOCATION_TASK } from '../tasks/locationTask';
import { mockStores } from '../mock-data';
import { fetchTodayRoute, fetchStoresByIds } from '../services/routesApi';
import { supabase } from '../services/supabase';
import { newId } from '../services/sync/ids';
import { flush } from '../services/sync/syncClient';
import { useSyncCtx } from './SyncContext';
import type { RouteStoreItem, VisitRecord, StoreStatus, GPSState, CompetitionReportRecord } from '../types';

interface RouteContextValue {
  routeItems: RouteStoreItem[];
  routeLoading: boolean;
  routeError: string | null;
  routeDate: string | null;
  reloadRoute: () => void;
  sessionActive: boolean;
  sessionEnded: boolean;
  gpsState: GPSState;
  currentLocation: { lat: number; lng: number } | null;
  pendingSyncCount: number;
  completedCount: number;
  totalCount: number;
  routeMode: 'normal' | 'special';
  setRouteMode: (mode: 'normal' | 'special') => void;
  addStoreToRoute: (storeId: string) => void;
  removeStoreFromRoute: (storeId: string) => void;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  recordVisit: (
    storeId: string,
    record: VisitRecord,
    competitionReport?: CompetitionReportRecord,
  ) => Promise<void>;
}

const RouteContext = createContext<RouteContextValue | null>(null);

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { user } = useAuth();

  const [routeItems, setRouteItems] = useState<RouteStoreItem[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeDate, setRouteDate] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [routeMode, setRouteModeState] = useState<'normal' | 'special'>('normal');

  const locationSub = useRef<LocationSubscription | null>(null);
  const sessionId = useRef<string | null>(null);
  const routeId = useRef<string | null>(null);
  const { flushNow, refreshCount } = useSyncCtx();

  const loadRoute = useCallback(async () => {
    if (!user) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const picked = await fetchTodayRoute(user.id);
      if (!picked) {
        setRouteItems([]);
        setRouteDate(null);
        return;
      }
      routeId.current = picked.route.route_id;
      const stores = await fetchStoresByIds(picked.route.store_ids);
      setRouteItems(stores.map((store, i) => ({ store, order: i + 1, status: 'pending' as StoreStatus })));
      setRouteDate(picked.route.route_date);
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : 'Error al cargar la ruta');
    } finally {
      setRouteLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  // Rehidratar el estado del día al abrir la app:
  //  - Sesión de HOY abierta  → reanudar (tracking + "Finalizar Ruta").
  //  - Sesión de HOY cerrada  → ruta finalizada: NO se puede reiniciar el mismo día.
  //  - Sin sesión hoy         → "Empezar Ruta".
  // Las sesiones abiertas de días anteriores se cierran para que no reanuden ni
  // se confundan con la jornada de hoy (causaba "ruta activa" fantasma en Expo Go).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await closeStaleSessions(db, user.id);
      const today = await getTodaySession(db, user.id);
      if (cancelled || !today) return;

      if (today.session_end == null) {
        // Jornada de hoy aún abierta → reanudar.
        sessionId.current = today.session_id;
        routeId.current = today.route_id;
        setSessionActive(true);
        setSessionEnded(false);
        setGpsState('searching');
        await beginTracking();
      } else {
        // Jornada de hoy ya finalizada → bloquear el reinicio.
        setSessionActive(false);
        setSessionEnded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function refreshSyncCount() {
    const [visits, reports] = await Promise.all([
      getUnsyncedCount(db),
      getUnsyncedCompetitionCount(db),
    ]);
    setPendingSyncCount(visits + reports);
  }

  async function startSession() {
    setSessionActive(true);
    setGpsState('searching');

    // Persist session to SQLite
    const sid = newId();
    sessionId.current = sid;

    // Fix GPS inicial para start_location (Supabase lo exige NOT NULL).
    let startLat: number | null = null, startLng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        startLat = pos.coords.latitude; startLng = pos.coords.longitude;
        setCurrentLocation({ lat: startLat, lng: startLng });
        setGpsState('found');
      }
    } catch { /* sin fix: la sesión sube cuando haya coords */ }

    await insertSession(db, {
      session_id: sid,
      user_id: user?.id ?? 'unknown',
      route_id: routeId.current ?? 'unknown',
      session_start: new Date().toISOString(),
      start_lat: startLat,
      start_lng: startLng,
    });

    // Ping inicial desde el fix de arranque, para aparecer en el mapa cuanto antes.
    // (El task de background toma la posta ~30s después, usando este ping como
    // referencia del throttle compartido.)
    if (startLat != null && startLng != null) {
      await insertLocationPing(db, {
        ping_id: newId(),
        session_id: sid,
        user_id: user?.id ?? 'unknown',
        timestamp: new Date().toISOString(),
        lat: startLat,
        lng: startLng,
      });
    }

    // Empuje inmediato al servidor (mapa en vivo).
    flushNow();

    await beginTracking();
  }

  // Arranca el watch de GPS en foreground + el tracking en background.
  // Reutilizado por startSession y por la rehidratación al abrir la app.
  async function beginTracking() {
    if (locationSub.current) return; // ya hay un watch activo

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsState('error');
        return;
      }

      // Foreground watch — SÓLO actualiza el chip de GPS y la anti-fraude.
      // Los pings los escribe exclusivamente el task de background (fuente única,
      // throttleada a ~30s), para no duplicar ni saturar como pasaba antes.
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
        (loc) => {
          setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setGpsState('found');
        },
      );
      locationSub.current = sub;

      // Background tracking — saves pings to SQLite even when app is backgrounded
      await startBackgroundTracking();
    } catch {
      setGpsState('error');
    }
  }

  async function startBackgroundTracking() {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        // Background permission denied — foreground-only tracking still works
        return;
      }

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (alreadyRunning) return;

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30_000,   // cada 30 segundos
        distanceInterval: 0,    // por tiempo, no por movimiento (sale aunque esté quieto)
        deferredUpdatesInterval: 30_000,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'Ponce & Benzo — Ruta activa',
          notificationBody: 'Registrando tu ubicación durante la ruta.',
          notificationColor: '#00205C',
        },
        showsBackgroundLocationIndicator: true,
      });
    } catch (e) {
      // Non-fatal — background tracking is best-effort
      console.warn('[RouteContext] background tracking unavailable:', e);
    }
  }

  async function endSession() {
    // 1. UI inmediata (el botón siempre responde, pase lo que pase abajo).
    setSessionActive(false);
    setSessionEnded(true);
    setGpsState('idle');
    setCurrentLocation(null);

    // 2. Parar el watch de foreground y el task de background.
    locationSub.current?.remove();
    locationSub.current = null;
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (e) {
      console.warn('[RouteContext] could not stop background tracking:', e);
    }

    // 3. Resolver la sesión a cerrar. Si se perdió el ref en memoria (remount,
    //    proceso recreado por el OS), se recupera la jornada abierta de hoy desde
    //    SQLite — así el cierre nunca se "salta" por un sessionId.current nulo.
    let sid = sessionId.current;
    if (!sid && user) {
      const today = await getTodaySession(db, user.id);
      if (today && today.session_end == null) sid = today.session_id;
    }

    if (sid) {
      const endTime = new Date().toISOString();
      // Local primero, marcada como pendiente (synced=0) para que el flush la suba
      // sí o sí si el update directo no confirma.
      await updateSessionEnd(db, sid, endTime);
      await db.runAsync(`UPDATE sessions SET synced = 0 WHERE session_id = ?`, sid);
      try {
        // .select() devuelve las filas afectadas → verificamos que SÍ se actualizó
        // (un update que matchea 0 filas no lanza error; antes lo dábamos por bueno).
        const { data, error } = await supabase
          .from('sessions')
          .update({ session_end: endTime })
          .eq('session_id', sid)
          .select('session_id');
        if (error) throw error;
        if (data && data.length > 0) {
          await db.runAsync(`UPDATE sessions SET synced = 1 WHERE session_id = ?`, sid);
        } else {
          console.warn('[session] update afectó 0 filas — el flush la subirá por upsert');
        }
      } catch (e) {
        console.warn('[session] cierre directo falló (reintenta en flush):', (e as { message?: string })?.message ?? e);
      }
    }

    // Empuje directo (idempotente). Si quedó synced=0, el upsert del flush la cierra.
    try { await flush(db, supabase); } catch { /* el intervalo de 60s reintenta */ }
    flushNow();
    refreshCount();
  }

  async function recordVisit(
    storeId: string,
    record: VisitRecord,
    competitionReport?: CompetitionReportRecord,
  ) {
    // Update in-memory route state
    setRouteItems((prev) =>
      prev.map((item) =>
        item.store.store_id === storeId
          ? { ...item, status: record.status as StoreStatus, visit: record }
          : item,
      ),
    );

    // Persist to SQLite — las fotos van como JSON en la columna photo_uri TEXT
    await insertVisit(db, {
      visit_id: record.visit_id,
      session_id: sessionId.current ?? null,
      store_id: record.store_id,
      user_id: user?.id ?? 'unknown',
      check_in_time: record.check_in_time,
      lat: record.check_in_location?.lat ?? null,
      lng: record.check_in_location?.lng ?? null,
      photo_uri: JSON.stringify(record.photo_uris),
      observations: record.observations ?? null,
      status: record.status,
      anomaly_type: record.status === 'anomaly' ? record.anomaly_type : null,
      skip_reason: record.status === 'skipped' ? record.skip_reason : null,
      last_restock_date: record.last_restock_date,
      synced: 0,
    });

    // Reporte de competencia opcional: misma tienda, misma operación.
    // Va en try/catch: si algo falla aquí, la visita YA quedó guardada y la
    // pantalla debe cerrar igual (antes una excepción acá dejaba el registro
    // abierto sin volver al menú).
    if (competitionReport) {
      try {
        await insertCompetitionReport(db, {
          report_id: competitionReport.report_id,
          session_id: sessionId.current ?? null,
          visit_id: record.visit_id,
          store_id: storeId,
          user_id: user?.id ?? 'unknown',
          brand_id: competitionReport.brand_id,
          activation_type: competitionReport.activation_type,
          photo_uris: competitionReport.photo_uris,
          notes: competitionReport.notes,
          created_at: new Date().toISOString(),
          synced: 0,
        });
      } catch (e) {
        console.warn('[visit] competition insert FAIL:', (e as { message?: string })?.message ?? e);
      }
    }

    // Conteo y sync en segundo plano: no se esperan para no bloquear el cierre.
    refreshSyncCount().catch(() => {});
    flushNow();
  }

  function setRouteMode(mode: 'normal' | 'special') {
    setRouteModeState(mode);
    // 'special' = ruta personalizable: arranca vacía y se arma a mano.
    // 'normal' = restaura la ruta configurada (mock).
    if (mode === 'special') {
      setRouteItems([]);
    } else {
      loadRoute();
    }
  }

  function addStoreToRoute(storeId: string) {
    setRouteItems((prev) => {
      if (prev.some((item) => item.store.store_id === storeId)) return prev;
      const store = mockStores.find((s) => s.store_id === storeId);
      if (!store) return prev;
      return [...prev, { store, order: prev.length + 1, status: 'pending' as const }];
    });
  }

  function removeStoreFromRoute(storeId: string) {
    setRouteItems((prev) =>
      prev
        .filter((item) => item.store.store_id !== storeId)
        .map((item, index) => ({ ...item, order: index + 1 })),
    );
  }

  const completedCount = routeItems.filter((i) => i.status !== 'pending').length;
  const totalCount = routeItems.length;

  return (
    <RouteContext.Provider
      value={{
        routeItems,
        routeLoading,
        routeError,
        routeDate,
        reloadRoute: loadRoute,
        sessionActive,
        sessionEnded,
        gpsState,
        currentLocation,
        pendingSyncCount,
        completedCount,
        totalCount,
        routeMode,
        setRouteMode,
        addStoreToRoute,
        removeStoreFromRoute,
        startSession,
        endSession,
        recordVisit,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

export function useRouteCtx(): RouteContextValue {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRouteCtx must be used inside RouteProvider');
  return ctx;
}
