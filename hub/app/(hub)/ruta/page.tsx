"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Play, Square, CheckCircle2, AlertTriangle, ShieldAlert, Clock,
  Navigation2, Loader2, MapPin, Zap, Radio,
} from "lucide-react";
import { mockUser, mockStores, type StoreStatus } from "@/app/lib/mock-data";

const STATUS_CONFIG: Record<StoreStatus, { label: string; badge: string; Icon: React.ElementType; color?: string }> = {
  pending:   { label: "Pendiente",  badge: "badge-pending",  Icon: Clock,        color: "var(--text-muted)" },
  completed: { label: "Completado", badge: "badge-success",  Icon: CheckCircle2, color: "var(--success)" },
  skipped:   { label: "Omitido",    badge: "badge-warning",  Icon: AlertTriangle, color: "var(--warning)" },
  anomaly:   { label: "Anomalía",   badge: "badge-danger",   Icon: ShieldAlert,  color: "var(--danger)" },
};

export default function RutaPage() {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [storeStatuses, setStoreStatuses] = useState<Record<string, StoreStatus>>(
    Object.fromEntries(mockStores.map((s) => [s.store_id, "pending"]))
  );
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "searching" | "granted" | "denied">("idle");

  useEffect(() => {
    const saved = sessionStorage.getItem("pv_store_statuses");
    if (saved) setStoreStatuses(JSON.parse(saved));
    const active = sessionStorage.getItem("pv_session_active");
    if (active === "true") setSessionActive(true);
  }, []);

  const completed = Object.values(storeStatuses).filter((s) => s === "completed").length;
  const skipped   = Object.values(storeStatuses).filter((s) => s === "skipped").length;
  const total     = mockStores.length;
  const progress  = Math.round(((completed + skipped) / total) * 100);

  const handleStartSession = async () => {
    setSessionLoading(true);
    setGpsStatus("searching");
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
        });
      });
      setGpsStatus("granted");
      await new Promise((r) => setTimeout(r, 600));
      sessionStorage.setItem("pv_session_active", "true");
      sessionStorage.setItem("pv_session_start", new Date().toISOString());
      setSessionActive(true);
    } catch {
      setGpsStatus("denied");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    sessionStorage.removeItem("pv_session_active");
    sessionStorage.removeItem("pv_session_start");
    setSessionActive(false);
    setShowConfirmEnd(false);
    setGpsStatus("idle");
    const reset = Object.fromEntries(mockStores.map((s) => [s.store_id, "pending" as StoreStatus]));
    setStoreStatuses(reset);
    sessionStorage.removeItem("pv_store_statuses");
  };

  return (
    <>
      {/* Greeting */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Hola, {mockUser.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
          Ruta del{" "}
          {new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Session Banner */}
      {!sessionActive ? (
        <div
          className="card"
          style={{ background: "var(--accent-glow)", borderColor: "var(--border-accent)", textAlign: "center", padding: "28px 20px" }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <Zap size={40} color="var(--accent-light)" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
            Tienes {total} tiendas asignadas hoy
          </p>
          <p className="text-muted text-sm" style={{ marginBottom: "20px" }}>
            Presiona el botón para iniciar tu ruta y activar el GPS.
          </p>

          {gpsStatus === "denied" && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "var(--danger-bg)", borderRadius: "var(--radius-md)", fontSize: "13px", color: "var(--danger)" }}>
              GPS denegado. Activa la ubicación en tu navegador para continuar.
            </div>
          )}

          <button
            id="btn-start-route"
            className="btn btn-primary"
            onClick={handleStartSession}
            disabled={sessionLoading}
          >
            {sessionLoading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />
                Obteniendo GPS...
              </>
            ) : (
              <>
                <Play size={16} fill="white" />
                Empezar Ruta
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active session */
        <div className="card" style={{ borderColor: "rgba(34,208,110,0.3)", background: "var(--success-bg)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, color: "var(--success)" }}>
              <Radio size={14} />
              Sesión activa
            </span>
            <span className="gps-chip">
              <span className="gps-dot" />
              <Navigation2 size={12} />
              GPS On
            </span>
          </div>
          <div className="stats-row" style={{ marginBottom: "14px" }}>
            <div className="stat-card" style={{ background: "var(--bg-card)" }}>
              <div className="stat-value">{completed}</div>
              <div className="stat-label">Completadas</div>
            </div>
            <div className="stat-card" style={{ background: "var(--bg-card)" }}>
              <div className="stat-value">{skipped}</div>
              <div className="stat-label">Omitidas</div>
            </div>
            <div className="stat-card" style={{ background: "var(--bg-card)" }}>
              <div className="stat-value">{total - completed - skipped}</div>
              <div className="stat-label">Pendientes</div>
            </div>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>Progreso de la ruta</span>
            <span style={{ fontWeight: 700 }}>{progress}%</span>
          </div>
        </div>
      )}

      {/* Store List */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <span className="section-title">Tiendas de hoy</span>
          <span className="badge badge-accent">{total} paradas</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {mockStores.map((store, idx) => {
            const storeStatus = storeStatuses[store.store_id];
            const cfg = STATUS_CONFIG[storeStatus];
            const StatusIcon = cfg.Icon;
            const isVisitable = sessionActive && storeStatus === "pending";

            return (
              <Link
                key={store.store_id}
                href={isVisitable ? `/checkin/${store.store_id}` : "#"}
                id={`store-card-${idx + 1}`}
                className="store-card"
                style={{
                  opacity: !sessionActive ? 0.5 : 1,
                  cursor: isVisitable ? "pointer" : "default",
                  pointerEvents: !sessionActive ? "none" : "auto",
                }}
                onClick={(e) => !isVisitable && e.preventDefault()}
              >
                <div className="store-number">{idx + 1}</div>
                <div className="store-info">
                  <div className="store-name">{store.name}</div>
                  <div className="store-address" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={11} />
                    {store.address}
                  </div>
                </div>
                <div className="store-status">
                  <span className={`badge ${cfg.badge}`}>
                    <StatusIcon size={11} />
                    {cfg.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* End Route */}
      {sessionActive && (
        <button id="btn-end-route" className="btn btn-danger" onClick={() => setShowConfirmEnd(true)}>
          <Square size={16} fill="currentColor" />
          Finalizar Ruta
        </button>
      )}

      {/* Confirm End Modal */}
      {showConfirmEnd && (
        <div className="modal-overlay" onClick={() => setShowConfirmEnd(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Finalizar la ruta</div>
            <p className="text-muted text-sm">
              Confirma que completaste todas las visitas del día. Esta acción registrará tu cierre de sesión en el sistema.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button id="btn-confirm-end-route" className="btn btn-danger" onClick={handleEndSession}>
                Sí, finalizar ruta
              </button>
              <button className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
