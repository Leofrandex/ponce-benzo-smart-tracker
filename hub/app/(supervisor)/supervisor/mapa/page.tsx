"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Map as MapIcon, Radio, History, Activity } from "lucide-react";
import { mockActiveMerchandisers } from "@/app/lib/map-data";
import { MapFilterSidebar, EMPTY_MAP_FILTERS, type MapFilterValue } from "@/app/components/mapa/MapFilterSidebar";

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
  const activeCount = mockActiveMerchandisers.filter((m) => m.status === "active").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: "12px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800 }}>Mapa</h1>
        <p className="text-muted text-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}><Activity size={13} /> {activeCount} mercaderistas activos</p>
      </div>

      <div style={{ display: "flex", gap: "14px", flex: 1, minHeight: 0 }}>
        <MapFilterSidebar value={filters} onChange={setFilters} />

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
                {tab === "live" ? <MapLiveView filters={filters} /> : <MapHistoryView filters={filters} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
