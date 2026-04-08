"use client";

import { useRouter } from "next/navigation";
import { User, LogOut, Info, Smartphone, Wifi } from "lucide-react";
import { mockUser } from "@/app/lib/mock-data";

export default function PerfilPage() {
  const router = useRouter();

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/");
  };

  const systemInfo = [
    { Icon: Info,       label: "Versión de la app",  value: "1.0.0 (demo)" },
    { Icon: Smartphone, label: "Modo",               value: "PWA Progressive Web App" },
    { Icon: Wifi,       label: "Sincronización",     value: "Offline-first habilitado" },
  ];

  return (
    <>
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
            width: 72,
            height: 72,
            background: "var(--accent-glow)",
            border: "2px solid var(--border-accent)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <User size={32} color="var(--accent-light)" strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: "19px", fontWeight: 700 }}>{mockUser.full_name}</div>
        <div className="text-muted text-sm" style={{ marginTop: "4px" }}>{mockUser.email}</div>
        <div style={{ marginTop: "10px" }}>
          <span className="badge badge-accent">
            {mockUser.role === "merchandiser" ? "Mercaderista" : mockUser.role}
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
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </>
  );
}
