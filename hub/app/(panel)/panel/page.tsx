"use client";

import { useState, useMemo } from "react";
import { BarChart3, AlertTriangle, ClipboardList, Target } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { useAuth } from "@/app/lib/auth-context";
import {
  fetchResumen, fetchCumplimiento, fetchVisitasPorCliente, fetchAnomalias,
  fetchTiendasSinVisita, fetchTiendasCriticas, fetchBacklogTareas,
  fetchCumpleanos, fetchClientesSinVendedor, fetchTiempoResolucion,
} from "@/app/lib/queries/dashboard";
import TimePeriodSelector from "@/app/components/dashboard/TimePeriodSelector";
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
function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PanelPage() {
  const [days, setDays] = useState(7);
  const { profile } = useAuth();
  const esAdmin = profile?.role === "admin";

  // Rango inclusivo de `days` dias hacia atras contando hoy: desde = hoy - days,
  // hasta = hoy. Aritmetica de calendario local (setDate), no milisegundos.
  const [desde, hasta] = useMemo(() => {
    const hoy = new Date();
    const ini = new Date(hoy);
    ini.setDate(ini.getDate() - days);
    return [isoLocal(ini), isoLocal(hoy)];
  }, [days]);

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

      <TimePeriodSelector value={days} onChange={setDays} />

      {esAdmin && <ClientesSinVendedor rows={huerfanos ?? []} />}

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiCard
          kpi="cumplimiento"
          valor={`${r?.pct_cumplimiento ?? 0}%`}
          detalle={r ? `${r.hechas}/${r.planificadas}` : undefined}
          icono={<Target size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
        />
        <KpiCard
          kpi="visitas"
          valor={String(r?.visitas ?? 0)}
          icono={<BarChart3 size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
        />
        <KpiCard
          kpi="anomalias"
          valor={`${r?.tasa_anomalias ?? 0}%`}
          detalle={r ? `${r.anomalias} de ${r.visitas}` : undefined}
          tono={(r?.tasa_anomalias ?? 0) > 0 ? "peligro" : "normal"}
          icono={<AlertTriangle size={16} style={{ color: "var(--danger)", marginBottom: 6 }} />}
        />
        <KpiCard
          kpi="tareas"
          valor={String(r?.tareas_abiertas ?? 0)}
          detalle={r && r.tareas_viejas > 0 ? `${r.tareas_viejas} con +15 días` : undefined}
          tono={(r?.tareas_viejas ?? 0) > 0 ? "peligro" : "normal"}
          icono={<ClipboardList size={16} style={{ color: "var(--accent)", marginBottom: 6 }} />}
        />
      </div>

      <CumplimientoChart rows={cumpl ?? []} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <VisitasPorCliente rows={porCliente ?? []} />
        <AnomaliasPorTipo rows={anomalias ?? []} />
      </div>

      <TiendasCriticas rows={criticas ?? []} />

      <TiendasSinVisita rows={sinVisita ?? []} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Cumpleanos rows={cumples ?? []} />
        <TasksProgress rows={backlog ?? []} resolucion={resolucion} />
      </div>
    </>
  );
}
