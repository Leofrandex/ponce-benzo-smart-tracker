"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "./types";

export const DEMO_EMAIL    = "demo@poncebenzo.com";
export const DEMO_PASSWORD = "demo123";

const DEMO_PROFILE: User = {
  id:         "demo-supervisor-001",
  full_name:  "Ana Martínez",
  email:      DEMO_EMAIL,
  role:       "supervisor",
  active:     true,
  created_at: "2024-01-01T00:00:00Z",
};

interface AuthContextType {
  profile: User | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loggedIn =
      typeof window !== "undefined" &&
      localStorage.getItem("pv_demo_mode") === "true";
    setProfile(loggedIn ? DEMO_PROFILE : null);
    setLoading(false);
  }, []);

  const signIn = () => {
    localStorage.setItem("pv_demo_mode", "true");
    setProfile(DEMO_PROFILE);
  };

  const signOut = () => {
    localStorage.removeItem("pv_demo_mode");
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
