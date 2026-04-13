"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, MapPin, CheckCircle2, AlertTriangle, MinusCircle,
  User, Clock, Package, Phone, Tag, Wrench, HelpCircle,
  ChevronRight, Building2, Camera, Mail, ClipboardList,
} from "lucide-react";
import { mockStores, mockReports, mockTasks } from "@/app/lib/mock-data";
import type { StoreKPIs, SupervisorTask, SupervisorReport } from "@/app/lib/types";

type DateFilter = "all" | "today" | "week";
type ActivityTab = "reportes" | "tareas";

const STATUS_CONFIG = {
  completed: { label: "Completado", Icon: CheckCircle2,  badgeClass: "badge badge-success", iconBg: "var(--success-bg)", iconColor: "var(--success)" },
  anomaly:   { label: "Anomalía",   Icon: AlertTriangle, badgeClass: "badge badge-danger",  iconBg: "var(--danger-bg)",  iconColor: "var(--danger)"  },
  skipped:   { label: "Omitido",    Icon: MinusCircle,   badgeClass: "badge badge-warning", iconBg: "var(--warning-bg)", iconColor: "var(--warning)" },
};

const TASK_TYPE_CONFIG: Record<SupervisorTask["type"], { label: string; Icon: React.ElementType }> = {
  restock:         { label: "Reponer stock",      Icon: Package    },
  contact_manager: { label: "Contactar gerente",  Icon: Phone      },
  pricing_issue:   { label: "Problema de precio", Icon: Tag        },
  display_damage:  { label: "Daño en exhibidor",  Icon: Wrench     },
  other:           { label: "Otro",               Icon: HelpCircle },
};

