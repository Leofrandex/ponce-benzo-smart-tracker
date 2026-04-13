"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// leaflet.heat is a legacy non-module IIFE. Import it dynamically inside
// useEffect to avoid module-evaluation failures in the Next.js bundler.

interface MapHistoryProps {
  points: [number, number][];
}

function HeatmapLayer({ points }: { points: [number, number][] }) {
  const map = useMap();
  // Keep a ref to the heat layer so cleanup can remove it even if the
  // dynamic import resolves after the component unmounts.
  const heatLayerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!map || points.length === 0) return;

    let cancelled = false;

    import("leaflet.heat").then(() => {
      if (cancelled) return;

      const heatData = points.map((p) => [...p, 1] as [number, number, number]);

      // @ts-ignore — leaflet.heat extends L with heatLayer
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 20,
        blur: 15,
        maxZoom: 15,
        gradient: { 0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red" },
      }).addTo(map);

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    });

    return () => {
      cancelled = true;
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current as L.Layer);
        heatLayerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

export default function MapHistory({ points }: MapHistoryProps) {
  if (!points || points.length === 0) return null;
  const center = points[0];

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ width: "100%", height: "100%", zIndex: 1 }}
        zoomControl={false}
      >
         <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; <a href='https://carto.com/'>CARTO</a>"
        />
        <HeatmapLayer points={points} />
      </MapContainer>
    </div>
  );
}
