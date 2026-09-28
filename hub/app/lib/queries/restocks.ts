import { getSupabaseBrowser } from "../supabase/client";

export type RestockSource = "app" | "panel";

export const ORIGEN_LABEL: Record<RestockSource, string> = { app: "App", panel: "Panel" };

export type RestockProduct = { product_id: string; name: string; brand: string | null };

export type RestockRow = {
  restock_id: string;
  restock_date: string;       // YYYY-MM-DD
  source: RestockSource;
  note: string | null;
  created_by: string | null;
  autor: string | null;
  productos: RestockProduct[];
};

export type RawRestock = {
  restock_id: string;
  restock_date: string;
  source: RestockSource;
  note: string | null;
  created_by: string | null;
  users: { full_name: string | null } | null;
  restock_products: { products: RestockProduct | null }[] | null;
};

export function mapRestockRows(raw: RawRestock[]): RestockRow[] {
  return raw.map((r) => ({
    restock_id: r.restock_id,
    restock_date: r.restock_date,
    source: r.source,
    note: r.note,
    created_by: r.created_by,
    autor: r.users?.full_name ?? null,
    productos: (r.restock_products ?? [])
      .map((rp) => rp.products)
      .filter((p): p is RestockProduct => !!p)
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  }));
}

export function ultimaReposicion(rows: RestockRow[]): string | null {
  return rows.reduce<string | null>((max, r) => (max === null || r.restock_date > max ? r.restock_date : max), null);
}

export function haceTexto(dias: number): string {
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

export function validarFechaReposicion(fecha: string, hoy: string): string | null {
  if (!fecha) return "Elige la fecha de la reposición.";
  if (fecha > hoy) return "La fecha no puede ser posterior a hoy.";
  return null;
}

export function mensajeError(msg: string): string {
  if (msg.includes("row-level security")) return "No tienes permiso para registrar reposiciones en esta tienda.";
  if (msg.includes("fecha_futura")) return "La fecha no puede ser posterior a hoy.";
  if (msg.includes("foreign key")) return "Uno de los productos ya no está en el catálogo. Recarga la página e inténtalo de nuevo.";
  return msg;
}

// Más reciente primero. Una tienda tiene decenas de reposiciones, no miles: sin paginar.
export async function fetchStoreRestocks(storeId: string): Promise<RestockRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("restocks")
    .select("restock_id, restock_date, source, note, created_by, users(full_name), restock_products(products(product_id, name, brand))")
    .eq("store_id", storeId)
    .order("restock_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return mapRestockRows((data ?? []) as unknown as RawRestock[]);
}
