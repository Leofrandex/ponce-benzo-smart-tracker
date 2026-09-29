"use client";

import Link from "next/link";
import "./dashboard.css";
import { AlertTriangle } from "lucide-react";
import type { TiendaSinVisitaRow } from "@/app/lib/queries/dashboard";
import { linkTienda } from "@/app/lib/queries/dashboardLinks";
import SectionError from "@/app/components/ui/SectionError";

// rows === null: todavía cargando (o falló). Nunca se confunde con "ninguna tienda".
interface Props { rows: TiendaSinVisitaRow[] | null; error?: string | null; onRetry?: () => void; dias: number }

export default function TiendasSinVisita({ rows, error, onRetry, dias }: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={15} style={{ color: "var(--danger)" }} />
        Tiendas sin visita hace +{dias} días
      </h2>
      {error ? (
        <SectionError what="las tiendas sin visita" detail={error} onRetry={onRetry} compact />
      ) : !rows ? (
        <p className="text-muted text-sm">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">Ninguna tienda lleva demasiado tiempo sin visita. </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {rows.slice(0, 12).map((r) => (
            <li key={r.store_id} style={{ display: "flex", justifyContent: "space-between",
                                          gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href={linkTienda(r.store_id)} className="dash-link" style={{ fontSize: 13 }}>
                {r.tienda}
                <span className="text-muted" style={{ fontSize: 11 }}>
                  {" · "}{r.cliente}{r.clasificacion ? ` · ${r.clasificacion}` : ""}
                </span>
              </Link>
              <span className="dash-num" style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
                {r.dias_sin_visita === null ? "nunca" : `${r.dias_sin_visita} d`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!error && rows && rows.length > 12 && (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
          y {rows.length - 12} más
        </p>
      )}
    </div>
  );
}
