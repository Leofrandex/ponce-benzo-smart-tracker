"use client";

import Link from "next/link";
import type { TiendaCriticaRow } from "@/app/lib/queries/dashboard";

interface Props { rows: TiendaCriticaRow[] }

export default function TiendasCriticas({ rows }: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Tiendas con más anomalías</h2>
      {rows.length === 0 ? (
        <p className="text-muted text-sm">Sin anomalías reportadas en este período.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.store_id} style={{ display: "flex", justifyContent: "space-between",
                                          gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href={`/panel/tiendas/${r.store_id}`} style={{ fontSize: 13, textDecoration: "none" }}>
                {r.tienda}
                <span className="text-muted" style={{ fontSize: 11 }}>{" · "}{r.cliente}</span>
              </Link>
              <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                <strong style={{ color: "var(--danger)" }}>{r.anomalias}</strong>
                <span className="text-muted">{" / "}{r.visitas} visitas</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
