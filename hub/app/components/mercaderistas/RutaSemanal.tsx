"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchRutaSemana, lunesDe, sumarDias } from "@/app/lib/queries/rutas";
import { RESULTADO_LABEL, type Resultado } from "@/app/lib/queries/merchandisers";
import { hoyCaracas } from "@/app/lib/queries/taskFilters";
import SectionError from "@/app/components/ui/SectionError";
import { Skeleton, SkeletonCard, SkeletonList } from "@/app/components/ui/Skeleton";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Mismos colores que el día por día del perfil.
const COLOR: Record<Resultado, string> = {
  completada: "var(--success)", anomalia: "var(--danger)", cubierta: "var(--accent)",
  omitida: "var(--warning)", no_visitada: "var(--text-muted)",
};

const diaCorto = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" });
const rango = (lunes: string) => {
  const f = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  return `${f(lunes)} – ${f(sumarDias(lunes, 4))}`;
};

// La semana vive en la URL (?semana=lunes) para que el enlace se pueda compartir.
export default function RutaSemanal({ userId }: { userId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hoy = hoyCaracas();
  const param = sp.get("semana");
  const lunes = lunesDe(param && YMD.test(param) ? param : hoy);
  const esEstaSemana = lunes === lunesDe(hoy);

  const irA = (nuevo: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (nuevo) p.set("semana", nuevo); else p.delete("semana");
    p.delete("ver");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const { data: dias, error, refetch } = useSupabaseQuery(() => fetchRutaSemana(userId, lunes, hoy), [userId, lunes, hoy], "merch:ruta");

  // "Ver ruta" desde la tabla llega con ?ver=ruta: bajar a esta sección una vez cargada.
  const ref = useRef<HTMLDivElement>(null);
  const verRuta = sp.get("ver") === "ruta";
  useEffect(() => {
    if (verRuta && dias) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [verRuta, dias]);

  const fuera = (dias ?? []).reduce((n, d) => n + d.fueraDeAlcance, 0);

  return (
    <div ref={ref} className="card" style={{ padding: 0, overflow: "hidden", flexShrink: 0, scrollMarginTop: "16px" }}>
      <style>{`
        .rs-grid { display: grid; grid-template-columns: repeat(var(--rs-cols), minmax(0, 1fr)); }
        .rs-dia + .rs-dia { border-left: 1px solid var(--border); }
        .rs-parada:hover { background: var(--bg-base); }
        @media (max-width: 900px) {
          .rs-grid { grid-template-columns: 1fr; }
          .rs-dia + .rs-dia { border-left: 0; border-top: 1px solid var(--border); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "12px 14px" }}>
        <div className="section-title" style={{ margin: 0 }}>Ruta</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!esEstaSemana && <button type="button" className="filter-chip" onClick={() => irA(null)}>Esta semana</button>}
          <button type="button" className="filter-chip" aria-label="Semana anterior" onClick={() => irA(sumarDias(lunes, -7))}><ChevronLeft size={14} /></button>
          <span style={{ minWidth: "130px", textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rango(lunes)}</span>
          <button type="button" className="filter-chip" aria-label="Semana siguiente" onClick={() => irA(sumarDias(lunes, 7))}><ChevronRight size={14} /></button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: "0 14px 12px" }}><SectionError what="la ruta" detail={error} onRetry={refetch} compact /></div>
      ) : !dias ? (
        <div style={{ padding: "0 14px 14px" }}><SkeletonCard><Skeleton h={12} w={110} pill /><SkeletonList rows={5} /></SkeletonCard></div>
      ) : dias.every((d) => d.paradas.length === 0 && d.fueraDeAlcance === 0) ? (
        <div style={{ padding: "0 14px 14px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Sin ruta cargada esta semana.</div>
      ) : (
        <>
          <div className="rs-grid" style={{ ["--rs-cols" as string]: dias.length, borderTop: "1px solid var(--border)" }}>
            {dias.map((d) => (
              <div key={d.fecha} className="rs-dia" style={{ minWidth: 0, background: d.fecha === hoy ? "var(--bg-base)" : undefined }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px", padding: "10px 12px 6px" }}>
                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{diaCorto(d.fecha)}{d.fecha === hoy && <span style={{ color: "var(--accent)", fontWeight: 600 }}> · hoy</span>}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{d.paradas.length || ""}</span>
                </div>
                {d.paradas.length === 0 ? (
                  <div style={{ padding: "4px 12px 12px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sin ruta</div>
                ) : (
                  <ol style={{ listStyle: "none", margin: 0, padding: "0 0 8px" }}>
                    {d.paradas.map((p) => (
                      <li key={p.store_id + p.orden} className="rs-parada" style={{ display: "flex", gap: "8px", padding: "6px 12px", fontSize: "var(--text-sm)" }}>
                        <span style={{ width: "18px", flexShrink: 0, textAlign: "right", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{p.orden}</span>
                        <span style={{ minWidth: 0 }}>
                          <Link href={`/panel/tiendas/${p.store_id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 600, overflowWrap: "anywhere" }}>{p.name}</Link>
                          <span style={{ display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                            {p.client_name ?? ""}
                            {/* Completada es lo esperado: texto neutro; el color queda para la excepción. */}
                            {p.resultado && (
                              <span style={{ color: p.resultado === "completada" ? "var(--text-secondary)" : COLOR[p.resultado], fontWeight: 600 }}>
                                {p.client_name ? " · " : ""}{RESULTADO_LABEL[p.resultado]}
                              </span>
                            )}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
          {fuera > 0 && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {fuera === 1 ? "1 visita es" : `${fuera} visitas son`} de clientes fuera de tu cartera y no se muestran.
            </div>
          )}
        </>
      )}
    </div>
  );
}
