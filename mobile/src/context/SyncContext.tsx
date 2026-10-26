import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { getDb } from '../store/localStore';
import { flush, pendingCounts, type PendingCounts } from '../sync/syncEngine';
import { flushDeviceLogs } from '../diagnostics/log';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'synced';
interface SyncContextValue { counts: PendingCounts; status: SyncStatus; flushNow: () => Promise<void>; refreshCount: () => Promise<void>; }
const SyncContext = createContext<SyncContextValue | null>(null);

const ZERO: PendingCounts = { records: 0, photos: 0, pings: 0 };

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<PendingCounts>(ZERO);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const running = useRef(false);

  const userId = user?.id;
  const refreshCount = useCallback(async () => {
    setCounts(userId ? await pendingCounts(await getDb(), userId) : ZERO);
  }, [userId]);
  const flushNow = useCallback(async () => {
    if (!userId || running.current) return;
    running.current = true; setStatus('syncing');
    try {
      const db = await getDb();
      await refreshCount(); // que el banner muestre el conteo real mientras sincroniza
      const { failed } = await flush(db, supabase, userId);
      await flushDeviceLogs(db, supabase, userId);
      await refreshCount();
      setStatus(failed > 0 ? 'offline' : 'synced');
    } catch { setStatus('offline'); }
    finally { running.current = false; }
  }, [userId, refreshCount]);

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
