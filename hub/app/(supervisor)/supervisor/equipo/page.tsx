"use client";

import { Users } from "lucide-react";

export default function EquipoPage() {
  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Equipo
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Gestión del equipo de mercaderistas
        </p>
      </div>

      <div className="empty-state">
        <Users size={52} style={{ opacity: 0.2 }} />
        <div className="empty-title">Próximamente</div>
        <div className="empty-desc">
          Vista de gestión del equipo en construcción.
        </div>
      </div>
    </>
  );
}
