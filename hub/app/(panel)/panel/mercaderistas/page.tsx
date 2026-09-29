"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCumplimiento } from "@/app/lib/queries/dashboard";
import { fetchMerchandisers } from "@/app/lib/queries/sessions";
import { fetchResumenesDetalle } from "@/app/lib/queries/merchandisers";
import { estadoVersion, fetchVersiones } from "@/app/lib/queries/appVersion";
import { parsePeriodo, serializePeriodo } from "@/app/lib/queries/period";
import TimePeriodSelector, { rangoDeDias } from "@/app/components/dashboard/TimePeriodSelector";
import { MercaderistasSkeleton, SkeletonTable } from "@/app/components/ui/Skeleton";

// Mismas bandas que CumplimientoChart del dashboard: el color marca solo la excepción.
const tono = (pct: number) => (pct < 70 ? "var(--danger)" : pct < 90 ? "var(--warning)" : undefined);

function MercaderistasInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { desde, hasta } = parsePeriodo(new URLSearchParams(sp.toString()), rangoDeDias(7));
  const setPeriodo = (d: string, h: string) => router.replace(`${pathname}?${serializePeriodo(d, h)}`, { scroll: false });

  const { data: cumpl, loading, error } = useSupabaseQuery(() => fetchCumplimiento(desde, hasta), [desde, hasta], "cumplimiento");
  const { data: roster } = useSupabaseQuery(fetchMerchandisers, [], "merch:roster");

  // ids de todo el roster + quien aparezca en el cumplimiento (p. ej. supervisores).
  const ids = useMemo(() => {
    const set = new Set([...(roster ?? []).map((r) => r.user_id), ...(cumpl ?? []).map((c) => c.user_id)]);
    return Array.from(set).sort();
  }, [roster, cumpl]);
  const idsKey = ids.join(",");

  const { data: anom } = useSupabaseQuery(() => fetchResumenesDetalle(ids, desde, hasta), [idsKey, desde, hasta], "merch:resumenes");
  const { data: versiones } = useSupabaseQuery(fetchVersiones, [], "app:versiones");

  // Todos los del roster, aunque no tengan rutas en el periodo; luego quien
  // aparezca en el cumplimiento sin estar en el roster (p. ej. supervisores).
  const filas = useMemo(() => {
    const byId = new Map((cumpl ?? []).map((c) => [c.user_id, c]));
    return ids.map((id) => {
      const c = byId.get(id);
      const nombre = c?.full_name ?? roster?.find((r) => r.user_id === id)?.full_name ?? "—";
      return { id, nombre, c, anomalias: anom?.get(id)?.anomalias ?? 0 };
    }).sort((a, b) => (a.c?.pct ?? 101) - (b.c?.pct ?? 101) || a.nombre.localeCompare(b.nombre, "es"));
  }, [cumpl, roster, ids, anom]);

  const qs = serializePeriodo(desde, hasta);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "var(--tracking-tight)" }}>Mercaderistas</h1>
          <p className="text-muted text-sm" style={{ marginTop: "4px" }}>Cumplimiento de ruta en el periodo. Hoy no cuenta hasta que termina el día.</p>
        </div>
        <TimePeriodSelector desde={desde} hasta={hasta} onChange={setPeriodo} />
      </div>

      {error && <div className="empty-state"><div className="empty-title">Error al cargar</div><div className="empty-desc">{error}</div></div>}
      {loading && !cumpl && <div role="status" aria-live="polite"><span className="sr-only">Cargando…</span><SkeletonTable rows={8} cols={5} /></div>}

      {cumpl && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <style>{`
            .mz-table tbody tr:hover { background: var(--bg-base); }
            .mz-table .mz-num { width: 1%; white-space: nowrap; padding-left: 32px !important; }
          `}</style>
          <table className="mz-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Mercaderista</th>
                <th className="mz-num" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Cumplimiento</th>
                <th className="mz-num" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Hechas / planificadas</th>
                <th className="mz-num" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Anomalías</th>
                <th className="mz-num" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>App</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <Link href={`/panel/mercaderistas/${f.id}?${qs}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{f.nombre}</Link>
                  </td>
                  <td className="mz-num" style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: f.c ? tono(f.c.pct) : undefined }}>
                    {f.c ? `${f.c.pct}%` : <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>Sin rutas</span>}
                  </td>
                  <td className="mz-num" style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.c ? `${f.c.hechas} / ${f.c.planificadas}` : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                  {/* Cero es cero; el guion queda solo mientras el dato no ha llegado. */}
                  <td className="mz-num" style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{anom ? f.anomalias : <span style={{ color: "var(--text-muted)" }}>–</span>}</td>
                  <td className="mz-num" style={{ padding: "10px 14px", textAlign: "right" }}>
                    {versiones ? (() => {
                      const { texto, desactualizada } = estadoVersion(versiones.get(f.id));
                      return (
                        <span style={{ color: desactualizada ? "var(--warning)" : "var(--text-muted)", fontWeight: desactualizada ? 600 : 400 }} title={desactualizada ? "Actualizar la app en este teléfono" : undefined}>
                          {texto}
                        </span>
                      );
                    })() : <span style={{ color: "var(--text-muted)" }}>–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function MercaderistasPage() {
  return <Suspense fallback={<MercaderistasSkeleton />}><MercaderistasInner /></Suspense>;
}
