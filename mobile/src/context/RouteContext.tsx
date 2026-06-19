import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import {
  insertVisit,
  getUnsyncedCount,
  insertCompetitionReport,
  getUnsyncedCompetitionCount,
} from '../services/db';
import { mockStores } from '../mock-data';
import { fetchTodayRoute, fetchStoresByIds } from '../services/routesApi';
import { useSyncCtx } from './SyncContext';
import { getDb } from '../store/localStore';
import { resolveToday, startSession as ssStart, endSession as ssEnd, closeStaleSessions } from '../session/sessionStore';
import { startTracking, stopBackground, ensureTracking, requestPermissions, requestBatteryExemption } from '../location/locationTracker';
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

  const routeId = useRef<string | null>(null);
  const stopWatchRef = useRef<null | (() => void)>(null);
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

  // Derive session state from SQLite via sessionStore
  const deriveState = useCallback(async () => {
    if (!user) return;
    const db = await getDb();
    await closeStaleSessions(db, user.id);
    const { state } = await resolveToday(db, user.id);
    setSessionActive(state === 'ACTIVE');
    setSessionEnded(state === 'ENDED');
    if (state === 'ACTIVE') {
      setGpsState('searching');
      stopWatchRef.current = await startTracking(({ lat, lng }) => {
        setCurrentLocation({ lat, lng });
        setGpsState('found');
      });
      await ensureTracking(user.id);
    }
  }, [user]);

  useEffect(() => { deriveState(); }, [deriveState]);

  // Watchdog: when returning to foreground, reassure background tracking is running
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && user) ensureTracking(user.id);
    });
    return () => sub.remove();
  }, [user]);

  async function refreshSyncCount() {
    const db = await getDb();
    const [visits, reports] = await Promise.all([
      getUnsyncedCount(db),
      getUnsyncedCompetitionCount(db),
    ]);
    setPendingSyncCount(visits + reports);
  }

  async function startSession() {
    if (!user) return;
    const perms = await requestPermissions();
    if (!perms.foreground) { setGpsState('error'); return; }
    await requestBatteryExemption();
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* sin fix: la sesión sube cuando haya coords */ }
    const db = await getDb();
    await ssStart(db, { userId: user.id, routeId: routeId.current ?? 'unknown', startLat: lat, startLng: lng });
    if (lat != null) setCurrentLocation({ lat, lng: lng! });
    setSessionActive(true);
    setSessionEnded(false);
    setGpsState(lat != null ? 'found' : 'searching');
    stopWatchRef.current = await startTracking(({ lat: a, lng: b }) => {
      setCurrentLocation({ lat: a, lng: b });
      setGpsState('found');
    });
    flushNow();
  }

  async function endSession() {
    setSessionActive(false);
    setSessionEnded(true);
    setGpsState('idle');
    setCurrentLocation(null);
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    await stopBackground();
    if (user) {
      const db = await getDb();
      await ssEnd(db, user.id);
    }
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

    const db = await getDb();

    // Persist to SQLite — las fotos van como JSON en la columna photo_uri TEXT
    await insertVisit(db, {
      visit_id: record.visit_id,
      session_id: null,
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
          session_id: null,
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
