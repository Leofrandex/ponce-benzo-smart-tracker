import { getSupabaseBrowser } from "../supabase/client";
import { normalizeText } from "./taskFilters";

export type CatalogProduct = {
  product_id: string; sku: string; name: string; brand: string | null; line: string | null; active: boolean;
};

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("products").select("product_id, sku, name, brand, line, active").order("name");
  if (error) throw error;
  return (data ?? []) as CatalogProduct[];
}

// Una línea se escribe a mano: "vitaminas", "Vitaminas " y "VITAMINAS" deben
// quedar como la misma línea ya existente, no crear tres distintas.
export function normalizeLine(input: string, existing: string[]): string | null {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const key = normalizeText(clean);
  return existing.find((e) => normalizeText(e) === key) ?? clean;
}

export function lineSuggestions(products: CatalogProduct[]): string[] {
  return Array.from(new Set(products.map((p) => p.line).filter((l): l is string => !!l)))
    .sort((a, b) => a.localeCompare(b, "es"));
}

export function filterCatalog(products: CatalogProduct[], q: string, soloSinLinea: boolean): CatalogProduct[] {
  const k = normalizeText(q);
  return products.filter((p) => {
    if (soloSinLinea && p.line) return false;
    if (!k) return true;
    return [p.name, p.sku, p.brand].some((s) => normalizeText(s).includes(k));
  });
}