const PRIORITY_CONFIG: Record<SupervisorTask["priority"], { label: string; badgeClass: string; iconBg: string; iconColor: string }> = {
  high:   { label: "Alta",  badgeClass: "badge badge-danger",  iconBg: "var(--danger-bg)",  iconColor: "var(--danger)"  },
  medium: { label: "Media", badgeClass: "badge badge-warning", iconBg: "var(--warning-bg)", iconColor: "var(--warning)" },
  low:    { label: "Baja",  badgeClass: "badge badge-success", iconBg: "var(--success-bg)", iconColor: "var(--success)" },
};

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all",   label: "Todos"       },
  { key: "today", label: "Hoy"         },
  { key: "week",  label: "Esta semana" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const dateStr =
    d.toDateString() === now.toDateString() ? "Hoy" :
    d.toDateString() === new Date(now.getTime() - 86400000).toDateString() ? "Ayer" :
    d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  return `${dateStr} · ${d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function isThisWeek(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function computeKPIs(reports: SupervisorReport[]): StoreKPIs {
  const total      = reports.length;
  const completed  = reports.filter((r) => r.status === "completed").length;
  const anomaly    = reports.filter((r) => r.status === "anomaly").length;
  const skipped    = reports.filter((r) => r.status === "skipped").length;
  const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;

  let avgDays: number | null = null;
  if (reports.length >= 2) {
    const sorted = [...reports].sort(
      (a, b) => new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime()
    );
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDays += (new Date(sorted[i].check_in_time).getTime() - new Date(sorted[i - 1].check_in_time).getTime()) / 86400000;
    }
    avgDays = Math.round(totalDays / (sorted.length - 1));
  }

  return { total_visits: total, completed_count: completed, anomaly_count: anomaly, skipped_count: skipped, compliance_pct: compliance, avg_days_between_visits: avgDays };
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
          {label}
        </div>
        {href ? (
          <a href={href} style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>
            {value}
          </a>
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
        )}
      </div>
    </div>
  );
}

export default function ContactoDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId]   = useState<string | null>(null);
  const [dateFilter, setDateFilter]           = useState<DateFilter>("all");
  const [activeTab, setActiveTab]             = useState<ActivityTab>("reportes");

  const store = useMemo(() => mockStores.find((s) => s.store_id === storeId) ?? null, [storeId]);

  const allReports = useMemo(() =>
    mockReports
      .filter((r) => r.store_id === storeId)
      .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()),
    [storeId]
  );

  const filteredReports = useMemo(() => {
    return allReports.filter((r) => {
      if (dateFilter === "today") return isToday(r.check_in_time);
      if (dateFilter === "week")  return isThisWeek(r.check_in_time);
      return true;
    });
  }, [allReports, dateFilter]);

  const pendingTasks = useMemo(() =>
    mockTasks.filter((t) => t.store_id === storeId && t.status !== "resolved"),
    [storeId]
  );

  const allTasks = useMemo(() =>
    mockTasks.filter((t) => t.store_id === storeId),
    [storeId]
  );

  const kpis = useMemo(() => computeKPIs(allReports), [allReports]);

  const totalCompleted = filteredReports.filter((r) => r.status === "completed").length;
  const totalAnomalies = filteredReports.filter((r) => r.status === "anomaly").length;
  const totalSkipped   = filteredReports.filter((r) => r.status === "skipped").length;

  if (!store) {
    return (
      <>
        <Link href="/supervisor/contactos" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}>
          <ArrowLeft size={15} /> Contactos
        </Link>
        <div className="empty-state">
          <Building2 size={44} style={{ opacity: 0.2 }} />
          <div className="empty-title">Tienda no encontrada</div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Back */}
      <Link href="/supervisor/contactos" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}>
        <ArrowLeft size={15} /> Contactos
      </Link>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Building2 size={24} color="var(--accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.4px", margin: 0 }}>
            {store.name}
          </h1>
          <div style={{ marginTop: "4px" }}>
            <span className={store.active ? "badge badge-success" : "badge"} style={!store.active ? { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" } : {}}>
              {store.active ? "Activa" : "Inactiva"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="detail-two-col">

        {/* ── Left column: Métricas + Información de contacto ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* B. KPIs — compact, sin Frecuencia */}
          <div>
            <div className="section-title">Métricas</div>
            <div className="stats-row">
              <div className="stat-card" style={{ padding: "10px 8px" }}>
                <div className="stat-value" style={{ fontSize: "20px", letterSpacing: "-0.5px", color: kpis.compliance_pct >= 75 ? "var(--success)" : kpis.compliance_pct >= 50 ? "var(--warning)" : "var(--danger)" }}>
                  {kpis.compliance_pct}%
                </div>
                <div className="stat-label">Cumplimiento</div>
              </div>
              <div className="stat-card" style={{ padding: "10px 8px" }}>
                <div className="stat-value" style={{ fontSize: "20px", letterSpacing: "-0.5px" }}>{kpis.total_visits}</div>
                <div className="stat-label">Visitas</div>
              </div>
              <div className="stat-card" style={{ padding: "10px 8px" }}>
                <div className="stat-value" style={{ fontSize: "20px", letterSpacing: "-0.5px", color: kpis.anomaly_count > 0 ? "var(--danger)" : "inherit" }}>
                  {kpis.anomaly_count}
                </div>
                <div className="stat-label">Anomalías</div>
              </div>
            </div>
          </div>

          {/* A. Información de contacto */}
          <div>
            <div className="section-title">Información de contacto</div>
            <div className="card" style={{ padding: "0 16px" }}>
              <InfoRow
                icon={<User size={15} color="var(--accent)" />}
                label="Persona de contacto"
                value={store.contact_name}
              />
              <InfoRow
                icon={<Phone size={15} color="var(--accent)" />}
                label="Teléfono"
                value={store.contact_phone}
                href={store.contact_phone ? `tel:${store.contact_phone}` : undefined}
              />
              <InfoRow
                icon={<Mail size={15} color="var(--accent)" />}
                label="Correo electrónico"
                value={store.contact_email}
                href={store.contact_email ? `mailto:${store.contact_email}` : undefined}
              />
              <InfoRow
                icon={<MapPin size={15} color="var(--accent)" />}
                label="Dirección"
                value={store.address}
              />
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={15} color="var(--text-muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                    Coordenadas GPS
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {store.master_lat.toFixed(4)}, {store.master_lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: Actividad reciente ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="section-title">Actividad reciente</div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "3px" }}>
            <button
              onClick={() => setActiveTab("reportes")}
              style={{
                flex: 1, border: "none", borderRadius: "calc(var(--radius-md) - 2px)", padding: "7px 12px",
                fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: activeTab === "reportes" ? "var(--bg-surface)" : "transparent",
                color: activeTab === "reportes" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: activeTab === "reportes" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 150ms ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <Camera size={13} />
              Reportes
              {allReports.length > 0 && (
                <span style={{ fontSize: "10px", background: activeTab === "reportes" ? "var(--accent)" : "var(--border)", color: activeTab === "reportes" ? "white" : "var(--text-muted)", borderRadius: "10px", padding: "1px 6px", fontWeight: 700 }}>
                  {allReports.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("tareas")}
              style={{
                flex: 1, border: "none", borderRadius: "calc(var(--radius-md) - 2px)", padding: "7px 12px",
                fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: activeTab === "tareas" ? "var(--bg-surface)" : "transparent",
                color: activeTab === "tareas" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: activeTab === "tareas" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 150ms ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <ClipboardList size={13} />
              Tareas
              {pendingTasks.length > 0 && (
                <span style={{ fontSize: "10px", background: activeTab === "tareas" ? "var(--danger)" : "var(--danger-bg)", color: activeTab === "tareas" ? "white" : "var(--danger)", borderRadius: "10px", padding: "1px 6px", fontWeight: 700 }}>
                  {pendingTasks.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Tab: Reportes ── */}
          {activeTab === "reportes" && (
            <>
              {/* Date filter chips */}
              <div style={{ display: "flex", gap: "8px" }}>
                {DATE_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`filter-chip ${dateFilter === key ? "active" : ""}`}
                    onClick={() => setDateFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Report stat cards */}
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--success)" }}>{totalCompleted}</div>
                  <div className="stat-label">Completadas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--danger)" }}>{totalAnomalies}</div>
                  <div className="stat-label">Anomalías</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--warning)" }}>{totalSkipped}</div>
                  <div className="stat-label">Omitidas</div>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="card" style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Sin reportes en este período.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredReports.map((report) => {
                    const cfg        = STATUS_CONFIG[report.status];
                    const StatusIcon = cfg.Icon;
                    const isExpanded = expandedVisitId === report.visit_id;

                    return (
                      <div
                        key={report.visit_id}
                        className="card"
                        style={{ padding: "14px 16px", cursor: "pointer", borderColor: report.status === "anomaly" ? "var(--danger-bg)" : "var(--border)" }}
                        onClick={() => setExpandedVisitId(isExpanded ? null : report.visit_id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <StatusIcon size={15} color={cfg.iconColor} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                              {formatDateTime(report.check_in_time)}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                              <User size={10} /> {report.merchandiser_name}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                            <span className={cfg.badgeClass}>{cfg.label}</span>
                            <ChevronRight size={13} color="var(--text-muted)" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <Clock size={11} />
                            {formatTime(report.check_in_time)}
                            {report.duration_minutes > 0 && ` · ${report.duration_minutes}min`}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <Camera size={11} />
                            {report.photos_count} fotos
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "3px", color: report.location_verified ? "var(--success)" : "var(--warning)" }}>
                            <MapPin size={11} />
                            {report.location_verified ? "Verificado" : "Sin verificar"}
                          </span>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                            {report.observations && (
                              <div style={{ marginBottom: "10px" }}>
                                <div className="section-title" style={{ marginBottom: "6px", fontSize: "10px" }}>Observaciones</div>
                                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{report.observations}</p>
                              </div>
                            )}
                            {report.tasks_count > 0 && (
                              <div className="sync-banner" style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger-bg)" }}>
                                <AlertTriangle size={13} />
                                {report.tasks_count}{" "}{report.tasks_count === 1 ? "tarea generada" : "tareas generadas"}
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

          {/* ── Tab: Tareas ── */}
          {activeTab === "tareas" && (
            <>
              {allTasks.length === 0 ? (
                <div className="card" style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <CheckCircle2 size={16} color="var(--success)" />
                  Sin tareas registradas.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {allTasks.map((task) => {
                    const typeCfg     = TASK_TYPE_CONFIG[task.type];
                    const priorityCfg = PRIORITY_CONFIG[task.priority];
                    const TypeIcon    = typeCfg.Icon;
                    const isExpanded  = expandedTaskId === task.task_id;
                    const isResolved  = task.status === "resolved";

                    return (
                      <div
                        key={task.task_id}
                        className="card"
                        style={{
                          padding: "14px 16px", cursor: "pointer",
                          borderColor: task.status === "open" ? "var(--danger-bg)" : "var(--border)",
                          opacity: isResolved ? 0.65 : 1,
                        }}
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: priorityCfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <TypeIcon size={15} color={priorityCfg.iconColor} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{typeCfg.label}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                <User size={10} /> {task.merchandiser_name}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <span className={priorityCfg.badgeClass}>{priorityCfg.label}</span>
                              {isResolved && <span className="badge badge-success">Resuelta</span>}
                            </div>
                            <ChevronRight size={13} color="var(--text-muted)" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease" }} />
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{task.description}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
