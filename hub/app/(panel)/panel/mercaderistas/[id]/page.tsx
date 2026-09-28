"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import {
  fetchDetalle, fetchJornadas, fetchUserName, groupByDay, summarizeDetalle, RESULTADO_LABEL, SKIP_REASON_LABEL, type Resultado,
} from "@/app/lib/queries/merchandisers";
import { fetchUserReports } from "@/app/lib/queries/reports";
import { estadoVersion, fetchVersiones } from "@/app/lib/queries/appVersion";
import { anomalyLabel } from "@/app/lib/queries/visitDetail";
import { hoyCaracas } from "@/app/lib/queries/taskFilters";
import { parsePeriodo, serializePeriodo } from "@/app/lib/queries/period";
import { ActivityFeed } from "@/app/components/clientes/ActivityFeed";
import TimePeriodSelector, { rangoDeDias } from "@/app/components/dashboard/TimePeriodSelector";

const COLOR: Record<Resultado, string> = {
  completada: "var(--success)", anomalia: "var(--danger)", cubierta: "var(--accent)",
  omitida: "var(--warning)", no_visitada: "var(--text-muted)",
};

// Mismas bandas que CumplimientoChart del dashboard: el color marca solo la excepción.
const tono = (pct: number) => (pct < 70 ? "var(--danger)" : pct < 90 ? "var(--warning)" : undefined);
const LEYENDA: Resultado[] = ["completada", "anomalia", "cubierta", "omitida", "no_visitada"];

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : "—");
const diaLargo = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" });
const duracion = (m: number | null) => (m == null ? "Sin cerrar" : `${Math.floor(m / 60)} h ${m % 60} min`);

function PerfilInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { desde, hasta } = parsePeriodo(new URLSearchParams(sp.toString()), rangoDeDias(7));
  const setPeriodo = (d: string, h: string) => router.replace(`${pathname}?${serializePeriodo(d, h)}`, { scroll: false });

  const { data: detalle, loading, error } = useSupabaseQuery(() => fetchDetalle(id, desde, hasta), [id, desde, hasta]);
  const { data: jornadas } = useSupabaseQuery(() => fetchJornadas(id, desde, hasta), [id, desde, hasta]);
  const { data: reports } = useSupabaseQuery(() => fetchUserReports(id, desde, hasta), [id, desde, hasta]);
  const { data: userName } = useSupabaseQuery(() => fetchUserName(id), [id]);
  const { data: versiones } = useSupabaseQuery(fetchVersiones, []);
  const [abierto, setAbierto] = useState<string | null>(null);

  const resumen = useMemo(() => summarizeDetalle(detalle ?? []), [detalle]);
  const dias = useMemo(() => groupByDay(detalle ?? []), [detalle]);
  const nombre = userName ?? "Mercaderista";
  const incluyeHoy = hasta >= hoyCaracas();

  return (
    <>
      <Link href={`/panel/mercaderistas?${serializePeriodo(desde, hasta)}`} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}>
        <ArrowLeft size={15} /> Mercaderistas
      </Link>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>{nombre}</h1>
          {versiones && (() => {
            const { texto, desactualizada } = estadoVersion(versiones.get(id));
            return (
              <span className={`badge ${desactualizada ? "badge-warning" : ""}`} title={desactualizada ? "Actualizar la app en este teléfono" : undefined}>{texto}</span>
            );
          })()}
        </div>
        <TimePeriodSelector desde={desde} hasta={hasta} onChange={setPeriodo} />
      </div>

      {error && <div className="empty-state"><div className="empty-title">Error al cargar</div><div className="empty-desc">{error}</div></div>}
      {loading && !detalle && <div className="empty-state"><div className="empty-title">Cargando…</div></div>}

      {detalle && (
        <>
          <div className="card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Cumplimiento del periodo</div>
            {resumen.planificadas === 0 ? (
              <div style={{ fontSize: "15px", marginTop: "8px", color: "var(--text-secondary)" }}>Sin rutas planificadas en este periodo.</div>
            ) : (
              <>
                <div style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums", color: tono(resumen.pct) }}>{resumen.pct}%</div>
                {/* Desglose: label arriba, número debajo; secundario frente al %. */}
                <div style={{ marginTop: "10px", display: "flex", gap: "28px", flexWrap: "wrap" }}>
                  {([
                    ["Planificadas", resumen.planificadas, null],
                    ["Hechas", resumen.hechas, `${resumen.completadas} completadas · ${resumen.anomalias} con anomalía${resumen.cubiertas ? ` · ${resumen.cubiertas} cubiertas` : ""}`],
                    ["Omitidas", resumen.omitidas, null],
                    ["No visitadas", resumen.no_visitadas, null],
                  ] as const).map(([label, n, sub]) => (
                    <div key={label}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {n}{sub && <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px" }}>{sub}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {incluyeHoy && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Hoy no cuenta hasta que termina el día.</div>}
          </div>

          <style>{`
            .mz-dia:hover, .mz-dia:focus-visible, .mz-tiendas tr:hover { background: var(--bg-base); }
            .mz-dia:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
          `}</style>
          <div className="card" style={{ padding: 0, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "12px 14px 6px" }}>
              <div className="section-title" style={{ margin: 0 }}>Día por día</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "11px", color: "var(--text-muted)" }}>
                {LEYENDA.map((r) => (
                  <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: COLOR[r] }} />{RESULTADO_LABEL[r]}
                  </span>
                ))}
              </div>
            </div>
            {dias.length === 0 && <div style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "13px" }}>Sin días con ruta.</div>}
            {dias.map((d) => (
              <div key={d.fecha} style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button" className="mz-dia" aria-expanded={abierto === d.fecha} onClick={() => setAbierto(abierto === d.fecha ? null : d.fecha)}
                  style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "10px 14px", boxSizing: "border-box" }}>
                  <ChevronRight size={14} style={{ transform: abierto === d.fecha ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
                  <span style={{ width: "110px", fontWeight: 600, textTransform: "capitalize" }}>{diaLargo(d.fecha)}</span>
                  <span style={{ width: "48px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: tono(d.resumen.pct) }}>{d.resumen.pct}%</span>
                  <span style={{ display: "flex", gap: "3px", flexWrap: "wrap" }} aria-label={`${d.resumen.hechas} de ${d.resumen.planificadas} hechas`}>
                    {d.tiendas.map((t, i) => <span key={t.store_id + i} title={`${t.store_name}: ${RESULTADO_LABEL[t.resultado]}`} style={{ width: 10, height: 10, borderRadius: 2, background: COLOR[t.resultado] }} />)}
                  </span>
                </button>
                {abierto === d.fecha && (
                  <table className="mz-tiendas" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "8px" }}>
                    <tbody>
                      {d.tiendas.map((t, i) => (
                        <tr key={t.store_id + i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 14px 8px 40px" }}>
                            <Link href={`/panel/tiendas/${t.store_id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}>{t.store_name}</Link>
                            <span style={{ color: "var(--text-muted)" }}>{t.client_name ? ` · ${t.client_name}` : ""}</span>
                          </td>
                          {/* Completada es lo esperado: texto neutro; el color queda para la excepción. */}
                          <td style={{ padding: "8px 14px", color: t.resultado === "completada" ? "var(--text-secondary)" : COLOR[t.resultado], fontWeight: 600, whiteSpace: "nowrap" }}>{RESULTADO_LABEL[t.resultado]}</td>
                          <td style={{ padding: "8px 14px", color: "var(--text-secondary)" }}>
                            {(t.resultado === "omitida" && t.skip_reason ? SKIP_REASON_LABEL[t.skip_reason] ?? t.skip_reason : "")
                              || (t.resultado === "anomalia" && t.anomaly_type ? t.anomaly_type.map(anomalyLabel).join(", ") : "")
                              || <span style={{ color: "var(--text-muted)" }}>–</span>}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>{hora(t.check_in_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "12px 14px" }}>
            <div className="section-title" style={{ marginBottom: "6px" }}>Jornadas</div>
            {(jornadas ?? []).length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin jornadas en el periodo.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  {(jornadas ?? []).map((j) => (
                    <tr key={j.session_id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 0", textTransform: "capitalize", width: "120px" }}>{diaLargo(j.fecha)}</td>
                      <td style={{ padding: "8px 8px", fontVariantNumeric: "tabular-nums" }}>{hora(j.inicio)} – {j.fin ? hora(j.fin) : "…"}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: j.minutos == null ? "var(--warning)" : "var(--text-secondary)" }}>{duracion(j.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <ActivityFeed reports={reports ?? []} tasks={[]} showTasks={false} />
        </>
      )}
    </>
  );
}

export default function PerfilMercaderistaPage() {
  return <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}><PerfilInner /></Suspense>;
}
