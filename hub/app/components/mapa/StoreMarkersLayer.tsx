"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Store } from "@/app/lib/types";

const CHANNEL_COLOR: Record<string, string> = {
  farmacia: "#2563eb", supermercado: "#16a34a", drogueria: "#9333ea",
  autoservicio: "#ea580c", mayorista: "#0891b2", otro: "#64748b",
};

function storeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "store-marker",
    html: `<div style="width:11px;height:11px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [11, 11], iconAnchor: [6, 6],
  });
}

export function StoreMarkersLayer({ stores }: { stores: Store[] }) {
  return (
    <>
      {stores.map((s) => (
        <Marker key={s.store_id} position={[s.master_lat, s.master_lng]}
          icon={storeIcon(s.business_channel ? (CHANNEL_COLOR[s.business_channel] ?? CHANNEL_COLOR.otro) : CHANNEL_COLOR.otro)}>
          <Popup>
            <strong>{s.name}</strong><br />
            {s.business_channel ?? "—"}{s.classification ? ` · ${s.classification}` : ""}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
