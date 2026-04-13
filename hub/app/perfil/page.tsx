"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { User, LogOut, Info, Smartphone, Wifi, ArrowLeft } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";

export default function PerfilPage() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    sessionStorage.clear();
    await signOut();
    router.push("/");
  };

  const systemInfo = [
    { Icon: Info,       label: "Versión de la app",  value: "1.0.0 (demo)" },
    { Icon: Smartphone, label: "Modo",               value: "PWA Progressive Web App" },
    { Icon: Wifi,       label: "Sincronización",     value: "Offline-first habilitado" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px 20px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="header-logo">
          <Image src="/pb_logo.png" alt="Ponce & Benzo" width={90} height={44} style={{ objectFit: "contain" }} />
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "480px", width: "100%", margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
            Mi Perfil
          </h1>
          <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
            Información de tu cuenta
          </p>
        </div>

        {/* User Card */}
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <div
            style={{
              width: 72, height: 72,
              background: "var(--accent-glow)",
              border: "2px solid var(--border-accent)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <User size={32} color="var(--accent-light)" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "19px", fontWeight: 700 }}>{profile?.full_name ?? "—"}</div>
          <div className="text-muted text-sm" style={{ marginTop: "4px" }}>{profile?.email ?? "—"}</div>
          <div style={{ marginTop: "10px" }}>
            <span className="badge badge-accent">
              {profile?.role === "merchandiser" ? "Mercaderista" :
               profile?.role === "supervisor" ? "Supervisor" :
               profile?.role === "admin" ? "Admin" : "—"}
            </span>
          </div>
        </div>

        {/* App Info */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: "12px" }}>Información del sistema</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {systemInfo.map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-muted" style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <Icon size={14} />
                  {label}
                </span>
                <span className="text-sm" style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          id="btn-logout"
          className="btn btn-danger"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </main>
    </div>
  );
}
