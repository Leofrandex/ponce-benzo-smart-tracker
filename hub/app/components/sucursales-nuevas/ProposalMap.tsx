"use client";

import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LIGHT_TILE_URL, LIGHT_TILE_ATTRIBUTION, CARACAS_CENTER } from "@/app/components/mapa/tiles";

export interface MapPoint { id: string; lat: number; lng: number; label: string; kind: "propuesta" | "existente" }

function pin(kind: MapPoint["kind"], selected: boolean): L.DivIcon {
  const color = kind === "propuesta" ? "#ea580c" : "#64748b";
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "proposal-marker",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

export default function ProposalMap({ points, selectedId, onSelect, draggable = false, onMove }: {
  points: MapPoint[]; selectedId: string | null; onSelect?: (id: string) => void;
  draggable?: boolean; onMove?: (lat: number, lng: number) => void;
}) {
  const sel = points.find((p) => p.id === selectedId);
  const center: [number, number] = sel ? [sel.lat, sel.lng] : points[0] ? [points[0].lat, points[0].lng] : CARACAS_CENTER;
  return (
    <MapContainer key={`${center[0]},${center[1]}`} center={center} zoom={sel ? 17 : 12}
      style={{ width: "100%", height: "100%", minHeight: 280, borderRadius: "var(--radius-md)", zIndex: 1 }}>
      <TileLayer url={LIGHT_TILE_URL} attribution={LIGHT_TILE_ATTRIBUTION} />
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p.kind, p.id === selectedId)}
          draggable={draggable && p.id === selectedId}
          eventHandlers={{
            click: () => onSelect?.(p.id),
            dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onMove?.(ll.lat, ll.lng); },
          }}>
          <Tooltip>{p.label}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
