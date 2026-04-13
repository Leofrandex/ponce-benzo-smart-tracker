"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Play, Square, CheckCircle2, AlertTriangle, ShieldAlert, Clock,
  Navigation2, Loader2, MapPin, Zap, Radio, Plus, X,
} from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { mockStores } from "@/app/lib/mock-data";
import type { Store, StoreStatus } from "@/app/lib/types";

const STATUS_CONFIG: Record<StoreStatus, { label: string; badge: string; Icon: React.ElementType; color?: string }> = {
  pending:   { label: "Pendiente",  badge: "badge-pending",  Icon: Clock,         color: "var(--text-muted)" },
  completed: { label: "Completado", badge: "badge-success",  Icon: CheckCircle2,  color: "var(--success)"    },
  skipped:   { label: "Omitido",    badge: "badge-warning",  Icon: AlertTriangle, color: "var(--warning)"    },
  anomaly:   { label: "Anomalía",   badge: "badge-danger",   Icon: ShieldAlert,   color: "var(--danger)"     },
};

// Demo route: first 5 stores (Farmatodo)
const DEMO_STORES: Store[] = mockStores.slice(0, 5);

interface ExtraStore {
  store_id: string;
  name: string;
  address: string;
}

export default function RutaPage() {
  const { profile } = useAuth();

  const [stores]         = useState<Store[]>(DEMO_STORES);
  const [sessionActive,  setSessionActive]  = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [storeStatuses,  setStoreStatuses]  = useState<Record<string, StoreStatus>>({});
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "searching" | "granted" | "denied">("idle");

  const [extraStores,    setExtraStores]    = useState<ExtraStore[]>([]);
  const [showAddStore,   setShowAddStore]   = useState(false);
  const [newStoreName,   setNewStoreName]   = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");

  // Restore session state from sessionStorage
  useEffect(() => {
    const savedStatuses = sessionStorage.getItem("pv_store_statuses");
    if (savedStatuses) setStoreStatuses(JSON.parse(savedStatuses));
    const active = sessionStorage.getItem("pv_session_active");
    if (active === "true") setSessionActive(true);
    const savedExtra = sessionStorage.getItem("pv_extra_stores");
    if (savedExtra) setExtraStores(JSON.parse(savedExtra));
  }, []);

  const total     = stores.length + extraStores.length;
  const completed = Object.values(storeStatuses).filter((s) => s === "completed").length;
  const skipped   = Object.values(storeStatuses).filter((s) => s === "skipped").length;
  const progress  = total > 0 ? Math.round(((completed + skipped) / total) * 100) : 0;

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

      const initialStatuses: Record<string, StoreStatus> = Object.fromEntries(
        stores.map((s) => [s.store_id, "pending" as StoreStatus])
      );
      setStoreStatuses(initialStatuses);
      sessionStorage.setItem("pv_store_statuses", JSON.stringify(initialStatuses));
      sessionStorage.setItem("pv_session_active", "true");
      sessionStorage.setItem("pv_session_start", new Date().toISOString());
      sessionStorage.setItem("pv_session_id", `demo-session-${Date.now()}`);
      setSessionActive(true);
    } catch {
      setGpsStatus("denied");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = () => {
    sessionStorage.removeItem("pv_session_active");
    sessionStorage.removeItem("pv_session_start");
    sessionStorage.removeItem("pv_session_id");
    sessionStorage.removeItem("pv_store_statuses");
    sessionStorage.removeItem("pv_extra_stores");
    setSessionActive(false);
    setShowConfirmEnd(false);
    setGpsStatus("idle");
    setExtraStores([]);
    setStoreStatuses({});
  };

  const handleAddStore = () => {
    const name = newStoreName.trim();
    if (!name) return;
    const newStore: ExtraStore = {
      store_id: `extra-${Date.now()}`,
      name,
      address: newStoreAddress.trim() || "Dirección no especificada",
    };
    const updatedExtra = [...extraStores, newStore];
    setExtraStores(updatedExtra);
    sessionStorage.setItem("pv_extra_stores", JSON.stringify(updatedExtra));

    const updatedStatuses = { ...storeStatuses, [newStore.store_id]: "pending" as StoreStatus };
    setStoreStatuses(updatedStatuses);
    sessionStorage.setItem("pv_store_statuses", JSON.stringify(updatedStatuses));

    setNewStoreName("");
    setNewStoreAddress("");
    setShowAddStore(false);
  };

  return (
    <>
      {/* Greeting */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Hola, {profile?.full_name?.split(" ")[0] ?? ""}
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
            Tienes {stores.length} tiendas asignadas hoy
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
          {stores.map((store, idx) => {
            const storeStatus = storeStatuses[store.store_id] ?? "pending";
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

          {extraStores.map((store, idx) => {
            const storeStatus = storeStatuses[store.store_id] ?? "pending";
            const cfg = STATUS_CONFIG[storeStatus];
            const StatusIcon = cfg.Icon;
            const isVisitable = sessionActive && storeStatus === "pending";
            const globalIdx = stores.length + idx;

            return (
              <Link
                key={store.store_id}
                href={isVisitable ? `/checkin/${store.store_id}` : "#"}
                className="store-card"
                style={{
                  cursor: isVisitable ? "pointer" : "default",
                  borderStyle: "dashed",
                  borderColor: "var(--border-accent)",
                }}
                onClick={(e) => !isVisitable && e.preventDefault()}
              >
                <div className="store-number" style={{ background: "rgba(0,32,92,0.1)", borderColor: "var(--accent)" }}>
                  {globalIdx + 1}
                </div>
                <div className="store-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div className="store-name">{store.name}</div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", background: "var(--accent-glow)", borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.3px", flexShrink: 0 }}>
                      EXTRA
                    </span>
                  </div>
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

        {sessionActive && (
          <button
            onClick={() => setShowAddStore(true)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              width: "100%", marginTop: "10px", padding: "12px",
              border: "1.5px dashed var(--border-accent)", borderRadius: "var(--radius-md)",
              background: "transparent", color: "var(--accent)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              transition: "background var(--duration) var(--ease)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Plus size={15} />
            Agregar sucursal
          </button>
        )}
      </div>

      {sessionActive && (
        <button id="btn-end-route" className="btn btn-danger" onClick={() => setShowConfirmEnd(true)}>
          <Square size={16} fill="currentColor" />
          Finalizar Ruta
        </button>
      )}

      {showConfirmEnd && (
        <div className="modal-overlay" onClick={() => setShowConfirmEnd(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Finalizar la ruta</div>
            <p className="text-muted text-sm">
              Confirma que completaste todas las visitas del día.
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

      {showAddStore && (
        <div className="modal-overlay" onClick={() => setShowAddStore(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="modal-title">Agregar sucursal</div>
              <button
                onClick={() => setShowAddStore(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-muted text-sm">
              Agrega una sucursal que no estaba en tu ruta asignada.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Nombre de la sucursal *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej: Farmatodo Sambil"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej: C.C. Sambil, Caracas"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAddStore}
                  disabled={!newStoreName.trim()}
                >
                  <Plus size={16} />
                  Agregar sucursal
                </button>
                <button className="btn btn-secondary" onClick={() => setShowAddStore(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
