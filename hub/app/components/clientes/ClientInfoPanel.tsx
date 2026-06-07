"use client";

import { MapPin, Tag, Layers, Package, Pencil } from "lucide-react";
import type { Store } from "@/app/lib/types";

const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
        <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
      </div>
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
        <Row icon={<MapPin size={15} color="var(--accent)" />} label="Dirección" value={store.address ?? "—"} />
        <Row icon={<Layers size={15} color="var(--accent)" />} label="Zona" value={zona} />
        <Row icon={<Tag size={15} color="var(--accent)" />} label="Canal" value={store.business_channel ? (CHANNEL_LABELS[store.business_channel] ?? store.business_channel) : "—"} />
        <Row icon={<Tag size={15} color="var(--accent)" />} label="Clasificación" value={store.classification ?? "—"} />
        <Row icon={<Package size={15} color="var(--accent)" />} label="Última reposición" value={lastRestock ? new Date(lastRestock + "T00:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" }) : "Sin registro"} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MapPin size={15} color="var(--text-muted)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>Coordenadas GPS</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{store.master_lat.toFixed(4)}, {store.master_lng.toFixed(4)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
