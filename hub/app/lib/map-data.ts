// Mock data specific to the map feature.
import { mockStores } from "./mock-data";

export interface MapMerchandiser {
  id: string;
  name: string;
  status: "active" | "offline";
  lat: number;
  lng: number;
}

// Active/offline merchandisers with a last-known position (clustered around the stores).
export const mockActiveMerchandisers: MapMerchandiser[] = [
  { id: "merc-001", name: "Carlos Rodríguez", status: "active",  lat: 10.4929, lng: -66.8534 },
  { id: "merc-002", name: "Luis Pérez",       status: "active",  lat: 10.4788, lng: -66.8555 },
  { id: "merc-003", name: "María González",   status: "active",  lat: 10.4994, lng: -66.8439 },
  { id: "merc-004", name: "Andrés Ramírez",   status: "offline", lat: 10.5041, lng: -66.8298 },
];

// Deterministic pseudo-random so renders are stable across reloads.
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Generate GPS heat points for the given merchandisers within [from, to].
// Each store is "covered" by one merchandiser (round-robin over the full roster);
// when merchIds is non-empty, only stores covered by a selected merchandiser produce pings.
export function getPingsInRange(merchIds: string[], from: Date, to: Date): [number, number][] {
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return [];
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const allIds = mockActiveMerchandisers.map((m) => m.id);
  const selected = merchIds.length > 0 ? merchIds : allIds;
  const rand = seeded(days * 31 + selected.length * 7 + from.getDate());
  const points: [number, number][] = [];
  mockStores.forEach((store, idx) => {
    // Each store is covered by one merchandiser (round-robin over the full roster).
    const coveringMerch = allIds[idx % allIds.length];
    if (!selected.includes(coveringMerch)) return;
    const visitsPerDay = 4 + Math.floor(rand() * 6); // 4-9 pings per day per store
    const total = Math.min(60, Math.round((visitsPerDay * days) / 3));
    for (let i = 0; i < total; i++) {
      points.push([
        store.master_lat + (rand() - 0.5) * 0.004,
        store.master_lng + (rand() - 0.5) * 0.004,
      ]);
    }
  });
  return points;
}
