"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import { mockStores } from "@/app/lib/mock-data";
import { getPingsInRange } from "@/app/lib/map-data";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import type { MapFilterValue } from "./MapFilters";

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function MapHistoryView({ filters }: { filters: MapFilterValue }) {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));

  const stores = useMemo(() => filters.storeIds.length === 0 ? mockStores : mockStores.filter((s) => filters.storeIds.includes(s.store_id)), [filters.storeIds]);
  const points = useMemo(
    () => getPingsInRange(filters.merchIds, new Date(from + "T00:00:00"), new Date(to + "T23:59:59")),
    [filters.merchIds, from, to],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          Desde <input type="date" className="form-input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto", padding: "6px 8px" }} />
        </label>
        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          Hasta <input type="date" className="form-input" value={to} min={from} max={isoDaysAgo(0)} onChange={(e) => setTo(e.target.value)} style={{ width: "auto", padding: "6px 8px" }} />
        </label>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>{points.length} puntos GPS</span>
      </div>
      <div style={{ flex: 1, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)" }}>
        <MapContainer center={CARACAS_CENTER} zoom={13} style={{ width: "100%", height: "100%", zIndex: 1 }} zoomControl={false}>
          <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
          <StoreMarkersLayer stores={stores} />
          <HeatmapLayer points={points} />
        </MapContainer>
      </div>
    </div>
  );
}
