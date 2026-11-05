import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { getDb } from '../store/localStore';
import { flush, pendingCounts, type PendingCounts } from '../sync/syncEngine';
import { flushDeviceLogs } from '../diagnostics/log';
import { purgeIfDue } from '../store/purge';
import { expoPhotoFs } from '../services/photos/photoStore';
import { classifyError } from '../sync/errorKind';
import type { SyncStatus } from '../sync/bannerState';

interface SyncContextValue { counts: PendingCounts; status: SyncStatus; flushNow: () => Promise<void>; refreshCount: () => Promise<void>; }
const SyncContext = createContext<SyncContextValue | null>(null);

const ZERO: PendingCounts = { records: 0, photos: 0, pings: 0 };
const BUSY_RETRY_MS = 5_000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<PendingCounts>(ZERO);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const running = useRef(false);
  const refreshing = useRef(false);
  const refreshSeq = useRef(0);
  const busyRetry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user?.id;
  // A quién pertenece la pantalla ahora; null al desmontar. Una pasada que termina tarde
  // (otro usuario, o provider ya desmontado) no debe tocar el estado.
  const activeUser = useRef<string | null | undefined>(userId);
  const clearBusyRetry = () => {
    if (busyRetry.current) clearTimeout(busyRetry.current);
    busyRetry.current = null;
  };

  const refreshCount = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const next = userId ? await pendingCounts(await getDb(), userId) : ZERO;
    // Gana la consulta más reciente: una vieja que llegue tarde no pisa el conteo final.
    if (seq === refreshSeq.current && activeUser.current === userId) setCounts(next);
  }, [userId]);

  // Sin await en el motor: un conteo lento no puede frenar la subida. Si ya hay uno
  // en curso se omite este; el conteo de cierre de flushNow deja el número final.
  const onProgress = useCallback(() => {
    if (refreshing.current) return;
    refreshing.current = true;
    refreshCount().catch(() => {}).finally(() => { refreshing.current = false; });
  }, [refreshCount]);

  const flushNow = useCallback(async (): Promise<void> => {
    if (!userId || running.current || activeUser.current !== userId) return;
    clearBusyRetry();
    running.current = true; setStatus('syncing');
    try {
      const db = await getDb();
      await refreshCount(); // que el banner muestre el conteo real mientras sincroniza
      const { failed, busy, errorKind } = await flush(db, supabase, userId, { onProgress });
      if (busy) {
        // Otra pasada (la tarea de fondo) tiene la cola: seguimos en syncing y volvemos a mirar.
        if (activeUser.current === userId) busyRetry.current = setTimeout(() => { busyRetry.current = null; flushNow(); }, BUSY_RETRY_MS);
        return;
      }
      await flushDeviceLogs(db, supabase, userId);
      await refreshCount();
      if (activeUser.current === userId) setStatus(failed > 0 ? (errorKind === 'network' ? 'offline' : 'error') : 'synced');
      // Limpieza diaria tras un flush correcto; sin await y sin tocar el estado (purgeIfDue nunca lanza).
      if (failed === 0) void purgeIfDue(db, expoPhotoFs, Date.now());
    } catch (e) {
      if (activeUser.current === userId) setStatus(classifyError(e) === 'network' ? 'offline' : 'error');
    } finally { running.current = false; }
  }, [userId, refreshCount, onProgress]);

  // Va antes del efecto que dispara el primer flush de este usuario.
  useEffect(() => {
    activeUser.current = userId;
    setStatus('idle');
    return () => { activeUser.current = null; clearBusyRetry(); };
  }, [userId]);
  useEffect(() => { refreshCount(); if (userId) flushNow(); }, [userId, flushNow, refreshCount]);
  useEffect(() => { const id = setInterval(() => { flushNow(); }, 60_000); return () => clearInterval(id); }, [flushNow]);

  // Al volver la app a primer plano, sincronizar de inmediato: el timer de arriba
  // se suspende en background y sin esto la reconexión esperaba hasta 60s (o nunca,
  // si el promotor abría y cerraba rápido).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') flushNow(); });
    return () => sub.remove();
  }, [flushNow]);

  return <SyncContext.Provider value={{ counts, status, flushNow, refreshCount }}>{children}</SyncContext.Provider>;
}
export function useSyncCtx(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncCtx must be used inside SyncProvider');
  return ctx;
}
