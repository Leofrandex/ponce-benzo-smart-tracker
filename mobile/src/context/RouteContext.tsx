import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { insertVisit, insertCompetitionReport, getTodayVisits } from '../services/db';
import { mockStores } from '../mock-data';
import { fetchTodayRoute, fetchStoresByIds } from '../services/routesApi';
import { resolveRouteLoad, saveRouteSnapshot, loadRouteSnapshot, mergeRecordedStatuses, type OnlineResult } from '../services/routeCache';
import { useSyncCtx } from './SyncContext';
import { getDb } from '../store/localStore';
import { resolveToday, startSession as ssStart, endSession as ssEnd, closeStaleSessions } from '../session/sessionStore';
import { logEvent } from '../diagnostics/log';
import { withTimeout } from '../utils/withTimeout';
import { startTracking, stopBackground, ensureTracking, requestPermissions, requestBatteryExemption } from '../location/locationTracker';
import type { RouteStoreItem, VisitRecord, StoreStatus, GPSState, CompetitionReportRecord } from '../types';

interface RouteContextValue {
  routeItems: RouteStoreItem[];
  routeLoading: boolean;
  routeError: string | null;
  routeDate: string | null;
  routeFromCache: boolean;
  reloadRoute: () => void;
  sessionActive: boolean;
  sessionEnded: boolean;
  gpsState: GPSState;
  currentLocation: { lat: number; lng: number } | null;
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
  const [routeFromCache, setRouteFromCache] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeMode, setRouteModeState] = useState<'normal' | 'special'>('normal');

  const routeId = useRef<string | null>(null);
  const stopWatchRef = useRef<null | (() => void)>(null);
  const startingRef = useRef(false); // guard de re-entrada para no crear sesiones duplicadas
  const { flushNow, refreshCount } = useSyncCtx();

  const loadRoute = useCallback(async () => {
    if (!user) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      // 1) Intento online. Un null autoritativo ("sin ruta asignada hoy") NO cae a caché.
      let online: OnlineResult;
      try {
        const picked = await fetchTodayRoute(user.id);
        if (!picked) {
          setRouteItems([]);
          setRouteDate(null);
          setRouteFromCache(false);
          return;
        }
        const stores = await fetchStoresByIds(picked.store_ids);
        online = { ok: true, route_id: picked.route_id, route_date: picked.route_date, stores };
      } catch {
        online = { ok: false };
      }

      // 2) Fallback a caché sólo si el online falló (offline / red caída).
      const db = await getDb();
      const cached = online.ok ? null : await loadRouteSnapshot(db, user.id);
      const result = resolveRouteLoad(online, cached);
      await logEvent(db, result.source === 'error' ? 'warn' : 'info', 'route_load', result.source, user.id);

      if (result.source === 'error') {
        setRouteError('No se pudo cargar la ruta y no hay copia guardada. Conectate al menos una vez.');
        setRouteFromCache(false);
        return;
      }

      routeId.current = result.route_id;
      // Reproyectar el estado desde las visitas ya registradas hoy (SQLite). routeItems
      // es efímero: sin esta fusión, cada recarga (refresh de token, reconexión, foreground)
      // dejaba todas las tiendas en 'pending' y el conteo colapsaba al último registro.
      const baseItems = result.stores.map((store, i) => ({ store, order: i + 1, status: 'pending' as StoreStatus }));
      const todayVisits = await getTodayVisits(db, user.id).catch(() => []);
      setRouteItems(mergeRecordedStatuses(baseItems, todayVisits));
      setRouteDate(result.route_date);
      setRouteFromCache(result.source === 'cache');

      // 3) En éxito online, refrescar el snapshot para el próximo cold-start offline (no bloquea).
      if (result.source === 'online') {
        saveRouteSnapshot(db, user.id, {
          route_id: result.route_id,
          route_date: result.route_date,
          cached_at: new Date().toISOString(),
          stores: result.stores,
        }).catch((e) => console.warn('[route] no se pudo cachear la ruta:', (e as { message?: string })?.message ?? e));
      }
    } finally {
      setRouteLoading(false);
    }
    // Depende solo del id: un refresh de token reemplaza el objeto `user` pero
    // mantiene el mismo id, así que la ruta NO debe recargarse (y borrar el progreso).
  }, [user?.id]);

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
      try {
        stopWatchRef.current?.();
        stopWatchRef.current = null;
        stopWatchRef.current = await startTracking(({ lat, lng }) => {
          setCurrentLocation({ lat, lng });
          setGpsState('found');
        });
        await ensureTracking(user.id);
      } catch (e) {
        setGpsState('error');
        console.warn('[route] no se pudo reanudar el tracking:', (e as { message?: string })?.message ?? e);
      }
    }
  }, [user]);

  useEffect(() => {
    deriveState();
    return () => { stopWatchRef.current?.(); stopWatchRef.current = null; };
  }, [deriveState]);

  // Watchdog: when returning to foreground, reassure background tracking is running
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && user) ensureTracking(user.id);
    });
    return () => sub.remove();
  }, [user]);

  async function startSession() {
    // Guard de re-entrada: ignora toques repetidos / re-renders mientras ya se
    // está arrancando o hay sesión activa (evita crear sesiones duplicadas).
    if (!user || startingRef.current || sessionActive) return;
    startingRef.current = true;
    try {
      const perms = await requestPermissions();
      if (!perms.foreground) { setGpsState('error'); return; }
      await requestBatteryExemption();
      const db = await getDb();
      // Doble chequeo contra SQLite: si ya hay jornada activa hoy (carrera), derivar en vez de duplicar.
      const existing = await resolveToday(db, user.id);
      if (existing.state === 'ACTIVE') { setSessionActive(true); setSessionEnded(false); return; }

      // El fix de GPS no debe bloquear el arranque: precisión Balanced (rápida) con
      // timeout de 3s. Si no llega, la sesión arranca sin coords y el tracker las
      // completa a los pocos segundos (evita que "Empezar Ruta" se sienta trabado).
      let lat: number | null = null, lng: number | null = null;
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        3000,
        null,
      );
      if (pos) {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      await ssStart(db, { userId: user.id, routeId: routeId.current ?? 'unknown', startLat: lat, startLng: lng });
      if (lat != null) setCurrentLocation({ lat, lng: lng! });
      setSessionActive(true);
      setSessionEnded(false);
      setGpsState(lat != null ? 'found' : 'searching');
      stopWatchRef.current?.();
      stopWatchRef.current = null;
      stopWatchRef.current = await startTracking(({ lat: a, lng: b }) => {
        setCurrentLocation({ lat: a, lng: b });
        setGpsState('found');
      });
      flushNow();
    } finally {
      startingRef.current = false;
    }
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
    const db = await getDb();
    const { session } = await resolveToday(db, user?.id ?? '');

    // SQLite PRIMERO, UI después: la pantalla nunca debe mostrar como completado
    // algo que no está guardado en disco. Si este insert falla, el punto queda
    // 'pending' (la verdad) en vez de un falso completado que se revierte al recargar.
    await insertVisit(db, {
      visit_id: record.visit_id,
      session_id: session?.session_id ?? null,
      store_id: record.store_id,
      user_id: user?.id ?? 'unknown',
      check_in_time: record.check_in_time,
      lat: record.check_in_location?.lat ?? null,
      lng: record.check_in_location?.lng ?? null,
      photo_uri: JSON.stringify(record.photo_uris),
      observations: record.observations ?? null,
      status: record.status,
      anomaly_type:
        record.status === 'anomaly' && record.anomaly_type
          ? JSON.stringify(record.anomaly_type)
          : null,
      skip_reason: record.status === 'skipped' ? record.skip_reason : null,
      last_restock_date: record.last_restock_date,
      synced: 0,
    });

    // Ya está en disco: ahora sí, reflejar en la ruta.
    setRouteItems((prev) =>
      prev.map((item) =>
        item.store.store_id === storeId
          ? { ...item, status: record.status as StoreStatus, visit: record }
          : item,
      ),
    );

    // Reporte de competencia opcional: misma tienda, misma operación.
    // Va en try/catch: si algo falla aquí, la visita YA quedó guardada y la
    // pantalla debe cerrar igual (antes una excepción acá dejaba el registro
    // abierto sin volver al menú).
    if (competitionReport) {
      try {
        await insertCompetitionReport(db, {
          report_id: competitionReport.report_id,
          session_id: session?.session_id ?? null,
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
    refreshCount().catch(() => {});
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
        routeFromCache,
        reloadRoute: loadRoute,
        sessionActive,
        sessionEnded,
        gpsState,
        currentLocation,
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
