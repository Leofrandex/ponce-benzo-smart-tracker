import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { supabase } from '../services/supabase';
import { getDb } from '../store/localStore';
import {
  resolveProfileLoad, loadUserProfile, saveUserProfile, clearUserProfile,
  type ProfileOnline,
} from '../services/userCache';
import { logEvent } from '../diagnostics/log';

// El perfil no debe colgar el arranque: si la red no responde en este tiempo,
// caemos al perfil cacheado (offline) en vez de esperar indefinidamente.
const PROFILE_FETCH_TIMEOUT_MS = 8000;

async function fetchProfileOnline(userId: string): Promise<ProfileOnline> {
  try {
    const result = await Promise.race([
      supabase.from('users').select('*').eq('id', userId).single(),
      new Promise<{ data: null; error: unknown }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), PROFILE_FETCH_TIMEOUT_MS),
      ),
    ]);
    if (result.error || !result.data) return { ok: false };
    return { ok: true, user: result.data as User };
  } catch {
    return { ok: false };
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string | undefined) {
    if (!userId) { setUser(null); return; }
    const db = await getDb();
    // Red primero; si falla (offline), restaurar el perfil cacheado en vez de desloguear.
    const online = await fetchProfileOnline(userId);
    const cached = online.ok ? null : await loadUserProfile(db, userId);
    const resolved = resolveProfileLoad(online, cached);
    setUser(resolved.user);
    if (online.ok && resolved.user) await saveUserProfile(db, resolved.user);
    await logEvent(db, resolved.source === 'none' ? 'warn' : 'info', 'auth_profile', resolved.source, userId);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: 'Credenciales incorrectas. Verificá tu email y contraseña.' };
    return { error: null };
  }

  async function signOut(): Promise<void> {
    const current = user;
    await supabase.auth.signOut();
    if (current) {
      try { await clearUserProfile(await getDb(), current.id); } catch { /* no bloquear el logout */ }
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
