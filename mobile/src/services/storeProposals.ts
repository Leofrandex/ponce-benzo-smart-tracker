import { haversineMeters } from '../utils/geo';

// Sucursales nuevas registradas desde la app (Spec 2026-10-14).
export const DUPLICATE_RADIUS_M = 100;
export const WEAK_ACCURACY_M = 50;
export const GPS_TIMEOUT_MS = 20_000;

/** Sucursales del catálogo a menos de `radiusM` del punto, de la más cercana a la más lejana. */
export function nearbyStores<T extends { master_lat: number; master_lng: number }>(
  stores: T[], lat: number, lng: number, radiusM = DUPLICATE_RADIUS_M,
): Array<T & { distance_m: number }> {
  return stores
    .map((s) => ({ ...s, distance_m: haversineMeters(lat, lng, s.master_lat, s.master_lng) }))
    .filter((s) => s.distance_m <= radiusM)
    .sort((a, b) => a.distance_m - b.distance_m);
}

/** Precisión desconocida o peor que 50 m: se avisa, pero se deja guardar. */
export function isWeakAccuracy(accuracyM: number | null): boolean {
  return accuracyM == null || accuracyM > WEAK_ACCURACY_M;
}

export function canSaveProposal(d: { name: string; lat: number | null; lng: number | null }): boolean {
  return d.name.trim().length > 0 && d.lat != null && d.lng != null;
}
