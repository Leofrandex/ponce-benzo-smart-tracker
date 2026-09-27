"use client";

import { useState } from "react";
import type { TaskSummary } from "@/app/lib/queries/taskSummary";
import { AGE_BUCKETS, AGE_BUCKET_LABEL, type TaskFilterValue } from "@/app/lib/queries/taskFilters";

type Pick = (patch: Partial<TaskFilterValue>) => void;

const NUM: React.CSSProperties = { fontVariantNumeric: "tabular-nums", textAlign: "right" };
const CELL_BTN: React.CSSProperties = {
  all: "unset", cursor: "pointer", display: "block", width: "100%", textAlign: "right",
  fontVariantNumeric: "tabular-nums", padding: "6px 8px", borderRadius: "var(--radius-sm)",
};

function Num({ n, onClick, label }: { n: number; onClick: () => void; label: string }) {
  if (n === 0) return <span style={{ ...NUM, display: "block", padding: "6px 8px", color: "var(--text-muted)" }}>—</span>;
  return <button type="button" style={CELL_BTN} className="summary-cell" onClick={onClick} aria-label={label}>{n}</button>;
}

// Resumen de Tareas. Métrica primaria: total de abiertas (con su reparto por
// antigüedad). Todo número filtra la lista al tocarlo.
export function TaskSummaryPanel({ summary, onPick }: { summary: TaskSummary; onPick: Pick }) {
  const [modo, setModo] = useState<"productos" | "lineas">("productos");
  const ranking = modo === "productos" ? summary.topProductos : summary.topLineas;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2.2fr)", gap: "12px" }} className="task-summary">
      {/* Primaria */}
      <div className="card" style={{ padding: "18px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Tareas abiertas</div>
        <button type="button" style={{ all: "unset", cursor: "pointer", fontSize: "40px", fontWeight: 800, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: "4px" }}
          onClick={() => onPick({ status: "open", antiguedad: [] })} aria-label="Ver todas las abiertas">
          {summary.abiertas}
        </button>
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column" }}>
          {AGE_BUCKETS.map((b) => (
            <div key={b} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{AGE_BUCKET_LABEL[b]}</span>
              <span style={{ minWidth: "48px" }}>
                <Num n={summary.porAntiguedad[b]} label={`Abiertas ${AGE_BUCKET_LABEL[b]}`}
                  onClick={() => onPick({ status: "open", antiguedad: [b] })} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        {/* Por vendedor */}
        <div className="card" style={{ padding: "12px 14px", overflowX: "auto" }}>
          <div className="section-title" style={{ marginBottom: "6px" }}>Por vendedor</div>
          {summary.porVendedor.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 0" }}>Sin tareas con estos filtros.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Vendedor</th>
                  <th style={{ ...NUM, padding: "6px 8px", fontWeight: 600 }}>Abiertas</th>
                  {AGE_BUCKETS.map((b) => <th key={b} style={{ ...NUM, padding: "6px 8px", fontWeight: 600 }}>{b === "30+" ? "+30 d" : `${b} d`}</th>)}
                  <th style={{ ...NUM, padding: "6px 8px", fontWeight: 600 }}>Completadas</th>
                </tr>
              </thead>
              <tbody>
                {summary.porVendedor.map((r) => (
                  <tr key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "var(--text-primary)", fontWeight: 600 }}>{r.nombre}</td>
                    <td><Num n={r.abiertas} label={`Abiertas de ${r.nombre}`} onClick={() => onPick({ vendedor: r.key, status: "open", antiguedad: [] })} /></td>
                    {AGE_BUCKETS.map((b) => (
                      <td key={b}><Num n={r.porAntiguedad[b]} label={`Abiertas ${AGE_BUCKET_LABEL[b]} de ${r.nombre}`}
                        onClick={() => onPick({ vendedor: r.key, status: "open", antiguedad: [b] })} /></td>
                    ))}
                    <td><Num n={r.completadas} label={`Completadas de ${r.nombre}`} onClick={() => onPick({ vendedor: r.key, status: "resolved", antiguedad: [] })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quiebres */}
        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div className="section-title">Más quiebres de stock</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" className={`filter-chip ${modo === "productos" ? "active" : ""}`} onClick={() => setModo("productos")}>Productos</button>
              <button type="button" className={`filter-chip ${modo === "lineas" ? "active" : ""}`} onClick={() => setModo("lineas")}>Líneas</button>
            </div>
          </div>
          {ranking.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 0" }}>
              Ninguna tarea de sin stock con productos marcados en estos filtros.
            </div>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {ranking.map((r) => (
                <li key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
                  <button type="button" className="summary-cell"
                    style={{ all: "unset", cursor: "pointer", display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 8px", fontSize: "13px", boxSizing: "border-box" }}
                    onClick={() => onPick(modo === "productos" ? { producto: r.key, anomalia: "sin_stock" } : { linea: r.key, anomalia: "sin_stock" })}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                    <span style={NUM}>{r.n}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <style>{`
        .summary-cell:hover, .summary-cell:focus-visible { background: var(--bg-elevated); outline: none; }
        @media (max-width: 720px) { .task-summary { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
