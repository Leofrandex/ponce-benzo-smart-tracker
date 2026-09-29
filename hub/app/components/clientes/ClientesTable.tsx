"use client";

import Link from "next/link";
import { Building2, ChevronRight, AlertTriangle } from "lucide-react";
import type { ClientRow } from "@/app/lib/queries/derive";
import { fechaCaracas } from "@/app/lib/queries/taskFilters";
import { SkeletonTable } from "@/app/components/ui/Skeleton";

export const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};
const CLASS_COLORS: Record<string, string> = {
  A: "var(--success)", B: "var(--warning)", C: "var(--text-muted)",
};
// Mismos colores y textos que ActivityFeed para el estado de una visita.
const VISIT_STATUS: Record<NonNullable<ClientRow["last_visit_status"]>, { label: string; color: string }> = {
  completed: { label: "Completado", color: "var(--success)" },
  skipped: { label: "Omitido", color: "var(--warning)" },
  anomaly: { label: "Anomalía", color: "var(--danger)" },
};

const COLUMNS = "2fr 1fr 0.6fr 1fr 1fr auto";

export function ClientesTable({ rows, loading = false }: { rows: ClientRow[]; loading?: boolean }) {
  if (loading) {
    return <div role="status" aria-live="polite"><span className="sr-only">Cargando tiendas…</span><SkeletonTable rows={9} cols={5} /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <Building2 size={44} style={{ opacity: 0.2 }} />
        <div className="empty-title">Sin tiendas</div>
        <div className="empty-desc">Ninguna tienda coincide con los filtros.</div>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
      <div className="contactos-table-header" style={{
        gridTemplateColumns: COLUMNS,
        position: "sticky", top: 0, zIndex: 1, background: "var(--bg-base)",
      }}>
        <div>Nombre</div><div>Canal</div><div>Clase</div><div>Tareas</div>
        <div style={{ textAlign: "right" }}>Última visita</div><div></div>
      </div>
      {rows.map((r, idx) => {
        const visita = r.last_visit_status ? VISIT_STATUS[r.last_visit_status] : null;
        return (
          <Link key={r.store_id} href={`/panel/tiendas/${r.store_id}`} style={{ textDecoration: "none" }}>
            <div className="contactos-table-row clientes-flat-row" style={{
              gridTemplateColumns: COLUMNS,
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
              opacity: r.active ? 1 : 0.6,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: r.active ? "var(--success)" : "var(--text-muted)" }} />
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</span>
                </div>
                {/* Solo en teléfono: el header está oculto, así que la fecha lleva su etiqueta. */}
                <div className="contactos-mobile-sub" style={{ paddingLeft: "15px" }}>
                  {[
                    r.business_channel ? (CHANNEL_LABELS[r.business_channel] ?? r.business_channel) : null,
                    r.classification ? `Clase ${r.classification}` : null,
                    r.last_visit_date ? `Visita ${fechaCaracas(r.last_visit_date)}` : "Sin visitas",
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="contactos-cell-desktop" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {r.business_channel ? (CHANNEL_LABELS[r.business_channel] ?? r.business_channel) : <span style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
              <div className="contactos-cell-desktop">
                {r.classification ? (
                  <span className="badge" style={{ background: "transparent", border: `1px solid ${CLASS_COLORS[r.classification]}`, color: CLASS_COLORS[r.classification] }}>{r.classification}</span>
                ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                {r.pending_tasks > 0 && <AlertTriangle size={12} color="var(--warning)" />}
                <span style={{ fontSize: "var(--text-xs)", color: r.pending_tasks > 0 ? "var(--warning)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {r.pending_tasks > 0 ? `${r.pending_tasks} pendiente${r.pending_tasks === 1 ? "" : "s"}` : "Sin pendientes"}
                </span>
              </div>
              <div className="contactos-cell-desktop" style={{ justifyContent: "flex-end", gap: "6px", fontSize: "var(--text-xs)", fontVariantNumeric: "tabular-nums" }}>
                {r.last_visit_date && visita ? (
                  <>
                    <span role="img" aria-label={visita.label} title={visita.label}
                      style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: visita.color }} />
                    <span style={{ color: "var(--text-secondary)" }}>{fechaCaracas(r.last_visit_date)}</span>
                  </>
                ) : <span style={{ color: "var(--text-muted)" }}>Sin visitas</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingLeft: "8px", alignSelf: "center" }}>
                <ChevronRight size={15} color="var(--text-muted)" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
