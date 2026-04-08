"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);

    // MOCK: Simulate login — swap for Supabase Auth later
    await new Promise((res) => setTimeout(res, 1200));

    if (email === "demo@ponzivenzo.com" && password === "demo123") {
      router.push("/ruta");
    } else {
      setError("Credenciales incorrectas. Intenta con demo@ponzivenzo.com / demo123");
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Logo */}
      <div className="login-logo">
        <div className="login-logo-mark">
          <Map size={36} color="white" strokeWidth={1.5} />
        </div>
        <div>
          <div className="login-app-name">PV Tracker</div>
          <div className="login-tagline">Ponzivenzo Smart Tracker</div>
        </div>
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
              background: "var(--danger-bg)",
              border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--danger)",
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
            placeholder="usuario@ponzivenzo.com"
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
          Problemas para acceder? Contacta a tu supervisor.
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
