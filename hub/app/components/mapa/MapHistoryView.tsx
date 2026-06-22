"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import { DateRangeChips, presetRange, type DateRange } from "./DateRangeChips";
import { fetchHeatPoints } from "@/app/lib/queries/sessions";
import type { MapFilterValue } from "./MapFilterSidebar";
import type { Store } from "@/app/lib/types";

interface MapHistoryViewProps {
  filters: MapFilterValue;
  stores: Store[];
}

export default function MapHistoryView({ filters, stores }: MapHistoryViewProps) {
  const [range, setRange] = useState<DateRange>(() => presetRange("7d"));

  const filteredStores = useMemo(
    () => filters.storeIds.length === 0 ? stores : stores.filter((s) => filters.storeIds.includes(s.store_id)),
    [stores, filters.storeIds],
  );

  // Puntos de calor reales desde location_pings, según rango + mercaderistas filtrados.
  const [points, setPoints] = useState<[number, number][]>([]);
  useEffect(() => {
    let active = true;
    fetchHeatPoints(range.from, range.to, filters.merchIds)
      .then((p) => { if (active) setPoints(p); })
      .catch(() => { if (active) setPoints([]); });
    return () => { active = false; };
  }, [range.from, range.to, filters.merchIds]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px", padding: "10px" }}>
      <DateRangeChips range={range} onChange={setRange} />
      <div style={{ flex: 1, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)" }}>
        <MapContainer center={CARACAS_CENTER} zoom={13} style={{ width: "100%", height: "100%", zIndex: 1 }} zoomControl={false}>
          <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
          <StoreMarkersLayer stores={filteredStores} />
          <HeatmapLayer points={points} />
        </MapContainer>
      </div>
    </div>
  );
}
