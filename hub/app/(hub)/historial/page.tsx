"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert, Clock, MapPin, CloudOff, ClipboardList } from "lucide-react";
import type { VisitRecord, StoreStatus } from "@/app/lib/types";
import { mockStores } from "@/app/lib/mock-data";

const STATUS_CONFIG = {
  completed: { label: "Completado", Icon: CheckCircle2,  badge: "badge-success" },
  skipped:   { label: "Omitido",   Icon: AlertTriangle,  badge: "badge-warning" },
  anomaly:   { label: "Anomalía",  Icon: ShieldAlert,    badge: "badge-danger"  },
  pending:   { label: "Pendiente", Icon: Clock,          badge: "badge-pending" },
} as const;

// Resolve store names from mock data
const STORE_NAMES: Record<string, string> = Object.fromEntries(
  mockStores.map((s) => [s.store_id, s.name])
);

export default function HistorialPage() {
  const [visits, setVisits] = useState<VisitRecord[]>([]);

  useEffect(() => {
    const saved: VisitRecord[] = JSON.parse(sessionStorage.getItem("pv_visits") || "[]");
    setVisits(saved);
  }, []);

  const completed = visits.filter((v) => v.status === "completed").length;
  const skipped   = visits.filter((v) => v.status === "skipped").length;
  const anomalies = visits.filter((v) => v.status === "anomaly").length;

  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Historial de hoy
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Resumen de visitas en la sesión actual
        </p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{completed}</div>
          <div className="stat-label">Completadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{skipped}</div>
          <div className="stat-label">Omitidas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>{anomalies}</div>
          <div className="stat-label">Anomalías</div>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={52} color="var(--text-muted)" strokeWidth={1} />
          <div className="empty-title">Sin registros aún</div>
          <div className="empty-desc">
            Las visitas que registres durante la ruta aparecerán aquí.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span className="section-title">{visits.length} visitas registradas</span>
          {visits.map((visit) => {
            const storeName = STORE_NAMES[visit.store_id] ?? visit.store_id;
            const cfg = STATUS_CONFIG[visit.status as StoreStatus];
            const Icon = cfg.Icon;
            const time = new Date(visit.check_in_time).toLocaleTimeString("es-VE", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={visit.visit_id} className="card" style={{ padding: "14px 16px" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600 }}>
                    {storeName}
                  </span>
                  <span className={`badge ${cfg.badge}`}>
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <span className="text-xs text-muted" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={11} />
                    {time}
                  </span>
                  {visit.check_in_location && (
                    <span className="text-xs text-muted" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={11} />
                      {visit.check_in_location.lat.toFixed(4)}°, {visit.check_in_location.lng.toFixed(4)}°
                    </span>
                  )}
                  {!visit.synced && (
                    <span className="sync-banner" style={{ padding: "3px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <CloudOff size={11} />
                      Pendiente de sync
                    </span>
                  )}
                </div>
                {visit.observations && (
                  <p className="text-sm text-muted" style={{ marginTop: "8px", lineHeight: 1.5 }}>
                    {visit.observations}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
