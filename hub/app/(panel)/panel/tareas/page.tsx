"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchFullTasks, type FullTaskRow } from "@/app/lib/queries/tasks";
import { resolveTask } from "@/app/lib/mutations/tasks";
import { GeoFilters } from "@/app/components/geo/GeoFilters";
import { fetchTaskAssignees } from "@/app/lib/queries/assignments";
import {
  EMPTY_TASK_FILTER, deriveTaskFilterOptions, filterTasks, hasActiveFilters, taskTypeLabel,
  type TaskFilterValue,
} from "@/app/lib/queries/taskFilters";
import { TaskFilters } from "@/app/components/tareas/TaskFilters";
import { TaskVisitDetail } from "@/app/components/tareas/TaskVisitDetail";
import { TaskResolutionNote } from "@/app/components/tareas/TaskResolutionNote";

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

function TareasPageInner() {
  const { data: rawTasks, loading, error, refetch } = useSupabaseQuery(fetchFullTasks, []);
  const tasks = useMemo(() => rawTasks ?? [], [rawTasks]);
  const { data: rawAssignees } = useSupabaseQuery(fetchTaskAssignees, []);
  const assignees = useMemo(() => rawAssignees ?? [], [rawAssignees]);
  const [filter, setFilter] = useState<TaskFilterValue>(EMPTY_TASK_FILTER);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const open     = tasks.filter((t) => t.status === "open").length;
  const resolved = tasks.filter((t) => t.status === "resolved").length;

  const options  = useMemo(() => deriveTaskFilterOptions(tasks, assignees), [tasks, assignees]);
  const filtered = useMemo(() => filterTasks(tasks, filter, assignees), [tasks, filter, assignees]);

  // Enlace directo: /panel/tareas?task=<id> abre esa tarea y la enfoca.
  const searchParams = useSearchParams();
  const linkedId = searchParams.get("task");
  const linkedRef = useRef<HTMLDivElement | null>(null);
  const [linkedApplied, setLinkedApplied] = useState(false);
  const linkedMissing = !!linkedId && !loading && !error && !tasks.some((t) => t.task_id === linkedId);
  const linkedHidden  = !!linkedId && !linkedMissing && !filtered.some((t) => t.task_id === linkedId);

  useEffect(() => {
    if (!linkedId || loading || linkedApplied) return;
    if (tasks.some((t) => t.task_id === linkedId)) setExpandedId(linkedId);
    setLinkedApplied(true);
  }, [linkedId, loading, linkedApplied, tasks]);

  useEffect(() => {
    if (linkedApplied && expandedId === linkedId && linkedRef.current) {
      linkedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [linkedApplied, expandedId, linkedId]);

  const handleResolve = async (taskId: string, nota: string) => {
    const { error: e } = await resolveTask(taskId, nota);
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
          Anomalías y acciones pendientes
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
            className={`filter-chip ${filter.status === key ? "active" : ""}`}
            onClick={() => setFilter({ ...filter, status: key })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: "12px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
        <TaskFilters value={filter} onChange={setFilter} options={options} />
        <GeoFilters items={tasks} value={filter.geo} onChange={(geo) => setFilter({ ...filter, geo })} />
        {hasActiveFilters(filter) && (
          <button className="filter-chip" onClick={() => setFilter(EMPTY_TASK_FILTER)} style={{ marginLeft: "auto" }}>
            Limpiar
          </button>
        )}
      </div>

      {linkedMissing && (
        <div className="card" style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-muted)" }}>
          La tarea enlazada no está disponible.
        </div>
      )}
      {linkedHidden && (
        <div className="card" style={{ padding: "10px 12px", fontSize: "13px", color: "var(--text-muted)" }}>
          La tarea enlazada está oculta por los filtros activos.{" "}
          <button className="filter-chip" onClick={() => setFilter(EMPTY_TASK_FILTER)}>Limpiar filtros</button>
        </div>
      )}

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
                ref={task.task_id === linkedId ? linkedRef : undefined}
                className="card"
                style={{
                  padding: "16px",
                  cursor: "pointer",
                  opacity: task.status === "resolved" ? 0.65 : 1,
                  borderColor: task.task_id === linkedId ? "var(--primary, #1e3a8a)" : task.status === "open" ? "var(--danger-bg)" : "var(--border)",
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
                      {(task.title ?? task.task_type).replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                      {[task.client_name, task.store_name, task.created_by_name].filter(Boolean).join(" · ") || "—"}
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
                  <span>{taskTypeLabel(task.task_type)}</span>
                  {task.resolution_note && (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: "4px" }}
                      title="Tiene comentario de cierre"
                    >
                      <MessageSquare size={11} />
                      Con comentario
                    </span>
                  )}
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

                    {task.source_visit_id && <TaskVisitDetail visitId={task.source_visit_id} />}

                    <TaskResolutionNote
                      task={task}
                      onResolve={(nota) => handleResolve(task.task_id, nota)}
                      onSaved={refetch}
                    />
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

export default function TareasPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando tareas…</div></div>}>
      <TareasPageInner />
    </Suspense>
  );
}
