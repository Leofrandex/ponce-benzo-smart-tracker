"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Users, MapPin, Navigation, History,
  Search, Filter, Activity,
  ChevronRight, Circle, ArrowLeft, Map as MapIcon, Calendar,
} from "lucide-react";

// ─── Dynamic imports (Leaflet needs browser APIs) ──────────────────────────
const MapLive = dynamic(() => import("@/app/components/MapLive"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
      <MapIcon size={20} style={{ marginRight: "8px", opacity: 0.5 }} /> Cargando mapa…
    </div>
  ),
});

const MapHistory = dynamic(() => import("@/app/components/MapHistory"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
      <MapIcon size={20} style={{ marginRight: "8px", opacity: 0.5 }} /> Generando mapa de calor…
    </div>
  ),
});

// ─── Types ─────────────────────────────────────────────────────────────────
interface TracerPoint {
  lat: number;
  lng: number;
  ts: string;
}

interface Merchandiser {
  id: string;
  name: string;
  status: "active" | "offline" | "completed";
  lastLocation: TracerPoint;
  history: TracerPoint[];
}

// ─── Mock GPS history data (clustered around Caracas neighborhoods) ─────────
function cluster(lat: number, lng: number, n: number, spread = 0.0025): [number, number][] {
  return Array.from({ length: n }, () => [
    lat + (Math.random() - 0.5) * spread,
    lng + (Math.random() - 0.5) * spread,
  ]);
}

const HISTORY_DATA: Record<string, { points: [number, number][]; label: string }> = {
  "2026-04-09": {
    label: "Hoy",
    points: [
      ...cluster(10.4929, -66.8534, 35),  // Chacao
      ...cluster(10.4788, -66.8555, 28),  // Las Mercedes
      ...cluster(10.4894, -66.8541, 22),  // El Rosal
    ],
  },
  "2026-04-08": {
    label: "Mar 8",
    points: [
      ...cluster(10.4972, -66.8460, 30),  // Altamira
      ...cluster(10.4897, -66.8265, 25),  // La California
      ...cluster(10.5056, -66.8524, 20),  // Los Palos Grandes
    ],
  },
  "2026-04-07": {
    label: "Lun 7",
    points: [
      ...cluster(10.5017, -66.8823, 40),  // Sabana Grande
      ...cluster(10.5084, -66.9050, 25),  // Parque Central
      ...cluster(10.5120, -66.9180, 18),  // Silencio
    ],
  },
  "2026-04-04": {
    label: "Vie 4",
    points: [
      ...cluster(10.4652, -66.8305, 32),  // El Cafetal
      ...cluster(10.4720, -66.8640, 28),  // Chuao
      ...cluster(10.4810, -66.8700, 20),  // Bello Monte
    ],
  },
  "2026-04-03": {
    label: "Jue 3",
    points: [
      ...cluster(10.5040, -66.8380, 35),  // Santa Eduvigis
      ...cluster(10.4960, -66.8310, 22),  // Sebucán
      ...cluster(10.5120, -66.8650, 18),  // Los Chorros
    ],
  },
};

const DAY_KEYS = Object.keys(HISTORY_DATA);

