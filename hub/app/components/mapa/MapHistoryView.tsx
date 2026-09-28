"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import { DateRangeChips, presetRange, type DateRange } from "./DateRangeChips";
import { fetchHeatPoints } from "@/app/lib/queries/sessions";
import { aplicar, type MapFilterValue } from "@/app/lib/queries/mapFilters";
import type { Store } from "@/app/lib/types";

interface MapHistoryViewProps {
  filters: MapFilterValue;
  stores: Store[];
}

export default function MapHistoryView({ filters, stores }: MapHistoryViewProps) {
  const [range, setRange] = useState<DateRange>(() => presetRange("7d"));

  const filteredStores = useMemo(
    () => aplicar(stores, filters.tiendas, (s) => s.store_id),
    [stores, filters.tiendas],
  );

  // Puntos de calor reales desde location_pings, según rango + mercaderistas filtrados.
  const [points, setPoints] = useState<[number, number][]>([]);
  useEffect(() => {
    let active = true;
    // Selección vacía = ningún mercaderista: no se piden puntos (para
    // fetchHeatPoints una lista vacía significa "todos").
    if (filters.merch.modo === "seleccion" && filters.merch.ids.length === 0) { setPoints([]); return; }
    const ids = filters.merch.modo === "todas" ? [] : filters.merch.ids;
    fetchHeatPoints(range.from, range.to, ids)
      .then((p) => { if (active) setPoints(p); })
      .catch(() => { if (active) setPoints([]); });
    return () => { active = false; };
  }, [range.from, range.to, filters.merch]);

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
