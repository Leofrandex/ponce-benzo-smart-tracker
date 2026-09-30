"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { useAuth } from "@/app/lib/auth-context";
import {
  fetchResumen, fetchCumplimiento, fetchVisitasPorCliente, fetchAnomalias,
  fetchTiendasSinVisita, fetchTiendasCriticas, fetchBacklogTareas,
  fetchCumpleanos, fetchClientesSinVendedor, fetchTiempoResolucion, fetchVisitasConFoto, fetchVisitasConFotoDia,
} from "@/app/lib/queries/dashboard";
import { parsePeriodo, serializePeriodo } from "@/app/lib/queries/period";
import { linkMercaderistas, linkTareasAnomalias, linkTareasAbiertas, linkTareasViejas } from "@/app/lib/queries/dashboardLinks";
import TimePeriodSelector, { iso, rangoDeDias } from "@/app/components/dashboard/TimePeriodSelector";
import KpiCard from "@/app/components/dashboard/KpiCard";
import CumplimientoChart, { colorCumplimiento } from "@/app/components/dashboard/CumplimientoChart";
import AnomaliasPorTipo from "@/app/components/dashboard/AnomaliasPorTipo";
import TiendasSinVisita from "@/app/components/dashboard/TiendasSinVisita";
import TiendasCriticas from "@/app/components/dashboard/TiendasCriticas";
import VisitasConFoto from "@/app/components/dashboard/VisitasConFoto";
import Cumpleanos from "@/app/components/dashboard/Cumpleanos";
import ClientesSinVendedor from "@/app/components/dashboard/ClientesSinVendedor";
import VisitasPorCliente from "@/app/components/dashboard/VisitasPorCliente";
import TasksProgress from "@/app/components/dashboard/TasksProgress";
import SectionError from "@/app/components/ui/SectionError";
import { DashboardSkeleton } from "@/app/components/ui/Skeleton";

const DIAS_ABANDONO = 15;

// '2026-09-27' -> '27 sept' en fecha local (parsear sin hora lo leeria en UTC).
function fechaCorta(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short" });
}

