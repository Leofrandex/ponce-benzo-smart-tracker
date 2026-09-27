import { getSupabaseBrowser } from "../supabase/client";

// Solo línea y activo. RLS (products_write_admin) rechaza a quien no es admin.
export async function updateProduct(
  productId: string, patch: { line?: string | null; active?: boolean },
): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("products").update(patch).eq("product_id", productId);
  return { error: error?.message ?? null };
}
