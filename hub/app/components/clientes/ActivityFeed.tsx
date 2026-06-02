"use client";

import { useMemo, useState } from "react";
import {
  Camera, ClipboardList, CheckCircle2, AlertTriangle, MinusCircle,
  User, Clock, MapPin, ChevronRight, Package, Phone, Tag, Wrench, HelpCircle,
} from "lucide-react";
import type { SupervisorReport, SupervisorTask } from "@/app/lib/types";
import { PhotoLightbox } from "./PhotoLightbox";

type DateFilter = "all" | "today" | "week";
type ActivityTab = "reportes" | "tareas";

const STATUS_CONFIG = {
  completed: { label: "Completado", Icon: CheckCircle2,  badgeClass: "badge badge-success", iconBg: "var(--success-bg)", iconColor: "var(--success)" },
  anomaly:   { label: "Anomalía",   Icon: AlertTriangle, badgeClass: "badge badge-danger",  iconBg: "var(--danger-bg)",  iconColor: "var(--danger)"  },
  skipped:   { label: "Omitido",    Icon: MinusCircle,   badgeClass: "badge badge-warning", iconBg: "var(--warning-bg)", iconColor: "var(--warning)" },
};
const TASK_TYPE_CONFIG: Record<SupervisorTask["type"], { label: string; Icon: React.ElementType }> = {
  restock: { label: "Reponer stock", Icon: Package }, contact_manager: { label: "Contactar gerente", Icon: Phone },
  pricing_issue: { label: "Problema de precio", Icon: Tag }, display_damage: { label: "Daño en exhibidor", Icon: Wrench },
  other: { label: "Otro", Icon: HelpCircle },
};
const PRIORITY_CONFIG: Record<SupervisorTask["priority"], { label: string; badgeClass: string; iconBg: string; iconColor: string }> = {
  high: { label: "Alta", badgeClass: "badge badge-danger", iconBg: "var(--danger-bg)", iconColor: "var(--danger)" },
  medium: { label: "Media", badgeClass: "badge badge-warning", iconBg: "var(--warning-bg)", iconColor: "var(--warning)" },
  low: { label: "Baja", badgeClass: "badge badge-success", iconBg: "var(--success-bg)", iconColor: "var(--success)" },
};
const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "today", label: "Hoy" }, { key: "week", label: "Esta semana" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const dateStr = d.toDateString() === now.toDateString() ? "Hoy"
    : d.toDateString() === new Date(now.getTime() - 86400000).toDateString() ? "Ayer"
    : d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  return `${dateStr} · ${d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
}
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const isThisWeek = (iso: string) => Date.now() - new Date(iso).getTime() <= 7 * 86400000;

export function ActivityFeed({ reports, tasks }: { reports: SupervisorReport[]; tasks: SupervisorTask[] }) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("reportes");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const filtered = useMemo(() => reports.filter((r) =>
    dateFilter === "today" ? isToday(r.check_in_time) : dateFilter === "week" ? isThisWeek(r.check_in_time) : true,
  ), [reports, dateFilter]);
  const pendingTasks = tasks.filter((t) => t.status !== "resolved");

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="section-title">Actividad reciente</div>

      <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "3px" }}>
        {(["reportes", "tareas"] as ActivityTab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, border: "none", borderRadius: "calc(var(--radius-md) - 2px)", padding: "7px 12px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: activeTab === tab ? "var(--bg-surface)" : "transparent",
            color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            {tab === "reportes" ? <Camera size={13} /> : <ClipboardList size={13} />}
            {tab === "reportes" ? "Reportes" : "Tareas"}
          </button>
        ))}
      </div>

      {activeTab === "reportes" && (
        <>
          <div style={{ display: "flex", gap: "8px" }}>
            {DATE_FILTERS.map(({ key, label }) => (
              <button key={key} className={`filter-chip ${dateFilter === key ? "active" : ""}`} onClick={() => setDateFilter(key)}>{label}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Sin reportes en este período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map((report) => {
                const cfg = STATUS_CONFIG[report.status]; const StatusIcon = cfg.Icon;
                const isExpanded = expandedVisit === report.visit_id;
                return (
                  <div key={report.visit_id} className="card" style={{ padding: "14px 16px", cursor: "pointer", borderColor: report.status === "anomaly" ? "var(--danger-bg)" : "var(--border)" }}
                    onClick={() => setExpandedVisit(isExpanded ? null : report.visit_id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><StatusIcon size={15} color={cfg.iconColor} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{formatDateTime(report.check_in_time)}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}><User size={10} /> {report.merchandiser_name}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <span className={cfg.badgeClass}>{cfg.label}</span>
                        <ChevronRight size={13} color="var(--text-muted)" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Clock size={11} />{report.duration_minutes > 0 ? `${report.duration_minutes}min` : "—"}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><Camera size={11} />{report.photo_urls.length} fotos</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "3px", color: report.location_verified ? "var(--success)" : "var(--warning)" }}><MapPin size={11} />{report.location_verified ? "Verificado" : "Sin verificar"}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                        {report.observations && (
                          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "10px" }}>{report.observations}</p>
                        )}
                        {report.photo_urls.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "6px" }}>
                            {report.photo_urls.map((url, idx) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={url} src={url} alt={`Foto ${idx + 1}`} onClick={() => setLightbox({ urls: report.photo_urls, index: idx })}
                                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "tareas" && (
        pendingTasks.length === 0 && tasks.length === 0 ? (
          <div className="card" style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><CheckCircle2 size={16} color="var(--success)" />Sin tareas registradas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tasks.map((task) => {
              const typeCfg = TASK_TYPE_CONFIG[task.type]; const prCfg = PRIORITY_CONFIG[task.priority]; const TypeIcon = typeCfg.Icon;
              return (
                <div key={task.task_id} className="card" style={{ padding: "14px 16px", opacity: task.status === "resolved" ? 0.65 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: prCfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><TypeIcon size={15} color={prCfg.iconColor} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{typeCfg.label}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", display: "flex", alignItems: "center", gap: "3px" }}><User size={10} /> {task.merchandiser_name}</div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <span className={prCfg.badgeClass}>{prCfg.label}</span>
                      {task.status === "resolved" && <span className="badge badge-success">Resuelta</span>}
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginTop: "10px" }}>{task.description}</p>
                </div>
              );
            })}
          </div>
        )
      )}

      {lightbox && <PhotoLightbox urls={lightbox.urls} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}
