"use client";

import { SupervisorTask } from "@/app/lib/mock-data";

interface Props {
  tasks: SupervisorTask[];
}

const SUCCESS = "#16a34a";
const ACCENT = "#00205C";
const MUTED = "#8C9091";

export default function TasksProgress({ tasks }: Props) {
  const total = tasks.length;
  const resolved = tasks.filter((t) => t.status === "resolved").length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Per-merchandiser breakdown
  const byMerc: Record<string, { total: number; resolved: number }> = {};
  for (const t of tasks) {
    if (!byMerc[t.merchandiser_name]) byMerc[t.merchandiser_name] = { total: 0, resolved: 0 };
    byMerc[t.merchandiser_name].total++;
    if (t.status === "resolved") byMerc[t.merchandiser_name].resolved++;
  }

  const rows = Object.entries(byMerc).sort(
    (a, b) => b[1].resolved / b[1].total - a[1].resolved / a[1].total
  );

  return (
    <div className="chart-card">
      <div className="chart-title">Tareas asignadas vs resueltas</div>
      <div className="chart-subtitle">{resolved} de {total} tarea{total !== 1 ? "s" : ""} resueltas</div>

      {/* Main progress bar */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "12px", color: MUTED }}>Progreso global</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: pct === 100 ? SUCCESS : ACCENT }}>
            {pct}%
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${pct}%`, background: pct === 100 ? SUCCESS : ACCENT }}
          />
        </div>
      </div>

      {/* Per-merchandiser rows */}
      {rows.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", color: MUTED, fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Por mercaderista
          </div>
          {rows.map(([name, { total: t, resolved: r }]) => {
            const rowPct = t > 0 ? Math.round((r / t) * 100) : 0;
            return (
              <div key={name} className="progress-row">
                <span className="progress-row-name">{name.split(" ")[0]}</span>
                <div className="progress-row-track">
                  <div
                    className="progress-row-fill"
                    style={{
                      width: `${rowPct}%`,
                      background: rowPct === 100 ? SUCCESS : ACCENT,
                    }}
                  />
                </div>
                <span className="progress-row-count">{r}/{t}</span>
              </div>
            );
          })}
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: "center", color: MUTED, fontSize: "13px", padding: "16px 0" }}>
          Sin tareas en este período
        </div>
      )}
    </div>
  );
}