// Fecha local en formato 'YYYY-MM-DD', tal como esperan las funciones SQL
// (comparan contra columnas `date`). OJO: NO usar toISOString() aqui, porque
// convierte a UTC y en zonas horarias negativas (Chile, etc.) puede recortar
// un dia entero del rango sin que nada falle (nos paso: dio 848 en vez de 872
// planificadas). Por eso se arma el string a mano con los getters locales.
function PanelInner() {
  const { profile } = useAuth();
  const esAdmin = profile?.role === "admin";

  // El periodo vive en la URL (?desde=&hasta=) para que sea compartible y
  // sobreviva a la navegacion "atras" desde un KPI clicable.
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { desde, hasta } = parsePeriodo(new URLSearchParams(sp.toString()), rangoDeDias(7));
  const setPeriodo = (d: string, h: string) => router.replace(`${pathname}?${serializePeriodo(d, h)}`, { scroll: false });

  // Cada sección lee su propio `error`: un fallo se muestra con Reintentar en
  // esa sección, nunca como "0" o "sin datos".
  const qResumen    = useSupabaseQuery(() => fetchResumen(desde, hasta), [desde, hasta], "dash:resumen");
  const qCumpl      = useSupabaseQuery(() => fetchCumplimiento(desde, hasta), [desde, hasta], "cumplimiento");
  const qPorCliente = useSupabaseQuery(() => fetchVisitasPorCliente(desde, hasta), [desde, hasta], "dash:porCliente");
  const qAnomalias  = useSupabaseQuery(() => fetchAnomalias(desde, hasta), [desde, hasta], "dash:anomalias");
  const qSinVisita  = useSupabaseQuery(() => fetchTiendasSinVisita(DIAS_ABANDONO), [DIAS_ABANDONO], "dash:sinVisita");
  const qCriticas   = useSupabaseQuery(() => fetchTiendasCriticas(desde, hasta, 8), [desde, hasta], "dash:criticas");
  const qBacklog    = useSupabaseQuery(() => fetchBacklogTareas(), [], "dash:backlog");
  const qCumples    = useSupabaseQuery(() => fetchCumpleanos(7), [], "dash:cumples");
  const qHuerfanos  = useSupabaseQuery(() => fetchClientesSinVendedor(), [], "dash:huerfanos");
  const qResolucion = useSupabaseQuery(() => fetchTiempoResolucion(desde, hasta), [desde, hasta], "dash:resolucion");
  const qFotos      = useSupabaseQuery(() => fetchVisitasConFoto(desde, hasta), [desde, hasta], "dash:fotos");
  const qFotosDia   = useSupabaseQuery(() => fetchVisitasConFotoDia(desde, hasta), [desde, hasta], "dash:fotosDia");

  // null mientras carga o si falló: los KPI muestran "—" sin color, no "0%" en rojo.
  const r = qResumen.error ? null : qResumen.data;
  const SIN_DATO = "—";
  const cargandoResumen = !qResumen.data && !qResumen.error;

  return (
    <>
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "var(--tracking-tight)" }}>Panel</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Equipo de campo · {fechaCorta(desde)} – {fechaCorta(hasta)}
        </p>
      </div>

      <TimePeriodSelector
        desde={desde}
        hasta={hasta}
        onChange={setPeriodo}
      />

      {esAdmin && <ClientesSinVendedor rows={qHuerfanos.data} error={qHuerfanos.error} onRetry={qHuerfanos.refetch} />}

      <div className="kpi-grid">
        <KpiCard
          kpi="cumplimiento"
          primaria
          cargando={cargandoResumen}
          valor={r ? `${r.pct_cumplimiento}%` : SIN_DATO}
          detalle={r ? `${r.hechas} de ${r.planificadas} visitas planificadas` : undefined}
          href={linkMercaderistas(desde, hasta)}
        >
          <div className="progress-track" aria-hidden="true">
            {r && (
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, r.pct_cumplimiento)}%`,
                  background: colorCumplimiento(r.pct_cumplimiento),
                }}
              />
            )}
          </div>
        </KpiCard>
        <KpiCard
          kpi="visitas"
          cargando={cargandoResumen}
          valor={r ? String(r.visitas) : SIN_DATO}
          href={linkMercaderistas(desde, hasta)}
        />
        <KpiCard
          kpi="anomalias"
          cargando={cargandoResumen}
          valor={r ? `${r.tasa_anomalias}%` : SIN_DATO}
          detalle={r ? `${r.anomalias} de ${r.visitas} visitas` : undefined}
          tono={r && r.tasa_anomalias > 0 ? "peligro" : "normal"}
          href={linkTareasAnomalias(null, desde, hasta)}
        />
        <KpiCard
          kpi="tareas"
          cargando={cargandoResumen}
          valor={r ? String(r.tareas_abiertas) : SIN_DATO}
          detalle={r && r.tareas_viejas > 0 ? `${r.tareas_viejas} con +15 días` : undefined}
          tono={r && r.tareas_viejas > 0 ? "peligro" : "normal"}
          // Un admin no tiene cartera propia: "Mis tareas abiertas" no aplica.
          etiqueta={esAdmin ? "Tareas abiertas" : "Mis tareas abiertas"}
          href={linkTareasAbiertas()}
          detalleHref={linkTareasViejas()}
        />
      </div>
      {qResumen.error && (
        <div className="card" style={{ padding: "4px 16px" }}>
          <SectionError what="los indicadores del período" detail={qResumen.error} onRetry={qResumen.refetch} compact />
        </div>
      )}

      <CumplimientoChart rows={qCumpl.data} error={qCumpl.error} onRetry={qCumpl.refetch} desde={desde} hasta={hasta} />

      {/* stretch: las dos columnas terminan a la misma altura. Visitas por
          cadena crece con el número de cadenas; la tarjeta de fotos se estira
          (su gráfico diario absorbe el alto sobrante) para no dejar hueco. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16, alignItems: "stretch" }}>
        <VisitasPorCliente rows={qPorCliente.data} error={qPorCliente.error} onRetry={qPorCliente.refetch} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <AnomaliasPorTipo rows={qAnomalias.data} error={qAnomalias.error} onRetry={qAnomalias.refetch} desde={desde} hasta={hasta} />
          <VisitasConFoto rows={qFotos.data} error={qFotos.error} onRetry={qFotos.refetch}
                          dias={qFotosDia.data} diasError={qFotosDia.error}
                          desde={desde} hasta={hasta} hoy={iso(new Date())} />
        </div>
      </div>

      <TiendasCriticas rows={qCriticas.data} error={qCriticas.error} onRetry={qCriticas.refetch} />

      <TiendasSinVisita rows={qSinVisita.data} error={qSinVisita.error} onRetry={qSinVisita.refetch} dias={DIAS_ABANDONO} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16, alignItems: "start" }}>
        <Cumpleanos rows={qCumples.data} error={qCumples.error} onRetry={qCumples.refetch} />
        <TasksProgress
          rows={qBacklog.data} error={qBacklog.error} onRetry={qBacklog.refetch}
          resolucion={qResolucion.data} resolucionError={qResolucion.error} onRetryResolucion={qResolucion.refetch}
        />
      </div>
    </>
  );
}

export default function PanelPage() {
  return <Suspense fallback={<DashboardSkeleton />}><PanelInner /></Suspense>;
}
