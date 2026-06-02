"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { MapMerchandiser } from "@/app/lib/map-data";

function merchIcon(active: boolean): L.DivIcon {
  const color = active ? "#dc2626" : "#94a3b8";
  const pulse = active ? `<span class="merch-pulse" style="background:${color};"></span>` : "";
  return L.divIcon({
    className: "merch-marker",
    html: `<div class="merch-dot" style="background:${color};">${pulse}</div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
}

export function MerchandiserMarkersLayer({ merchandisers }: { merchandisers: MapMerchandiser[] }) {
  return (
    <>
      {merchandisers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={merchIcon(m.status === "active")}>
          <Popup><strong>{m.name}</strong><br />{m.status === "active" ? "Activo ahora" : "Desconectado"}</Popup>
        </Marker>
      ))}
    </>
  );
}