// ─── Mock merchandisers ────────────────────────────────────────────────────
const MOCK_MERCHANDISERS: Merchandiser[] = [
  {
    id: "m-1",
    name: "Carlos Rodríguez",
    status: "active",
    lastLocation: { lat: 10.4929, lng: -66.8534, ts: new Date().toISOString() },
    history: [
      { lat: 10.4920, lng: -66.8544, ts: "2026-04-09T09:00:00Z" },
      { lat: 10.4924, lng: -66.8540, ts: "2026-04-09T09:05:00Z" },
      { lat: 10.4929, lng: -66.8534, ts: "2026-04-09T09:10:00Z" },
    ],
  },
  {
    id: "m-2",
    name: "Elena Martínez",
    status: "active",
    lastLocation: { lat: 10.4788, lng: -66.8555, ts: new Date().toISOString() },
    history: [],
  },
  {
    id: "m-3",
    name: "Roberto Gómez",
    status: "offline",
    lastLocation: { lat: 10.5056, lng: -66.8524, ts: "2026-04-09T08:30:00Z" },
    history: [],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────
export default function MapaPage() {
  const [selectedMerch, setSelectedMerch] = useState<Merchandiser | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDay, setSelectedDay] = useState(DAY_KEYS[0]);
  const [merches, setMerches] = useState<Merchandiser[]>(MOCK_MERCHANDISERS);

  // Simulate real-time movement
  // (kept simple: position drifts slightly every render cycle via mock updates)

  // ── History view ──────────────────────────────────────────────────────────
  if (showHistory) {
    const dayData = HISTORY_DATA[selectedDay];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: "12px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: "auto", padding: "8px", flexShrink: 0 }}
            onClick={() => setShowHistory(false)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px" }}>Historial de Rutas</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {selectedMerch?.name ?? "Equipo"} · Mapa de calor GPS
            </div>
          </div>
        </header>

        {/* Day selector */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {DAY_KEYS.map((key) => {
            const d = HISTORY_DATA[key];
            const active = key === selectedDay;
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: `1px solid ${active ? "var(--accent-light)" : "var(--border-base)"}`,
                  background: active ? "var(--accent-glow)" : "var(--bg-card)",
                  color: active ? "var(--accent-light)" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={11} />
                  {d.label}
                </span>
                <span style={{ fontSize: "10px", opacity: 0.7 }}>{d.points.length} pts</span>
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div
          style={{
            flex: 1,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border-base)",
            background: "var(--bg-elevated)",
          }}
        >
          <MapHistory points={dayData.points} />
        </div>

        {/* Stats bar */}
        <div
          className="card"
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-around",
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-light)" }}>
              {dayData.points.length}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Puntos GPS
            </div>
          </div>
          <div style={{ width: "1px", background: "var(--border-base)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-light)" }}>
              ~{Math.round(dayData.points.length * 0.15)} km
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Distancia est.
            </div>
          </div>
          <div style={{ width: "1px", background: "var(--border-base)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--success)" }}>3</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Tiendas
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view (GPS Tracker) ─────────────────────────────────────────────
  if (selectedMerch) {
    return (
      <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column", gap: "12px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: "auto", padding: "8px", flexShrink: 0 }}
            onClick={() => setSelectedMerch(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px" }}>
              GPS Tracker: {selectedMerch.name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Circle size={6} fill="var(--success)" color="transparent" />
              En vivo · Caracas, Venezuela
            </div>
          </div>
        </header>

        {/* Real Leaflet map */}
        <div
          style={{
            flex: 1,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border-base)",
            background: "var(--bg-elevated)",
            position: "relative",
          }}
        >
          <MapLive
            currentLocation={selectedMerch.lastLocation}
            history={selectedMerch.history}
            name={selectedMerch.name}
          />

          {/* Overlay badge */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15, 15, 26, 0.88)",
              backdropFilter: "blur(8px)",
              padding: "8px 14px",
              borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              zIndex: 999,
              fontSize: "12px",
              color: "white",
              whiteSpace: "nowrap",
            }}
          >
            <Navigation size={12} color="var(--accent-light)" />
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
              {selectedMerch.lastLocation.lat.toFixed(5)}, {selectedMerch.lastLocation.lng.toFixed(5)}
            </span>
            <span className="badge badge-success" style={{ padding: "2px 8px", fontSize: "10px" }}>
              REC
            </span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowHistory(true)}
        >
          <History size={16} /> Ver historial completo del día
        </button>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="map-page">
      <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>GPS Tracker</h1>
          <p className="text-muted text-sm">Monitoreo de equipo en tiempo real</p>
        </div>
        <div className="badge badge-accent" style={{ padding: "8px 12px" }}>
          <Activity size={14} style={{ marginRight: "6px" }} />
          {merches.filter((m) => m.status === "active").length} Activos
        </div>
      </div>

      <div
        className="card"
        style={{ padding: "4px 12px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}
      >
        <Search size={18} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Buscar mercaderista..."
          style={{ flex: 1, border: "none", background: "transparent", padding: "12px 0", outline: "none", fontSize: "14px" }}
        />
        <Filter size={18} color="var(--text-muted)" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {merches.map((m) => (
          <div key={m.id} className="store-card" onClick={() => setSelectedMerch(m)}>
            <div className="flex items-center justify-between" style={{ width: "100%" }}>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: m.status === "active" ? "var(--accent-glow)" : "var(--bg-elevated)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-base)",
                  }}
                >
                  <Users size={22} color={m.status === "active" ? "var(--accent-light)" : "var(--text-muted)"} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px" }}>{m.name}</div>
                  <div
                    style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}
                  >
                    <MapPin size={12} />
                    {m.status === "active" ? "Localización en vivo · Caracas" : "Última parada registrada"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.status === "active" && (
                  <div className="gps-dot" style={{ animation: "pulse 1.5s infinite" }} />
                )}
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{ marginTop: "24px", background: "var(--bg-elevated)", borderStyle: "dashed", borderColor: "var(--accent-light)" }}
      >
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ color: "var(--accent-light)" }}>
            <MapIcon size={24} />
          </div>
          <div>
            <h4 style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>Modo Supervisor Activo</h4>
            <p className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
              Estás visualizando el rastro GPS capturado por cada dispositivo. Los puntos se actualizan
              automáticamente vía Supabase Realtime.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
