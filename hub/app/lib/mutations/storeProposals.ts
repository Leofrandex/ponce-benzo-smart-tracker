import { getSupabaseBrowser } from "../supabase/client";
import { reviewErrorMessage, validateStoreDraft, type StoreDraft } from "../storeProposals";

export async function approveProposal(id: string, d: StoreDraft): Promise<{ storeId: string | null; error: string | null }> {
  const invalid = validateStoreDraft(d);
  if (invalid) return { storeId: null, error: invalid };
  const { data, error } = await getSupabaseBrowser().rpc("fn_aprobar_propuesta", { p_proposal_id: id, p_store: d });
  if (error) return { storeId: null, error: reviewErrorMessage(error.message) };
  return { storeId: data as string, error: null };
}

export async function rejectProposal(
  id: string, reason: string, duplicateOf: string | null = null,
  fixGps: { lat: number; lng: number } | null = null,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseBrowser().rpc("fn_rechazar_propuesta", {
    p_proposal_id: id, p_reason: reason, p_duplicate_of: duplicateOf, p_fix_lat: fixGps?.lat ?? null, p_fix_lng: fixGps?.lng ?? null,
  });
  return { error: error ? reviewErrorMessage(error.message) : null };
}
