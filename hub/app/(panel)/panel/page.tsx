"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, AlertTriangle, ClipboardList, Target } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { useAuth } from "@/app/lib/auth-context";
import {
  fetchResumen, fetchCumplimiento, fetchVisitasPorCliente, fetchAnomalias,
  fetchTiendasSinVisita, fetchTiendasCriticas, fetchBacklogTareas,
  fetchCumpleanos, fetchClientesSinVendedor, fetchTiempoResolucion,
} from "@/app/lib/queries/dashboard";
import { parsePeriodo, serializePeriodo } from "@/app/lib/queries/period";
import { linkMercaderistas, linkTareasAnomalias, linkTareasAbiertas, linkTareasViejas } from "@/app/lib/queries/dashboardLinks";
import TimePeriodSelector, { rangoDeDias } from "@/app/components/dashboard/TimePeriodSelector";
import KpiCard from "@/app/components/dashboard/KpiCard";
import CumplimientoChart from "@/app/components/dashboard/CumplimientoChart";
import AnomaliasPorTipo from "@/app/components/dashboard/AnomaliasPorTipo";
import TiendasSinVisita from "@/app/components/dashboard/TiendasSinVisita";
import TiendasCriticas from "@/app/components/dashboard/TiendasCriticas";
import Cumpleanos from "@/app/components/dashboard/Cumpleanos";
import ClientesSinVendedor from "@/app/components/dashboard/ClientesSinVendedor";
import VisitasPorCliente from "@/app/components/dashboard/VisitasPorCliente";
import TasksProgress from "@/app/components/dashboard/TasksProgress";

const DIAS_ABANDONO = 15;

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

  const { data: resumen }    = useSupabaseQuery(() => fetchResumen(desde, hasta), [desde, hasta]);
  const { data: cumpl }      = useSupabaseQuery(() => fetchCumplimiento(desde, hasta), [desde, hasta]);
  const { data: porCliente } = useSupabaseQuery(() => fetchVisitasPorCliente(desde, hasta), [desde, hasta]);
  const { data: anomalias }  = useSupabaseQuery(() => fetchAnomalias(desde, hasta), [desde, hasta]);
  const { data: sinVisita }  = useSupabaseQuery(() => fetchTiendasSinVisita(DIAS_ABANDONO), [DIAS_ABANDONO]);
  const { data: criticas }   = useSupabaseQuery(() => fetchTiendasCriticas(desde, hasta, 8), [desde, hasta]);
  const { data: backlog }    = useSupabaseQuery(() => fetchBacklogTareas(), []);
  const { data: cumples }    = useSupabaseQuery(() => fetchCumpleanos(7), []);
  const { data: huerfanos }  = useSupabaseQuery(() => fetchClientesSinVendedor(), []);
  const { data: resolucion } = useSupabaseQuery(() => fetchTiempoResolucion(desde, hasta), [desde, hasta]);

  const r = resumen;

  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Panel</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Estadísticas del equipo de campo
        </p>
      </div>

      <TimePeriodSelector
        desde={desde}
        hasta={hasta}
        onChange={setPeriodo}
      />

      {esAdmin && <ClientesSinVendedor rows={huerfanos ?? []} />}

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiCard
          kpi="cumplimiento"
          valor={`${r?.pct_cumplimiento ?? 0}%`}
          detalle={r ? `${r.hechas}/${r.planificadas}` : undefined}
          icono={<Target size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
          href={linkMercaderistas(desde, hasta)}
        />
        <KpiCard
          kpi="visitas"
          valor={String(r?.visitas ?? 0)}
          icono={<BarChart3 size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
          href={linkMercaderistas(desde, hasta)}
        />
        <KpiCard
          kpi="anomalias"
          valor={`${r?.tasa_anomalias ?? 0}%`}
          detalle={r ? `${r.anomalias} de ${r.visitas}` : undefined}
          tono={(r?.tasa_anomalias ?? 0) > 0 ? "peligro" : "normal"}
          icono={<AlertTriangle size={16} style={{ color: "var(--danger)", marginBottom: 6 }} />}
          href={linkTareasAnomalias(null, desde, hasta)}
        />
        <KpiCard
          kpi="tareas"
          valor={String(r?.tareas_abiertas ?? 0)}
          detalle={r && r.tareas_viejas > 0 ? `${r.tareas_viejas} con +15 días` : undefined}
          tono={(r?.tareas_viejas ?? 0) > 0 ? "peligro" : "normal"}
          icono={<ClipboardList size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
          // Un admin no tiene cartera propia: "Mis tareas abiertas" no aplica.
          etiqueta={esAdmin ? "Tareas abiertas" : "Mis tareas abiertas"}
          href={linkTareasAbiertas()}
          detalleHref={linkTareasViejas()}
        />
      </div>

      <CumplimientoChart rows={cumpl ?? []} desde={desde} hasta={hasta} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16, alignItems: "start" }}>
        <VisitasPorCliente rows={porCliente ?? []} />
        <AnomaliasPorTipo rows={anomalias ?? []} desde={desde} hasta={hasta} />
      </div>

      <TiendasCriticas rows={criticas ?? []} />

      <TiendasSinVisita rows={sinVisita ?? []} dias={DIAS_ABANDONO} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16, alignItems: "start" }}>
        <Cumpleanos rows={cumples ?? []} />
        <TasksProgress rows={backlog ?? []} resolucion={resolucion} />
      </div>
    </>
  );
}

export default function PanelPage() {
  return <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}><PanelInner /></Suspense>;
}
