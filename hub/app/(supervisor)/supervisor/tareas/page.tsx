"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Phone,
  Tag,
  Wrench,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import {
  mockTasks,
  type SupervisorTask,
  type TaskStatus,
} from "@/app/lib/mock-data";

const TASK_TYPE_CONFIG: Record<
  SupervisorTask["type"],
  { label: string; Icon: React.ElementType }
> = {
  restock:         { label: "Reponer stock",      Icon: Package    },
  contact_manager: { label: "Contactar gerente",  Icon: Phone      },
  pricing_issue:   { label: "Problema de precio", Icon: Tag        },
  display_damage:  { label: "Daño en exhibidor",  Icon: Wrench     },
  other:           { label: "Otro",               Icon: HelpCircle },
};

// Maps priority → badge class + icon container colors
const PRIORITY_CONFIG: Record<
  SupervisorTask["priority"],
  { label: string; badgeClass: string; iconBg: string; iconColor: string }
> = {
  high:   { label: "Alta",  badgeClass: "badge badge-danger",  iconBg: "var(--danger-bg)",  iconColor: "var(--danger)"  },
  medium: { label: "Media", badgeClass: "badge badge-warning", iconBg: "var(--warning-bg)", iconColor: "var(--warning)" },
  low:    { label: "Baja",  badgeClass: "badge badge-success", iconBg: "var(--success-bg)", iconColor: "var(--success)" },
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  open:        "badge badge-danger",
  in_progress: "badge badge-warning",
  resolved:    "badge badge-success",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open:        "Abierta",
  in_progress: "En progreso",
  resolved:    "Resuelta",
};

const STATUS_FILTERS: { key: TaskStatus | "all"; label: string }[] = [
  { key: "all",         label: "Todas"       },
  { key: "open",        label: "Abiertas"    },
  { key: "in_progress", label: "En progreso" },
  { key: "resolved",    label: "Resueltas"   },
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
  const [tasks, setTasks] = useState<SupervisorTask[]>(mockTasks);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const open       = tasks.filter((t) => t.status === "open").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const resolved   = tasks.filter((t) => t.status === "resolved").length;

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const handleResolve = async (taskId: string) => {
    setLoadingId(taskId);
    await new Promise((r) => setTimeout(r, 600));
    setTasks((prev) =>
      prev.map((t) => (t.task_id === taskId ? { ...t, status: "resolved" } : t))
    );
    setLoadingId(null);
    setExpandedId(null);
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
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>{open}</div>
          <div className="stat-label">Abiertas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{inProgress}</div>
          <div className="stat-label">En progreso</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{resolved}</div>
          <div className="stat-label">Resueltas</div>
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

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.length === 0 && (
          <div className="empty-state">
            <CheckCircle2 size={44} style={{ opacity: 0.2 }} />
            <div className="empty-title">Sin tareas</div>
            <div className="empty-desc">No hay tareas con este filtro.</div>
          </div>
        )}

        {filtered.map((task) => {
          const typeCfg     = TASK_TYPE_CONFIG[task.type];
          const priorityCfg = PRIORITY_CONFIG[task.priority];
          const TypeIcon    = typeCfg.Icon;
          const isExpanded  = expandedId === task.task_id;
          const isLoading   = loadingId === task.task_id;

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
              {/* Row 1: type icon + store + priority badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-sm)",
                    background: priorityCfg.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <TypeIcon size={16} color={priorityCfg.iconColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {typeCfg.label}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                    {task.store_name}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <span className={priorityCfg.badgeClass}>{priorityCfg.label}</span>
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

              {/* Row 2: merchandiser + time + status */}
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
                <span>·</span>
                <span>{task.merchandiser_name}</span>
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
                    {task.description}
                  </p>

                  {task.status !== "resolved" && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "13px", padding: "10px" }}
                      onClick={() => handleResolve(task.task_id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                          Marcando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Marcar como resuelta
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
