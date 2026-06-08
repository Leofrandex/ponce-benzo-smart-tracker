"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { User } from "./types";
import { getSupabaseBrowser } from "./supabase/client";

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

  // Carga el perfil de la tabla users para el usuario autenticado.
  async function loadProfile(userId: string | undefined) {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    setProfile((data as User) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
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
