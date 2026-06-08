import { getSupabaseBrowser } from "../supabase/client";
import type { Store } from "../types";

// Validación pura de coordenadas (lat [-90,90], lng [-180,180], finitas).
export function validateCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function updateStore(storeId: string, patch: Partial<Store>): Promise<{ error: string | null }> {
  if (patch.master_lat != null && patch.master_lng != null &&
      !validateCoords(patch.master_lat, patch.master_lng)) {
    return { error: "Coordenadas fuera de rango." };
  }
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("stores").update({
    name: patch.name,
    address: patch.address ?? null,
    estado: patch.estado ?? null,
    municipio: patch.municipio ?? null,
    urbanizacion: patch.urbanizacion ?? null,
    business_channel: patch.business_channel ?? null,
    classification: patch.classification ?? null,
    master_lat: patch.master_lat,
    master_lng: patch.master_lng,
    active: patch.active,
  }).eq("store_id", storeId);
  return { error: error?.message ?? null };
}

export async function deactivateStore(storeId: string): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("stores").update({ active: false }).eq("store_id", storeId);
  return { error: error?.message ?? null };
}
