"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Store } from "@/app/lib/types";

const CHANNEL_COLOR: Record<string, string> = {
  farmacia: "#2563eb", supermercado: "#16a34a", drogueria: "#9333ea",
  autoservicio: "#ea580c", mayorista: "#0891b2", otro: "#64748b",
};

const STORE_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>`;

function storeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "store-marker",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">${STORE_SVG}</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
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
