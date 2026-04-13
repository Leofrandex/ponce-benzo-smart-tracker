"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { mockReports, mockTasks } from "@/app/lib/mock-data";
import TimePeriodSelector from "@/app/components/dashboard/TimePeriodSelector";
import AnomaliesByClientChart from "@/app/components/dashboard/AnomaliesByClientChart";
import StoresPerMerchandiserChart from "@/app/components/dashboard/StoresPerMerchandiserChart";
import TasksProgress from "@/app/components/dashboard/TasksProgress";

export default function SupervisorPage() {
  const [days, setDays] = useState(7);

  const cutoff = useMemo(() => Date.now() - days * 24 * 60 * 60 * 1000, [days]);

  const filteredReports = useMemo(
    () => mockReports.filter((r) => new Date(r.check_in_time).getTime() >= cutoff),
    [cutoff]
  );

  const filteredTasks = useMemo(
    () => mockTasks.filter((t) => new Date(t.created_at).getTime() >= cutoff),
    [cutoff]
  );

  const totalVisits = filteredReports.length;
  const totalAnomalies = filteredReports.filter((r) => r.status === "anomaly").length;
  const resolvedTasks = filteredTasks.filter((t) => t.status === "resolved").length;

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
      <div className="stats-row">
        <div className="stat-card">
          <BarChart3 size={16} style={{ color: "var(--accent)", marginBottom: "6px" }} />
          <div className="stat-value">{totalVisits}</div>
          <div className="stat-label">Visitas</div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={16} style={{ color: "var(--danger)", marginBottom: "6px" }} />
          <div className="stat-value" style={{ color: totalAnomalies > 0 ? "var(--danger)" : undefined }}>
            {totalAnomalies}
          </div>
          <div className="stat-label">Anomalías</div>
        </div>
        <div className="stat-card">
          <CheckCircle2 size={16} style={{ color: "var(--success)", marginBottom: "6px" }} />
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {resolvedTasks}
          </div>
          <div className="stat-label">Resueltas</div>
        </div>
      </div>

      {/* Charts */}
      <AnomaliesByClientChart reports={filteredReports} />
      <StoresPerMerchandiserChart reports={filteredReports} />
      <TasksProgress tasks={filteredTasks} />
    </>
  );
}
