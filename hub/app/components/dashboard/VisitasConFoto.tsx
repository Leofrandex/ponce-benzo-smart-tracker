"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import "./dashboard.css";
import type { VisitasConFotoRow, VisitasConFotoDiaRow } from "@/app/lib/queries/dashboard";
import { linkMercaderista } from "@/app/lib/queries/dashboardLinks";
import { colorCumplimiento } from "./CumplimientoChart";
import SectionError from "@/app/components/ui/SectionError";
import { Skeleton, SkeletonList } from "@/app/components/ui/Skeleton";

interface Props {
  // null: todavía cargando (o falló). Nunca se confunde con "0 visitas".
  rows: VisitasConFotoRow[] | null;
  error?: string | null;
  onRetry?: () => void;
  desde: string;
  hasta: string;
  /** Serie diaria del mismo período; null mientras carga. */
  dias: VisitasConFotoDiaRow[] | null;
  diasError?: string | null;
  /** 'YYYY-MM-DD' local de hoy: si el período lo incluye, se avisa del sync. */
  hoy: string;
}

const pct = (con: number, total: number) => (total === 0 ? 0 : Math.round((100 * con) / total));
const MUTED = "#8C9091";
// '2026-09-27' -> '27 sept' en fecha local (sin hora se leería en UTC).
const diaCorto = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short" });

export default function VisitasConFoto({ rows, error, onRetry, dias, diasError, desde, hasta, hoy }: Props) {
  const visitas = (rows ?? []).reduce((s, r) => s + r.visitas, 0);
  const conFoto = (rows ?? []).reduce((s, r) => s + r.con_foto, 0);
  const total = pct(conFoto, visitas);

  return (
    // flex: 1 para estirarse hasta el alto de la columna vecina; el gráfico
    // diario es el que absorbe ese alto sobrante.
    <div className="chart-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="chart-title">Visitas con foto</div>
      <div className="chart-subtitle">
        {rows && !error ? (
          visitas === 0 ? "Sin visitas en el período" : `${conFoto} de ${visitas} visitas con evidencia`
        ) : !error ? <Skeleton h={9} w={140} pill /> : "—"}
      </div>

      {error ? (
        <SectionError what="las visitas con foto" detail={error} onRetry={onRetry} compact />
      ) : !rows ? (
        <SkeletonList rows={4} />
      ) : visitas === 0 ? null : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span className="dash-num" style={{ fontSize: 28, fontWeight: 600, color: colorCumplimiento(total) }}>
              {total}%
            </span>
            {visitas - conFoto > 0 && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                {visitas - conFoto} sin foto
              </span>
            )}
          </div>
          <div className="progress-track" aria-hidden="true" style={{ marginBottom: 12 }}>
            <div className="progress-fill" style={{ width: `${total}%`, background: colorCumplimiento(total) }} />
          </div>

          {/* La función ya ordena: primero quien más visitas sin foto acumula. */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {rows.map((r) => {
              const sin = r.visitas - r.con_foto;
              return (
                <li key={r.user_id} style={{ display: "flex", justifyContent: "space-between",
                                             gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <Link href={linkMercaderista(r.user_id, desde, hasta)} className="dash-link" style={{ fontSize: 13 }}>
                    {r.full_name}
                  </Link>
                  <span className="dash-num" style={{ fontSize: 12 }}>
                    {sin > 0 ? (
                      <strong style={{ color: "var(--danger)" }}>{sin} sin foto</strong>
                    ) : (
                      <span className="text-muted">Todas con foto</span>
                    )}
                    <span className="text-muted">{" · "}{pct(r.con_foto, r.visitas)}% de {r.visitas}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>% con foto por día</div>
          {diasError ? (
            <p className="text-muted" style={{ fontSize: 12 }}>No se pudo cargar la serie diaria.</p>
          ) : !dias ? (
            <Skeleton h={120} />
          ) : (
            // Absoluto dentro de un contenedor flex: el alto lo decide la
            // tarjeta, no el gráfico (evita el bucle de medida de Recharts).
            <div style={{ position: "relative", flex: 1, minHeight: 120 }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dias.map((d) => ({ ...d, pct: pct(d.con_foto, d.visitas) }))}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="dia" tickFormatter={diaCorto} interval="preserveStartEnd"
                           tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`}
                           tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)",
                                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                      labelFormatter={(d) => diaCorto(String(d))}
                      formatter={(v, _, p) => {
                        const r = p?.payload as VisitasConFotoDiaRow;
                        return [`${v}% (${r.con_foto} de ${r.visitas})`, "Con foto"];
                      }}
                    />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {dias.map((d) => <Cell key={d.dia} fill={colorCumplimiento(pct(d.con_foto, d.visitas))} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasta >= hoy && (
            <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
              Las visitas de hoy pueden estar terminando de subir sus fotos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
