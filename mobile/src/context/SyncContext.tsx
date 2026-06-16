import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";
import { flush } from "../services/sync/syncClient";
import { getTotalUnsyncedCount } from "../services/db";

type SyncStatus = "idle" | "syncing" | "offline" | "synced";
interface SyncContextValue { pendingCount: number; status: SyncStatus; flushNow: () => Promise<void>; refreshCount: () => Promise<void>; }
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const running = useRef(false);
  const refreshCount = useCallback(async () => { setPendingCount(await getTotalUnsyncedCount(db)); }, [db]);
  const flushNow = useCallback(async () => {
    if (!user || running.current) return;
    running.current = true; setStatus("syncing");
    try { const { failed } = await flush(db, supabase); await refreshCount(); setStatus(failed > 0 ? "offline" : "synced"); }
    catch { setStatus("offline"); }
    finally { running.current = false; }
  }, [db, user, refreshCount]);
  useEffect(() => { refreshCount(); if (user) flushNow(); }, [user, flushNow, refreshCount]);
  useEffect(() => { const id = setInterval(() => { flushNow(); }, 60_000); return () => clearInterval(id); }, [flushNow]);
  return <SyncContext.Provider value={{ pendingCount, status, flushNow, refreshCount }}>{children}</SyncContext.Provider>;
}
export function useSyncCtx(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncCtx must be used inside SyncProvider");
  return ctx;
}
