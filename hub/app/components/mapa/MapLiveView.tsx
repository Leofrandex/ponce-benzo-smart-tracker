"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { mockStores } from "@/app/lib/mock-data";
import { mockActiveMerchandisers } from "@/app/lib/map-data";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { MerchandiserMarkersLayer } from "./MerchandiserMarkersLayer";
import type { MapFilterValue } from "./MapFilterSidebar";

export default function MapLiveView({ filters }: { filters: MapFilterValue }) {
  const stores = useMemo(() => filters.storeIds.length === 0 ? mockStores : mockStores.filter((s) => filters.storeIds.includes(s.store_id)), [filters.storeIds]);
  const merchandisers = useMemo(() => filters.merchIds.length === 0 ? mockActiveMerchandisers : mockActiveMerchandisers.filter((m) => filters.merchIds.includes(m.id)), [filters.merchIds]);

  return (
    <MapContainer center={CARACAS_CENTER} zoom={13} style={{ width: "100%", height: "100%", zIndex: 1 }} zoomControl={false}>
      <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
      <StoreMarkersLayer stores={stores} />
      <MerchandiserMarkersLayer merchandisers={merchandisers} />
    </MapContainer>
  );
}
