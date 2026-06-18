import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { LocationSubscription } from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from './AuthContext';
import {
  insertSession,
  updateSessionEnd,
  insertVisit,
  insertLocationPing,
  getUnsyncedCount,
  insertCompetitionReport,
  getUnsyncedCompetitionCount,
} from '../services/db';
import { BACKGROUND_LOCATION_TASK } from '../tasks/locationTask';
import { mockStores } from '../mock-data';
import { fetchTodayRoute, fetchStoresByIds } from '../services/routesApi';
import { newId } from '../services/sync/ids';
import { shouldEmitPing } from '../services/sync/pingThrottle';
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
  const lastPingAt = useRef<number | null>(null);
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
    lastPingAt.current = null;

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
    if (startLat != null && startLng != null) {
      lastPingAt.current = Date.now();
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

    // Start GPS tracking
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsState('error');
        return;
      }

      // Foreground watch — keeps GPS chip and anti-fraud up to date
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          const lat = loc.coords.latitude, lng = loc.coords.longitude;
          setCurrentLocation({ lat, lng });
          setGpsState('found');
          // Pings en foreground (funciona en Expo Go); throttle ~30s. Los sube el flush.
          if (sessionId.current && shouldEmitPing(lastPingAt.current, Date.now())) {
            lastPingAt.current = Date.now();
            insertLocationPing(db, {
              ping_id: newId(),
              session_id: sessionId.current,
              user_id: user?.id ?? 'unknown',
              timestamp: new Date(loc.timestamp).toISOString(),
              lat,
              lng,
            }).catch(() => {});
          }
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
        timeInterval: 30_000,   // every 30 seconds
        distanceInterval: 50,   // or every 50 metres
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
    // Stop foreground watch
    locationSub.current?.remove();
    locationSub.current = null;

    // Stop background task
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (e) {
      console.warn('[RouteContext] could not stop background tracking:', e);
    }

    if (sessionId.current) {
      await updateSessionEnd(db, sessionId.current, new Date().toISOString());
      // Re-marca la sesión como no sincronizada para propagar session_end.
      await db.runAsync(`UPDATE sessions SET synced = 0 WHERE session_id = ?`, sessionId.current);
    }

    setSessionActive(false);
    setSessionEnded(true);
    setGpsState('idle');
    setCurrentLocation(null);

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
    if (competitionReport) {
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
    }

    await refreshSyncCount();
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
