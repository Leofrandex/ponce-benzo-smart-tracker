"use client";

import { TrendingUp, LayoutGrid, Lock } from "lucide-react";

function Placeholder({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start", opacity: 0.7 }}>
      <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
          <Lock size={11} color="var(--text-muted)" />
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{desc}</div>
      </div>
      <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", fontSize: "9px" }}>Próximamente</span>
    </div>
  );
}

export function LongTermPlaceholders() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <Placeholder icon={<TrendingUp size={15} color="var(--accent)" />} title="Histórico de rotación de productos" desc="Qué productos se mueven más en esta sucursal. Requiere mecanismo de recolección de datos." />
      <Placeholder icon={<LayoutGrid size={15} color="var(--accent)" />} title="Exhibición ideal (anaquel)" desc="Mapa de calor del posicionamiento de productos en el anaquel de esta tienda." />
    </div>
  );
}
