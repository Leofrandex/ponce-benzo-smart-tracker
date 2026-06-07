"use client";

import Link from "next/link";
import { Building2, ChevronRight, AlertTriangle } from "lucide-react";
import type { Store } from "@/app/lib/types";

const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};
const CLASS_COLORS: Record<string, string> = {
  A: "var(--success)", B: "var(--warning)", C: "var(--text-muted)",
};

export interface ClientRow extends Store {
  pending_tasks: number;
}

export function ClientesTable({ rows }: { rows: ClientRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <Building2 size={44} style={{ opacity: 0.2 }} />
        <div className="empty-title">Sin clientes</div>
        <div className="empty-desc">Ningún cliente coincide con los filtros.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
        <div className="contactos-table-header" style={{
          gridTemplateColumns: "2fr 1fr 0.6fr 1fr auto",
          position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)",
        }}>
          <div>Nombre</div><div>Canal</div><div>Clase</div><div>Actividades</div><div></div>
        </div>
        {rows.map((r, idx) => (
        <Link key={r.store_id} href={`/supervisor/clientes/${r.store_id}`} style={{ textDecoration: "none" }}>
          <div className="contactos-table-row" style={{
            gridTemplateColumns: "2fr 1fr 0.6fr 1fr auto",
            borderTop: idx === 0 ? "none" : "1px solid var(--border)",
            opacity: r.active ? 1 : 0.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: r.active ? "var(--success)" : "var(--text-muted)" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {r.business_channel ? (CHANNEL_LABELS[r.business_channel] ?? r.business_channel) : "—"}
            </div>
            <div>
              {r.classification ? (
                <span className="badge" style={{ background: "transparent", border: `1px solid ${CLASS_COLORS[r.classification]}`, color: CLASS_COLORS[r.classification] }}>{r.classification}</span>
              ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {r.pending_tasks > 0 && <AlertTriangle size={12} color="var(--warning)" />}
              <span style={{ fontSize: "12px", color: r.pending_tasks > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                {r.pending_tasks > 0 ? `${r.pending_tasks} pendiente${r.pending_tasks === 1 ? "" : "s"}` : "Sin pendientes"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingLeft: "8px" }}>
              <ChevronRight size={15} color="var(--text-muted)" />
            </div>
          </div>
        </Link>
        ))}
      </div>
    </div>
  );
}
