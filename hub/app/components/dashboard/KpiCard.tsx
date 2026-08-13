"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { kpiDef, type KpiId } from "@/app/lib/dashboard-kpis";

interface Props {
  kpi: KpiId;
  valor: string;
  detalle?: string;
  tono?: "normal" | "peligro" | "exito";
  icono?: React.ReactNode;
}

const COLOR = { normal: undefined, peligro: "var(--danger)", exito: "var(--success)" };

export default function KpiCard({ kpi, valor, detalle, tono = "normal", icono }: Props) {
  const def = kpiDef(kpi);
  // Un solo estado sirve a los tres gestos: hover en escritorio, tap en tactil
  // y foco por teclado. Sin esto, en un telefono el tooltip seria inalcanzable.
  const [abierto, setAbierto] = useState(false);
  const tooltipId = `kpi-tooltip-${kpi}`;

  return (
    <div className="stat-card" style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Qué mide ${def.etiqueta}`}
        aria-describedby={abierto ? tooltipId : undefined}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        // El foco por teclado (Tab) tambien debe abrir el tooltip, pero solo
        // cuando NO viene de un puntero: en tactil, el toque dispara primero
        // "focus" y despues "click" sobre el mismo boton. Si focus abriera
        // siempre, el click inmediato lo volveria a cerrar y el primer toque
        // no mostraria nada. Filtrando por relatedTarget/puntero evitamos
        // reaccionar al focus sintetico del tap y dejamos que sea el click
        // (onClick) el que abra/cierre en tactil, y el foco real de teclado
        // el que abra al navegar con Tab.
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setAbierto(true);
        }}
        onBlur={() => setAbierto(false)}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
        }}
        style={{
          position: "absolute", top: 8, right: 8, background: "none", border: "none",
          padding: 4, cursor: "pointer", color: "var(--text-muted)", lineHeight: 0,
        }}
      >
        <Info size={14} />
      </button>

      {abierto && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute", top: 30, right: 8, zIndex: 20, width: 260,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.45,
            color: "var(--text-muted)", boxShadow: "0 6px 20px rgba(0,0,0,.12)",
            textAlign: "left", fontWeight: 400,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>
            {def.etiqueta}
          </strong>
          {def.descripcion}
        </div>
      )}

      {icono}
      <div className="stat-value" style={{ color: COLOR[tono] }}>{valor}</div>
      <div className="stat-label">{def.etiqueta}</div>
      {detalle && (
        <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{detalle}</div>
      )}
    </div>
  );
}
