import { getSupabaseBrowser } from "../supabase/client";
import type { ContactEngagement } from "../types";

export async function createEngagement(
  storeId: string, type: "note" | "todo", body: string,
): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const { error } = await sb.from("contact_engagements").insert({
    store_id: storeId,
    contact_id: null,
    author_user_id: auth.user?.id ?? null,
    type,
    body,
    status: type === "todo" ? "open" : null,
    due_date: null,
  });
  return { error: error?.message ?? null };
}

export async function toggleEngagementDone(e: ContactEngagement): Promise<{ error: string | null }> {
  if (e.type !== "todo") return { error: null };
  const sb = getSupabaseBrowser();
  const next = e.status === "done" ? "open" : "done";
  const { error } = await sb.from("contact_engagements").update({ status: next }).eq("engagement_id", e.engagement_id);
  return { error: error?.message ?? null };
}
