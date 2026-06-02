"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export function HeatmapLayer({ points }: { points: [number, number][] }) {
  const map = useMap();
  const layerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    if (points.length === 0) {
      if (layerRef.current) { map.removeLayer(layerRef.current as L.Layer); layerRef.current = null; }
      return;
    }
    import("leaflet.heat").then(() => {
      if (cancelled) return;
      if (layerRef.current) { map.removeLayer(layerRef.current as L.Layer); layerRef.current = null; }
      const heatData = points.map((p) => [...p, 1] as [number, number, number]);
      // @ts-ignore — leaflet.heat extends L
      layerRef.current = L.heatLayer(heatData, {
        radius: 22, blur: 18, maxZoom: 15,
        gradient: { 0.2: "#3b82f6", 0.4: "#22d3ee", 0.6: "#a3e635", 0.8: "#f59e0b", 1.0: "#ef4444" },
      }).addTo(map);
    });
    return () => {
      cancelled = true;
      if (layerRef.current) { map.removeLayer(layerRef.current as L.Layer); layerRef.current = null; }
    };
  }, [map, points]);

  return null;
}
