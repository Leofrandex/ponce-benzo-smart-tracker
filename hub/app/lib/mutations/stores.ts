import { getSupabaseBrowser } from "../supabase/client";
import type { Store, TiendaInput } from "../types";

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

// 23505 = unique_violation: en el alta de tienda solo puede ser pdv_code repetido.
export function mensajeErrorAltaTienda(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "Ya existe una tienda con ese código PDV." : error.message;
}

const opc = (s?: string) => s?.trim() || null;

export async function createStore(input: TiendaInput): Promise<{ error: string | null; store_id?: string }> {
  const lat = input.master_lat ?? null;
  const lng = input.master_lng ?? null;
  if ((lat == null) !== (lng == null)) return { error: "Indica latitud y longitud, o deja ambas vacías." };
  if (lat != null && lng != null && !validateCoords(lat, lng)) return { error: "Coordenadas fuera de rango." };
  const sb = getSupabaseBrowser();
  const row: Record<string, unknown> = {
    client_id: input.client_id,
    name: input.name.trim(),
    business_channel: input.business_channel,
    estado: input.estado.trim(),
    municipio: input.municipio.trim(),
    address: input.address.trim(),
    urbanizacion: opc(input.urbanizacion),
    ciudad: opc(input.ciudad),
    region: opc(input.region),
    master_lat: lat,
    master_lng: lng,
  };
  // Sin pdv_code la base asigna el siguiente (default fn_next_pdv).
  const pdv = opc(input.pdv_code);
  if (pdv) row.pdv_code = pdv.toUpperCase();
  const { data, error } = await sb.from("stores").insert(row).select("store_id").single();
  if (error) return { error: mensajeErrorAltaTienda(error) };
  return { error: null, store_id: data.store_id as string };
}
