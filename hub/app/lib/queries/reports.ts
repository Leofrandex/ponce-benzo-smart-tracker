import { getSupabaseBrowser } from "../supabase/client";
import type { SupervisorReport } from "../types";

// ── Reportes de competencia (por tienda) ─────────────────────────────────────

export interface StoreCompetitionReport {
  report_id: string;
  store_id: string;
  brand_name: string;
  activation_type: string | null;
  activation_label: string;
  merchandiser_name: string;
  notes: string | null;
  created_at: string;
  photo_urls: string[];  // ya firmadas, listas para <img>
}

const ACTIVATION_LABELS: Record<string, string> = {
  promocion: "Promoción",
  material_pop: "Material POP",
  espacios_exhibiciones: "Espacios / Exhibiciones",
  impulso_activacion: "Impulso / Activación",
  degustacion: "Degustación",
  otro: "Otro",
};

interface CompetitionJoinRow {
  report_id: string;
  store_id: string | null;
  activation_type: string | null;
  notes: string | null;
  created_at: string;
  photo_urls: string[] | null;
  competitor_brands: { name: string | null } | null;
  users: { full_name: string | null } | null;
}

// Reportes de competencia de una tienda, del más reciente al más antiguo.
export async function fetchStoreCompetition(storeId: string): Promise<StoreCompetitionReport[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("competition_reports")
    .select(
      "report_id, store_id, activation_type, notes, created_at, photo_urls, " +
        "competitor_brands(name), users(full_name)",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as CompetitionJoinRow[];

  // Mismo bucket privado que las visitas: hay que firmar las rutas de storage.
  const allPaths = Array.from(new Set(rows.flatMap((r) => r.photo_urls ?? [])));
  const signed = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signedData } = await sb.storage
      .from("visit-photos")
      .createSignedUrls(allPaths, 60 * 60); // 1 hora
    for (const s of signedData ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  return rows.map((r) => ({
    report_id: r.report_id,
    store_id: r.store_id ?? storeId,
    brand_name: r.competitor_brands?.name ?? "Marca no especificada",
    activation_type: r.activation_type,
    activation_label: r.activation_type ? (ACTIVATION_LABELS[r.activation_type] ?? r.activation_type) : "—",
    merchandiser_name: r.users?.full_name ?? "—",
    notes: r.notes,
    created_at: r.created_at,
    photo_urls: (r.photo_urls ?? []).map((p) => signed.get(p) ?? p),
  }));
}

const MAX_DISTANCE_METERS = 200;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface VisitJoinRow {
  visit_id: string;
  store_id: string;
  check_in_time: string;
  check_in_location: { lat: number; lng: number } | null;
  photo_urls: string[] | null;
  observations: string | null;
  status: "completed" | "skipped" | "anomaly";
  last_restock_date: string | null;
  users: { full_name: string | null } | null;
  stores: { name: string | null; address: string | null; master_lat: number | null; master_lng: number | null } | null;
}

// Reportes (check-ins/visitas) de una tienda, ordenados del más reciente al más antiguo.
export async function fetchStoreReports(storeId: string): Promise<SupervisorReport[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("visits")
    .select(
      "visit_id, store_id, check_in_time, check_in_location, photo_urls, observations, status, last_restock_date, " +
        "users(full_name), stores(name, address, master_lat, master_lng)",
    )
    .eq("store_id", storeId)
    .order("check_in_time", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as VisitJoinRow[];

  // El bucket `visit-photos` es privado: las visitas guardan rutas de storage,
  // no URLs. Hay que firmarlas para poder mostrarlas en <img>.
  const allPaths = Array.from(new Set(rows.flatMap((r) => r.photo_urls ?? [])));
  const signed = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signedData } = await sb.storage
      .from("visit-photos")
      .createSignedUrls(allPaths, 60 * 60); // 1 hora
    for (const s of signedData ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  return rows.map((v) => {
    const loc = v.check_in_location;
    const store = v.stores;
    const verified =
      loc != null && store?.master_lat != null && store?.master_lng != null
        ? haversineMeters(loc.lat, loc.lng, store.master_lat, store.master_lng) <= MAX_DISTANCE_METERS
        : false;
    return {
      visit_id: v.visit_id,
      store_id: v.store_id,
      store_name: store?.name ?? "",
      store_address: store?.address ?? "",
      client_name: "",
      merchandiser_name: v.users?.full_name ?? "—",
      check_in_time: v.check_in_time,
      duration_minutes: 0, // sin check-out en BD
      status: v.status,
      observations: v.observations ?? "",
      photos_count: v.photo_urls?.length ?? 0,
      location_verified: verified,
      tasks_count: 0,
      photo_urls: (v.photo_urls ?? []).map((p) => signed.get(p) ?? p),
      last_restock_date: v.last_restock_date,
    };
  });
}
