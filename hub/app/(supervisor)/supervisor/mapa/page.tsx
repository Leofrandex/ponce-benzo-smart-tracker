"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Map as MapIcon, Radio, History, Activity } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStores } from "@/app/lib/queries/stores";
import { fetchLivePositions, fetchMerchandisers, type LivePosition } from "@/app/lib/queries/sessions";
import { MapFilterSidebar, EMPTY_MAP_FILTERS, type MapFilterValue } from "@/app/components/mapa/MapFilterSidebar";
import type { MapMerchandiser } from "@/app/lib/map-data";

const MapLiveView = dynamic(() => import("@/app/components/mapa/MapLiveView"), {
  ssr: false,
  loading: () => <MapLoading label="Cargando mapa…" />,
});
const MapHistoryView = dynamic(() => import("@/app/components/mapa/MapHistoryView"), {
  ssr: false,
  loading: () => <MapLoading label="Generando mapa de calor…" />,
});

function MapLoading({ label }: { label: string }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}><MapIcon size={20} style={{ marginRight: 8, opacity: 0.5 }} /> {label}</div>;
}

type Tab = "live" | "history";

export default function MapaPage() {
  const [tab, setTab] = useState<Tab>("live");
  const [filters, setFilters] = useState<MapFilterValue>(EMPTY_MAP_FILTERS);

  // --- Real data from Supabase ---
  const { data: stores } = useSupabaseQuery(fetchStores, []);
  const { data: roster } = useSupabaseQuery(fetchMerchandisers, []);

  const [positions, setPositions] = useState<LivePosition[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const p = await fetchLivePositions();
        if (active) setPositions(p);
      } catch { /* silencioso: el mapa muestra vacío */ }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const activeCount = positions.length;

  // Map LivePosition → MapMerchandiser shape expected by the marker layer
  // (sólo activos: son los que tienen posición real para dibujar un marcador).
  const merchandisers = useMemo<MapMerchandiser[]>(
    () => positions.map((p) => ({
      id: p.user_id,
      name: p.full_name,
      status: "active" as const,
      lat: p.lat,
      lng: p.lng,
    })),
    [positions],
  );

  // Lista del FILTRO: roster completo (los 5), marcando activo/inactivo según
  // quién tiene posición en vivo. Si por algo falla el roster, cae a los activos.
  const filterMerchandisers = useMemo<MapMerchandiser[]>(() => {
    const livePos = new Map(positions.map((p) => [p.user_id, p]));
    const base = (roster ?? []).map((m) => {
      const live = livePos.get(m.user_id);
      return {
        id: m.user_id,
        name: m.full_name,
        status: (live ? "active" : "offline") as "active" | "offline",
        lat: live?.lat ?? 0,
        lng: live?.lng ?? 0,
      };
    });
    // Mercaderistas activos que no estén en el roster (defensa) se agregan igual.
    for (const p of positions) {
      if (!base.some((b) => b.id === p.user_id)) {
        base.push({ id: p.user_id, name: p.full_name, status: "active", lat: p.lat, lng: p.lng });
      }
    }
    return base.length > 0 ? base : merchandisers;
  }, [roster, positions, merchandisers]);

  const safeStores = stores ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: "12px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800 }}>Mapa</h1>
        <p className="text-muted text-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}><Activity size={13} /> {activeCount} mercaderistas activos</p>
      </div>

      <div style={{ display: "flex", gap: "14px", flex: 1, minHeight: 0 }}>
        <MapFilterSidebar
          value={filters}
          onChange={setFilters}
          stores={safeStores}
          merchandisers={filterMerchandisers}
        />

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "3px", width: "fit-content" }}>
            {([["live", "En vivo", Radio], ["history", "Histórico", History]] as [Tab, string, React.ElementType][]).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                border: "none", borderRadius: "calc(var(--radius-md) - 2px)", padding: "7px 16px",
                fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: tab === key ? "var(--bg-surface)" : "transparent",
                color: tab === key ? "var(--text-primary)" : "var(--text-muted)",
                display: "flex", alignItems: "center", gap: "6px",
              }}><Icon size={14} /> {label}</button>
            ))}
          </div>

          <div style={{ flex: 1, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", background: "#f8fafc", position: "relative" }}>
            <AnimatePresence mode="wait">
              <motion.div key={tab}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                style={{ width: "100%", height: "100%" }}>
                {tab === "live"
                  ? <MapLiveView filters={filters} stores={safeStores} merchandisers={merchandisers} />
                  : <MapHistoryView filters={filters} stores={safeStores} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
