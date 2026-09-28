"use client";

import { Pencil } from "lucide-react";
import type { Store } from "@/app/lib/types";
import { haceTexto } from "@/app/lib/queries/restocks";
import { diasEntre, hoyCaracas } from "@/app/lib/queries/taskFilters";

const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};

const LABEL: React.CSSProperties = { fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={LABEL}>{label}</div>
      <div style={{ fontSize: "13px", color: value === "—" ? "var(--text-muted)" : "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export function ClientInfoPanel({ store, lastRestock, onEdit }: { store: Store; lastRestock: string | null; onEdit?: () => void }) {
  const zona = [store.urbanizacion, store.municipio, store.estado].filter(Boolean).join(", ") || "—";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div className="section-title">Información del cliente</div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Pencil size={11} /> Editar
          </button>
        )}
      </div>
      <div className="card" style={{ padding: "0 16px" }}>
        {/* Métrica primaria: días desde la última reposición. */}
        <div style={{ padding: "14px 0 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={LABEL}>Última reposición</div>
          <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.2, fontVariantNumeric: "tabular-nums", color: lastRestock ? "var(--text-primary)" : "var(--text-muted)" }}>
            {lastRestock ? haceTexto(diasEntre(lastRestock, hoyCaracas())) : "Sin registro"}
          </div>
          {lastRestock && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {new Date(lastRestock + "T00:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        <Row label="Dirección" value={store.address ?? "—"} />
        <Row label="Zona" value={zona} />
        <Row label="Canal" value={store.business_channel ? (CHANNEL_LABELS[store.business_channel] ?? store.business_channel) : "—"} />
        <Row label="Clasificación" value={store.classification ?? "—"} />
        <div style={{ padding: "9px 0 12px" }}>
          <div style={LABEL}>Coordenadas GPS</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{store.master_lat.toFixed(4)}, {store.master_lng.toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
}
