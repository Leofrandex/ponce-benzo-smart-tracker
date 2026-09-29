"use client";

import { Package, Plus, Trash2 } from "lucide-react";
import { ORIGEN_LABEL, type RestockRow } from "@/app/lib/queries/restocks";
import { SkeletonList } from "@/app/components/ui/Skeleton";

const COLUMNS = "1fr 2fr 0.8fr 1fr 32px";
const TRUNC: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export function RestocksPanel({ rows, loading, canRegister, currentUserId, isAdmin, onRegister, onDelete }: {
  rows: RestockRow[]; loading: boolean; canRegister: boolean;
  currentUserId: string | null; isAdmin: boolean;
  onRegister: () => void; onDelete: (r: RestockRow) => void;
}) {
  const puedeBorrar = (r: RestockRow) => r.source === "panel" && (isAdmin || r.created_by === currentUserId);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {canRegister && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 8px" }}>
          <button type="button" onClick={onRegister} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Plus size={12} /> Registrar reposición
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Package size={44} style={{ opacity: 0.2 }} />
          <div className="empty-title">Sin reposiciones</div>
          <div className="empty-desc">Aún no hay reposiciones registradas para esta tienda.</div>
        </div>
      ) : (
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <div className="contactos-table-header" style={{ gridTemplateColumns: COLUMNS, position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
            <div>Fecha</div><div>Productos</div><div>Origen</div><div>Registró</div><div></div>
          </div>
          {rows.map((r, idx) => {
            const productos = r.productos.map((p) => p.name).join(", ");
            const fecha = new Date(r.restock_date + "T00:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={r.restock_id} className="contactos-table-row" style={{ gridTemplateColumns: COLUMNS, borderTop: idx === 0 ? "none" : "1px solid var(--border)", cursor: "default" }}>
                <div className="contactos-cell-desktop" style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fecha}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px", minWidth: 0 }}>
                    <div title={productos || undefined} style={{ ...TRUNC, flex: 1, fontSize: "var(--text-sm)", color: productos ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {productos || "Sin productos"}
                    </div>
                    {/* Solo en teléfono: la fecha pasa a la derecha de la primera línea. */}
                    <span className="contactos-mobile-sub" style={{ flexShrink: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fecha}</span>
                  </div>
                  <div className="contactos-mobile-sub">
                    <span style={TRUNC}>{ORIGEN_LABEL[r.source]} · {r.autor ?? "Sin autor"}</span>
                  </div>
                  {r.note && <div title={r.note} style={{ ...TRUNC, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{r.note}</div>}
                </div>
                <div className="contactos-cell-desktop" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{ORIGEN_LABEL[r.source]}</div>
                <div className="contactos-cell-desktop" style={{ fontSize: "var(--text-xs)", color: r.autor ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  <span style={TRUNC}>{r.autor ?? "—"}</span>
                </div>
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
