"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Route, Activity, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

export default function SelectHubPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [fading, setFading] = useState(false);
  const isSupervisor = profile?.role === "supervisor" || profile?.role === "admin";

  const navigate = (path: string) => {
    setFading(true);
    setTimeout(() => router.push(path), 220);
  };

  if (loading) {
    return (
      <div className="hub-select-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      className="hub-select-screen hub-select-fade"
      style={{
        opacity: fading ? 0 : 1,
        transform: fading ? "translateY(-5px)" : "translateY(0)",
      }}
    >
      <div className="hub-select-header">
        <Image
          src="/pb_logo.png"
          alt="Ponce & Benzo"
          width={160}
          height={88}
          priority
          style={{ objectFit: "contain", width: 160, height: "auto" }}
        />
        <div className="text-muted" style={{ fontSize: "13px", marginTop: "4px" }}>
          ¿Cómo ingresas hoy?
        </div>
      </div>

      <div className="hub-select-grid">
        <button
          className="hub-select-card"
          onClick={() => navigate("/ruta")}
        >
          <div className="hub-select-icon hub-select-icon--mercaderista">
            <Route size={36} strokeWidth={1.5} />
          </div>
          <div className="hub-select-label">Mercaderista</div>
          <div className="hub-select-desc">
            Gestiona tu ruta diaria, registra visitas y sincroniza tu progreso en campo.
          </div>
          <span className="badge badge-accent" style={{ marginTop: "auto" }}>
            Mi Ruta
          </span>
        </button>

        {isSupervisor && (
          <button
            className="hub-select-card"
            onClick={() => navigate("/supervisor")}
          >
            <div className="hub-select-icon hub-select-icon--supervisor">
              <Activity size={36} strokeWidth={1.5} />
            </div>
            <div className="hub-select-label">Supervisor</div>
            <div className="hub-select-desc">
              Monitorea el equipo en tiempo real, revisa cobertura y analiza el rendimiento.
            </div>
            <span className="badge badge-warning" style={{ marginTop: "auto" }}>
              Panel
            </span>
          </button>
        )}
      </div>

      {/* Mi Perfil */}
      <button
        className="hub-select-profile-btn"
        onClick={() => navigate("/perfil")}
      >
        <User size={15} strokeWidth={1.8} />
        Mi Perfil
      </button>
    </div>
  );
}
