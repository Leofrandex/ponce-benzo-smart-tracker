"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCumplimiento } from "@/app/lib/queries/dashboard";
import { fetchMerchandisers } from "@/app/lib/queries/sessions";
import { fetchAnomaliasPorUsuario } from "@/app/lib/queries/merchandisers";
import { parsePeriodo, serializePeriodo } from "@/app/lib/queries/period";
import TimePeriodSelector, { rangoDeDias } from "@/app/components/dashboard/TimePeriodSelector";

function MercaderistasInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { desde, hasta } = parsePeriodo(new URLSearchParams(sp.toString()), rangoDeDias(7));
  const setPeriodo = (d: string, h: string) => router.replace(`${pathname}?${serializePeriodo(d, h)}`, { scroll: false });

  const { data: cumpl, loading, error } = useSupabaseQuery(() => fetchCumplimiento(desde, hasta), [desde, hasta]);
  const { data: roster } = useSupabaseQuery(fetchMerchandisers, []);
  const { data: anom } = useSupabaseQuery(() => fetchAnomaliasPorUsuario(desde, hasta), [desde, hasta]);

  // Todos los del roster, aunque no tengan rutas en el periodo; luego quien
  // aparezca en el cumplimiento sin estar en el roster (p. ej. supervisores).
  const filas = useMemo(() => {
    const byId = new Map((cumpl ?? []).map((c) => [c.user_id, c]));
    const ids = new Set([...(roster ?? []).map((r) => r.user_id), ...Array.from(byId.keys())]);
    return Array.from(ids).map((id) => {
      const c = byId.get(id);
      const nombre = c?.full_name ?? roster?.find((r) => r.user_id === id)?.full_name ?? "—";
      return { id, nombre, c, anomalias: anom?.get(id) ?? 0 };
    }).sort((a, b) => (a.c?.pct ?? 101) - (b.c?.pct ?? 101) || a.nombre.localeCompare(b.nombre, "es"));
  }, [cumpl, roster, anom]);

  const qs = serializePeriodo(desde, hasta);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Mercaderistas</h1>
          <p className="text-muted text-sm" style={{ marginTop: "4px" }}>Cumplimiento de ruta en el periodo. Hoy no cuenta hasta que termina el día.</p>
        </div>
        <TimePeriodSelector desde={desde} hasta={hasta} onChange={setPeriodo} />
      </div>

      {error && <div className="empty-state"><div className="empty-title">Error al cargar</div><div className="empty-desc">{error}</div></div>}
      {loading && !cumpl && <div className="empty-state"><div className="empty-title">Cargando…</div></div>}

      {cumpl && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Mercaderista</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Cumplimiento</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Hechas / planificadas</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Anomalías</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <Link href={`/panel/mercaderistas/${f.id}?${qs}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{f.nombre}</Link>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {f.c ? `${f.c.pct}%` : <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>Sin rutas</span>}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.c ? `${f.c.hechas} / ${f.c.planificadas}` : "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.anomalias || "—"}</td>
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
  return <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}><MercaderistasInner /></Suspense>;
}
