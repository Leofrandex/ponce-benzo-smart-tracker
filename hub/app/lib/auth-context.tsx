"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { User } from "./types";
import { getSupabaseBrowser } from "./supabase/client";
import { clearQueryCache } from "./hooks/useSupabaseQuery";

interface AuthContextType {
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  signIn: async () => ({ error: "no-provider" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowser();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null | undefined>(undefined);

  // Carga el perfil de la tabla users para el usuario autenticado.
  async function loadProfile(userId: string | undefined) {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    setProfile((data as User) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      lastUserId.current ??= data.session?.user.id ?? null;
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      // Los datos cacheados son del usuario anterior: otro usuario no debe verlos ni un instante.
      // (SIGNED_IN también llega al recuperar la sesión o volver a la pestaña: solo cuenta si cambió el usuario.)
      const uid = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || uid !== lastUserId.current) clearQueryCache();
      lastUserId.current = uid;
      await loadProfile(session?.user.id);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearQueryCache();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
