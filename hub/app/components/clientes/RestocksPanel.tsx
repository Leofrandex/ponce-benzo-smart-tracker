"use client";

import { Package, Plus, Trash2 } from "lucide-react";
import { ORIGEN_LABEL, type RestockRow } from "@/app/lib/queries/restocks";

const COLUMNS = "1fr 2fr 0.8fr 1fr auto";

export function RestocksPanel({ rows, loading, canRegister, currentUserId, isAdmin, onRegister, onDelete }: {
  rows: RestockRow[]; loading: boolean; canRegister: boolean;
  currentUserId: string | null; isAdmin: boolean;
  onRegister: () => void; onDelete: (r: RestockRow) => void;
}) {
  const puedeBorrar = (r: RestockRow) => r.source === "panel" && (isAdmin || r.created_by === currentUserId);

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      {canRegister && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button type="button" onClick={onRegister} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Plus size={12} /> Registrar reposición
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="empty-desc">Cargando reposiciones…</div></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Package size={44} style={{ opacity: 0.2 }} />
          <div className="empty-title">Sin reposiciones</div>
          <div className="empty-desc">Aún no hay reposiciones registradas para esta tienda.</div>
        </div>
      ) : (
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <div className="contactos-table-header" style={{ gridTemplateColumns: COLUMNS, position: "sticky", top: 0, zIndex: 1, background: "var(--bg-base)" }}>
            <div>Fecha</div><div>Productos</div><div>Origen</div><div>Registró</div><div></div>
          </div>
          {rows.map((r, idx) => {
            const fecha = new Date(r.restock_date + "T00:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={r.restock_id} className="contactos-table-row" style={{ gridTemplateColumns: COLUMNS, borderTop: idx === 0 ? "none" : "1px solid var(--border)" }}>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fecha}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", color: r.productos.length ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {r.productos.length ? r.productos.map((p) => p.name).join(", ") : "Sin productos"}
                  </div>
                  {r.note && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{r.note}</div>}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{ORIGEN_LABEL[r.source]}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{r.autor ?? "—"}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {puedeBorrar(r) && (
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      aria-label={`Eliminar reposición del ${fecha}`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
