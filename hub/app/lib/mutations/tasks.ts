import { getSupabaseBrowser } from "../supabase/client";

export async function resolveTask(taskId: string): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("tasks").update({ status: "resolved" }).eq("task_id", taskId);
  return { error: error?.message ?? null };
}
