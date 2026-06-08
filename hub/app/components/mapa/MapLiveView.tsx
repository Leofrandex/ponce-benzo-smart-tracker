"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { MerchandiserMarkersLayer } from "./MerchandiserMarkersLayer";
import type { MapFilterValue } from "./MapFilterSidebar";
import type { Store } from "@/app/lib/types";
import type { MapMerchandiser } from "@/app/lib/map-data";

interface MapLiveViewProps {
  filters: MapFilterValue;
  stores: Store[];
  merchandisers: MapMerchandiser[];
}

export default function MapLiveView({ filters, stores, merchandisers }: MapLiveViewProps) {
  const filteredStores = useMemo(
    () => filters.storeIds.length === 0 ? stores : stores.filter((s) => filters.storeIds.includes(s.store_id)),
    [stores, filters.storeIds],
  );
  const filteredMerchandisers = useMemo(
    () => filters.merchIds.length === 0 ? merchandisers : merchandisers.filter((m) => filters.merchIds.includes(m.id)),
    [merchandisers, filters.merchIds],
  );

  return (
    <MapContainer center={CARACAS_CENTER} zoom={13} style={{ width: "100%", height: "100%", zIndex: 1 }} zoomControl={false}>
      <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
      <StoreMarkersLayer stores={filteredStores} />
      <MerchandiserMarkersLayer merchandisers={filteredMerchandisers} />
    </MapContainer>
  );
}
