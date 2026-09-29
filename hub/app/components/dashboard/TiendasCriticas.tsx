"use client";

import Link from "next/link";
import "./dashboard.css";
import type { TiendaCriticaRow } from "@/app/lib/queries/dashboard";
import { linkTienda } from "@/app/lib/queries/dashboardLinks";
import SectionError from "@/app/components/ui/SectionError";
import { SkeletonList } from "@/app/components/ui/Skeleton";

// rows === null: todavía cargando (o falló). Nunca se confunde con "sin anomalías".
interface Props { rows: TiendaCriticaRow[] | null; error?: string | null; onRetry?: () => void }

export default function TiendasCriticas({ rows, error, onRetry }: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tiendas con más anomalías</h2>
      {error ? (
        <SectionError what="las tiendas con anomalías" detail={error} onRetry={onRetry} compact />
      ) : !rows ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">Sin anomalías reportadas en este período.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.store_id} style={{ display: "flex", justifyContent: "space-between",
                                          gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href={linkTienda(r.store_id)} className="dash-link" style={{ fontSize: 13 }}>
                {r.tienda}
                <span className="text-muted" style={{ fontSize: 11 }}>{" · "}{r.cliente}</span>
              </Link>
              <span className="dash-num" style={{ fontSize: 12 }}>
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
