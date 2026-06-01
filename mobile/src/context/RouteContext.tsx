import React, { createContext, useContext, useState, useRef } from 'react';
import * as Location from 'expo-location';
import type { LocationSubscription } from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from './AuthContext';
import {
  insertSession,
  updateSessionEnd,
  insertVisit,
  getUnsyncedCount,
} from '../services/db';
import { BACKGROUND_LOCATION_TASK } from '../tasks/locationTask';
import { getMockRouteItems } from '../mock-data';
import type { RouteStoreItem, VisitRecord, StoreStatus, GPSState } from '../types';

interface RouteContextValue {
  routeItems: RouteStoreItem[];
  sessionActive: boolean;
  sessionEnded: boolean;
  gpsState: GPSState;
  currentLocation: { lat: number; lng: number } | null;
  pendingSyncCount: number;
  completedCount: number;
  totalCount: number;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  recordVisit: (storeId: string, record: VisitRecord) => Promise<void>;
}

const RouteContext = createContext<RouteContextValue | null>(null);

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { user } = useAuth();

  const [routeItems, setRouteItems] = useState<RouteStoreItem[]>(getMockRouteItems);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const locationSub = useRef<LocationSubscription | null>(null);
  const sessionId = useRef<string | null>(null);

  async function refreshSyncCount() {
    const count = await getUnsyncedCount(db);
    setPendingSyncCount(count);
  }

  async function startSession() {
    setSessionActive(true);
    setGpsState('searching');

    // Persist session to SQLite
    const sid = `session-${Date.now()}`;
    sessionId.current = sid;
    await insertSession(db, {
      session_id: sid,
      user_id: user?.id ?? 'unknown',
      route_id: 'route-demo-001',
      session_start: new Date().toISOString(),
      start_lat: null,
      start_lng: null,
    });

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
    }

    setSessionActive(false);
    setSessionEnded(true);
    setGpsState('idle');
    setCurrentLocation(null);
  }

  async function recordVisit(storeId: string, record: VisitRecord) {
    // Update in-memory route state
    setRouteItems((prev) =>
      prev.map((item) =>
        item.store.store_id === storeId
          ? { ...item, status: record.status as StoreStatus, visit: record }
          : item,
      ),
    );

    // Persist to SQLite
    await insertVisit(db, {
      visit_id: record.visit_id,
      session_id: sessionId.current ?? null,
      store_id: record.store_id,
      user_id: user?.id ?? 'unknown',
      check_in_time: record.check_in_time,
      lat: record.check_in_location?.lat ?? null,
      lng: record.check_in_location?.lng ?? null,
      photo_uri: record.photo_uri ?? null,
      observations: record.observations ?? null,
      status: record.status,
      anomaly_type: null,
      skip_reason: null,
      last_restock_date: null,
      synced: 0,
    });

    await refreshSyncCount();
  }

  const completedCount = routeItems.filter((i) => i.status !== 'pending').length;
  const totalCount = routeItems.length;

  return (
    <RouteContext.Provider
      value={{
        routeItems,
        sessionActive,
        sessionEnded,
        gpsState,
        currentLocation,
        pendingSyncCount,
        completedCount,
        totalCount,
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
