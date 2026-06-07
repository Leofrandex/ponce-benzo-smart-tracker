"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { MapMerchandiser } from "@/app/lib/map-data";

const USER_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`;

function merchIcon(active: boolean): L.DivIcon {
  const color = active ? "#00205C" : "#94a3b8";
  const pulse = active ? `<span class="merch-pulse" style="background:${color};"></span>` : "";
  return L.divIcon({
    className: "merch-marker",
    html: `<div class="merch-dot" style="background:${color};">${pulse}${USER_SVG}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
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
