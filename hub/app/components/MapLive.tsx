"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Create custom icon to avoid default missing icon issues in Next.js
const customIcon = L.divIcon({
  className: "custom-gps-marker",
  html: `<div style="background-color: var(--accent-light, #3b82f6); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface TracerPoint {
  lat: number;
  lng: number;
  ts: string;
}

interface MapLiveProps {
  currentLocation: TracerPoint;
  history: TracerPoint[];
  name: string;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export default function MapLive({ currentLocation, history, name }: MapLiveProps) {
  const positions: [number, number][] = history.map(h => [h.lat, h.lng]);
  // ensure current location is also in path
  if (currentLocation) {
      positions.push([currentLocation.lat, currentLocation.lng]);
  }
  
  // Default fallback if no valid coordinates
  const center: [number, number] = currentLocation ? [currentLocation.lat, currentLocation.lng] : [10.4806, -66.9036];

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer 
        center={center} 
        zoom={16} 
        style={{ width: "100%", height: "100%", zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; <a href='https://carto.com/'>CARTO</a>"
        />
        {positions.length > 0 && (
          <Polyline positions={positions} color="var(--accent-light, #3b82f6)" weight={3} dashArray="5, 10" />
        )}
        {currentLocation && (
          <Marker position={[currentLocation.lat, currentLocation.lng]} icon={customIcon}>
            <Popup>{name} - {new Date(currentLocation.ts).toLocaleTimeString()}</Popup>
          </Marker>
        )}
        {currentLocation && <Recenter lat={currentLocation.lat} lng={currentLocation.lng} />}
      </MapContainer>
    </div>
  );
}
