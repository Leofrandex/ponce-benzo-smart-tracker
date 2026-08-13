"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, BarChart3, Store } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchDashboardVisits, fetchDashboardTasks, fetchActiveStoreCount } from "@/app/lib/queries/dashboard";
import { deriveDashboard, visitsInRange, tasksInRange } from "@/app/lib/queries/derive";
import TimePeriodSelector from "@/app/components/dashboard/TimePeriodSelector";
import AnomaliesByClientChart from "@/app/components/dashboard/AnomaliesByClientChart";
import StoresPerMerchandiserChart from "@/app/components/dashboard/StoresPerMerchandiserChart";
import TasksProgress from "@/app/components/dashboard/TasksProgress";

export default function SupervisorPage() {
  const [days, setDays] = useState(7);

  const { data: visits } = useSupabaseQuery(fetchDashboardVisits, []);
  const { data: tasks } = useSupabaseQuery(fetchDashboardTasks, []);
  const { data: storeCount } = useSupabaseQuery(fetchActiveStoreCount, []);
  const cutoff = useMemo(() => Date.now() - days * 24 * 60 * 60 * 1000, [days]);
  const stats = useMemo(
    () => deriveDashboard(visits ?? [], tasks ?? [], cutoff, storeCount ?? 0),
    [visits, tasks, cutoff, storeCount],
  );
  const periodVisits = useMemo(() => visitsInRange(visits ?? [], cutoff), [visits, cutoff]);
  const periodTasks = useMemo(() => tasksInRange(tasks ?? [], cutoff), [tasks, cutoff]);

  return (
    <>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Panel Supervisor
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Estadísticas del equipo de campo
        </p>
      </div>

      {/* Time period filter */}
      <TimePeriodSelector value={days} onChange={setDays} />

      {/* Summary stats */}
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card">
          <BarChart3 size={16} style={{ color: "var(--accent)", marginBottom: "6px" }} />
          <div className="stat-value">{stats.totalVisits}</div>
          <div className="stat-label">Visitas</div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={16} style={{ color: "var(--danger)", marginBottom: "6px" }} />
          <div className="stat-value" style={{ color: stats.totalAnomalies > 0 ? "var(--danger)" : undefined }}>
            {stats.totalAnomalies}
          </div>
          <div className="stat-label">Anomalías</div>
        </div>
        <div className="stat-card">
          <CheckCircle2 size={16} style={{ color: "var(--success)", marginBottom: "6px" }} />
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {stats.resolvedTasks}
          </div>
          <div className="stat-label">Resueltas</div>
        </div>
        <div className="stat-card">
          <Store size={16} style={{ color: "var(--accent)", marginBottom: "6px" }} />
          <div className="stat-value">{stats.visitedStores.count}</div>
          <div className="stat-label">
            Establecimientos · de {stats.visitedStores.total} ({stats.visitedStores.pct}%)
          </div>
        </div>
      </div>

      <AnomaliesByClientChart visits={periodVisits} />
      <StoresPerMerchandiserChart visits={periodVisits} />
      <TasksProgress tasks={periodTasks} />
    </>
  );
}
