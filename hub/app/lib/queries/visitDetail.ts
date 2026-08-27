import { getSupabaseBrowser } from "../supabase/client";
import { signedPhotoUrls } from "./photos";
import type { AnomalyType } from "../types";

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  sin_stock: "Sin stock",
  cambio_planograma: "Cambio de planograma",
  diferencia_precios: "Diferencia de precios",
  producto_danado: "Producto dañado",
  otro: "Otro",
};

export function anomalyLabel(a: string): string {
  return ANOMALY_LABELS[a as AnomalyType] ?? a.replace(/_/g, " ");
}

export interface VisitDetail {
  visit_id: string;
  store_id: string;
  store_name: string | null;
  merchandiser_name: string | null;
  check_in_time: string;
  status: "completed" | "skipped" | "anomaly";
  anomaly_type: AnomalyType[] | null;
  /** Nombres de producto por tipo de anomalía. Una anomalía sin productos no aparece. */
  products_by_anomaly: Record<string, string[]>;
  supervisor_name: string | null;
  observations: string | null;
  photo_urls: string[]; // ya firmadas, listas para <img>
}

interface VisitDetailJoin {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  status: "completed" | "skipped" | "anomaly";
  anomaly_type: AnomalyType[] | null;
  observations: string | null;
  photo_urls: string[] | null;
  users: { full_name: string | null } | null;
  supervisor: { full_name: string | null } | null;
  stores: { name: string | null } | null;
  visit_anomaly_products: { anomaly_type: string; products: { name: string | null } | null }[] | null;
}

// Detalle de la visita origen de una tarea (anomalía reportada). Firma las fotos
// del bucket privado `visit-photos` igual que fetchStoreReports.
export async function fetchVisitDetail(visitId: string): Promise<VisitDetail | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("visits")
    .select(
      "visit_id, store_id, check_in_time, status, anomaly_type, observations, photo_urls, " +
        "users:users!visits_user_id_fkey(full_name), stores(name), " +
        "supervisor:users!visits_supervisor_present_user_id_fkey(full_name), " +
        "visit_anomaly_products(anomaly_type, products(name))",
    )
    .eq("visit_id", visitId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const v = data as unknown as VisitDetailJoin;
  const photoUrls = await signedPhotoUrls(v.photo_urls ?? []);

  // Agrupado por tipo de anomalía: es la granularidad con la que se capturó.
  const productsByAnomaly: Record<string, string[]> = {};
  for (const link of v.visit_anomaly_products ?? []) {
    const nombre = link.products?.name;
    if (!nombre) continue;
    (productsByAnomaly[link.anomaly_type] ??= []).push(nombre);
  }

  return {
    visit_id: v.visit_id,
    store_id: v.store_id,
    store_name: v.stores?.name ?? null,
    merchandiser_name: v.users?.full_name ?? null,
    check_in_time: v.check_in_time,
    status: v.status,
    anomaly_type: v.anomaly_type,
    products_by_anomaly: productsByAnomaly,
    supervisor_name: v.supervisor?.full_name ?? null,
    observations: v.observations,
    photo_urls: photoUrls,
  };
}
