"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "./tiles";
import { StoreMarkersLayer } from "./StoreMarkersLayer";
import { MerchandiserMarkersLayer } from "./MerchandiserMarkersLayer";
import { aplicar, type MapFilterValue } from "@/app/lib/queries/mapFilters";
import type { Store } from "@/app/lib/types";
import type { MapMerchandiser } from "@/app/lib/map-data";

interface MapLiveViewProps {
  filters: MapFilterValue;
  stores: Store[];
  merchandisers: MapMerchandiser[];
}

export default function MapLiveView({ filters, stores, merchandisers }: MapLiveViewProps) {
  const filteredStores = useMemo(
    () => aplicar(stores, filters.tiendas, (s) => s.store_id),
    [stores, filters.tiendas],
  );
  const filteredMerchandisers = useMemo(
    () => aplicar(merchandisers, filters.merch, (m) => m.id),
    [merchandisers, filters.merch],
  );

  return (
    <MapContainer center={CARACAS_CENTER} zoom={13} style={{ width: "100%", height: "100%", zIndex: 1 }} zoomControl={false}>
      <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
      <StoreMarkersLayer stores={filteredStores} />
      <MerchandiserMarkersLayer merchandisers={filteredMerchandisers} />
    </MapContainer>
  );
}
