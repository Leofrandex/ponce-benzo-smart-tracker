"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from "./lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);

    if (email.trim().toLowerCase() === DEMO_EMAIL && password.trim() === DEMO_PASSWORD) {
      signIn();
      router.push("/select");
      return;
    }

    // Any other credentials are rejected in demo mode
    setLoading(false);
    setError("Credenciales incorrectas. Usa demo@poncebenzo.com / demo123.");
  };

  return (
    <div className="login-screen">
      {/* Logo */}
      <div className="login-logo">
        <Image
          src="/pb_logo.png"
          alt="Ponce & Benzo"
          width={220}
          height={120}
          className="login-logo-img"
          priority
        />
        <div className="login-tagline">Smart Tracker</div>
      </div>

      {/* Login Card */}
      <form className="login-card" onSubmit={handleLogin}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
            Bienvenido
          </h1>
          <p className="text-muted text-sm">
            Inicia sesión para ver tu ruta del día.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "#f43f5e",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            className="form-input"
            type="email"
            placeholder="demo@poncebenzo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <button
          id="btn-login"
          className="btn btn-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <p className="text-muted text-xs" style={{ textAlign: "center" }}>
          ¿Problemas para acceder? Contacta a tu supervisor.
        </p>
      </form>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
