"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchProposals } from "@/app/lib/queries/storeProposals";
import { notifyProposalsChanged, type ProposalStatus } from "@/app/lib/storeProposals";
import ProposalReview from "@/app/components/sucursales-nuevas/ProposalReview";
import SectionError from "@/app/components/ui/SectionError";
import { ConfigTableSkeleton } from "@/app/components/ui/Skeleton";

const ProposalMap = dynamic(() => import("@/app/components/sucursales-nuevas/ProposalMap"), { ssr: false, loading: () => <div className="skeleton" style={{ height: 280 }} /> });

const ESTADOS: Array<[ProposalStatus, string]> = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"]];

export default function SucursalesNuevasPage() {
  const [status, setStatus] = useState<ProposalStatus>("pendiente");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "aprobada"; storeId: string | null } | { kind: "rechazada" } | null>(null);
  const q = useSupabaseQuery(() => fetchProposals(status), [status], "prop:list");
  const rows = q.data ?? [];
  const sel = rows.find((r) => r.proposal_id === selected) ?? null;

  if (q.error) return <SectionError what="las sucursales nuevas" detail={q.error} onRetry={q.refetch} />;
  if (!q.data) return <ConfigTableSkeleton />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {ESTADOS.map(([s, label]) => (
          <button key={s} className={`filter-chip${status === s ? " active" : ""}`} aria-pressed={status === s}
            onClick={() => { setStatus(s); setSelected(null); setNotice(null); }}>{label}</button>
        ))}
      </div>

      {notice && (
        <p role="status" className="text-sm" style={{ color: "var(--success, #16a34a)" }}>
          {notice.kind === "aprobada" ? "Sucursal creada." : "Propuesta rechazada."}{" "}
          {notice.kind === "aprobada" && notice.storeId && <Link href={`/panel/tiendas/${notice.storeId}`}>Ver sucursal</Link>}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-muted text-sm">
          {status === "pendiente" ? "No hay sucursales nuevas por revisar. Aparecen aquí cuando un mercaderista registra una desde la app." : "No hay propuestas en este estado."}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 280 }}>
              <ProposalMap selectedId={selected} onSelect={setSelected}
                points={rows.map((r) => ({ id: r.proposal_id, lat: r.lat, lng: r.lng, label: r.name, kind: "propuesta" as const }))} />
            </div>
            <table className="cfg-table">
              <thead><tr><th>Sucursal</th><th>Registró</th><th>Fecha</th><th>Precisión</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.proposal_id} onClick={() => { setSelected(r.proposal_id); setNotice(null); }} style={{ cursor: "pointer", background: r.proposal_id === selected ? "var(--bg-elevated)" : undefined }}>
                    <td><strong>{r.name}</strong>{r.client_name && <div className="text-muted text-xs">{r.client_name}</div>}
                      {r.reject_reason && <div className="text-muted text-xs">{r.reject_reason}</div>}</td>
                    <td>{r.author_name}</td>
                    <td>{new Date(r.captured_at).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}</td>
                    <td>{r.accuracy_m != null ? `±${Math.round(r.accuracy_m)} m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && status === "pendiente" && (
            <ProposalReview key={sel.proposal_id} proposal={sel} onDone={(r) => { setNotice(r); setSelected(null); q.refetch(); notifyProposalsChanged(); }} />
          )}
        </div>
      )}
    </div>
  );
}
