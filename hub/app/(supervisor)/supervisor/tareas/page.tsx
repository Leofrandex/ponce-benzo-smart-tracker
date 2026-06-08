"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchFullTasks, type FullTaskRow } from "@/app/lib/queries/tasks";
import { resolveTask } from "@/app/lib/mutations/tasks";

type TaskStatus = "open" | "resolved";

const STATUS_BADGE: Record<TaskStatus, string> = {
  open:     "badge badge-danger",
  resolved: "badge badge-success",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open:     "Abierta",
  resolved: "Completada",
};

const STATUS_FILTERS: { key: TaskStatus | "all"; label: string }[] = [
  { key: "all",      label: "Todas"       },
  { key: "open",     label: "Abiertas"    },
  { key: "resolved", label: "Completadas" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

export default function TareasPage() {
  const { data: rawTasks, loading, error, refetch } = useSupabaseQuery(fetchFullTasks, []);
  const tasks = rawTasks ?? [];
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const open     = tasks.filter((t) => t.status === "open").length;
  const resolved = tasks.filter((t) => t.status === "resolved").length;

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const handleResolve = async (taskId: string) => {
    const { error: e } = await resolveTask(taskId);
    if (e) { alert("No se pudo completar la tarea: " + e); return; }
    refetch();
  };

  return (
    <>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Tareas
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Anomalías y acciones pendientes — Farmatodo
        </p>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>{open}</div>
          <div className="stat-label">Abiertas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{resolved}</div>
          <div className="stat-label">Completadas</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`filter-chip ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading / error states */}
      {error && (
        <div className="empty-state">
          <ClipboardList size={44} style={{ opacity: 0.2 }} />
          <div className="empty-title">Error al cargar tareas</div>
          <div className="empty-desc">{String(error)}</div>
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="empty-title">Cargando tareas…</div>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={44} style={{ opacity: 0.2 }} />
              <div className="empty-title">Sin tareas</div>
              <div className="empty-desc">No hay tareas con este filtro.</div>
            </div>
          )}

          {filtered.map((task: FullTaskRow) => {
            const iconBg    = task.status === "open" ? "var(--danger-bg)" : "var(--success-bg)";
            const iconColor = task.status === "open" ? "var(--danger)"     : "var(--success)";
            const isExpanded  = expandedId === task.task_id;

            return (
              <div
                key={task.task_id}
                className="card"
                style={{
                  padding: "16px",
                  cursor: "pointer",
                  opacity: task.status === "resolved" ? 0.65 : 1,
                  borderColor: task.status === "open" ? "var(--danger-bg)" : "var(--border)",
                }}
                onClick={() => setExpandedId(isExpanded ? null : task.task_id)}
              >
                {/* Row 1: icon + title/store */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "var(--radius-sm)",
                      background: iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ClipboardList size={16} color={iconColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {task.title ?? task.task_type}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                      {task.store_id ?? "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <ChevronRight
                      size={14}
                      color="var(--text-muted)"
                      style={{
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: time + status */}
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={11} />
                    {relativeTime(task.created_at)}
                  </span>
                  <span style={{ marginLeft: "auto" }}>
                    <span className={STATUS_BADGE[task.status]}>
                      {STATUS_LABEL[task.status]}
                    </span>
                  </span>
                </div>

                {/* Expanded: description + action */}
                {isExpanded && (
                  <div
                    style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        marginBottom: "14px",
                      }}
                    >
                      {task.description ?? "Sin descripción."}
                    </p>

                    {task.status !== "resolved" && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: "13px", padding: "10px" }}
                        onClick={() => handleResolve(task.task_id)}
                      >
                        <CheckCircle2 size={14} />
                        Marcar como completada
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
