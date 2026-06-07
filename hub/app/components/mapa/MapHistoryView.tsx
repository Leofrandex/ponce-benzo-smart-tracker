"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import { mockStores } from "@/app/lib/mock-data";
import { getPingsInRange } from "@/app/lib/map-data";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import { DateRangeChips, presetRange, type DateRange } from "./DateRangeChips";
import type { MapFilterValue } from "./MapFilterSidebar";

export default function MapHistoryView({ filters }: { filters: MapFilterValue }) {
  const [range, setRange] = useState<DateRange>(() => presetRange("7d"));

  const stores = useMemo(() => filters.storeIds.length === 0 ? mockStores : mockStores.filter((s) => filters.storeIds.includes(s.store_id)), [filters.storeIds]);
  const points = useMemo(
    () => getPingsInRange(filters.merchIds, new Date(range.from + "T00:00:00"), new Date(range.to + "T23:59:59")),
    [filters.merchIds, range],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px", padding: "10px" }}>
      <DateRangeChips range={range} onChange={setRange} />
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
