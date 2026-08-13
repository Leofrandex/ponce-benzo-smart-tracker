"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { TiendaSinVisitaRow } from "@/app/lib/queries/dashboard";

interface Props { rows: TiendaSinVisitaRow[]; dias: number }

export default function TiendasSinVisita({ rows, dias }: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={15} style={{ color: "var(--danger)" }} />
        Tiendas sin visita hace +{dias} días
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted text-sm">Ninguna tienda lleva demasiado tiempo sin visita. </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {rows.slice(0, 12).map((r) => (
            <li key={r.store_id} style={{ display: "flex", justifyContent: "space-between",
                                          gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href={`/panel/tiendas/${r.store_id}`} style={{ fontSize: 13, textDecoration: "none" }}>
                {r.tienda}
                <span className="text-muted" style={{ fontSize: 11 }}>
                  {" · "}{r.cliente}{r.clasificacion ? ` · ${r.clasificacion}` : ""}
                </span>
              </Link>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", whiteSpace: "nowrap" }}>
                {r.dias_sin_visita === null ? "nunca" : `${r.dias_sin_visita} d`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 12 && (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
          y {rows.length - 12} más
        </p>
      )}
    </div>
  );
}
