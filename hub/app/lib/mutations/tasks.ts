import { getSupabaseBrowser } from "../supabase/client";

// El comentario de cierre es opcional: `null` significa "sin comentario" y no
// escribe autor ni fecha de nota, para no ensuciar la trazabilidad con firmas
// de notas vacías.
export async function resolveTask(
  taskId: string,
  note?: string | null,
): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id ?? null;
  const limpio = note?.trim() ? note.trim() : null;
  const now = new Date().toISOString();

  const { error } = await sb
    .from("tasks")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by: userId,
      ...(limpio
        ? { resolution_note: limpio, resolution_note_by: userId, resolution_note_at: now }
        : {}),
    })
    .eq("task_id", taskId);
  return { error: error?.message ?? null };
}

// Alta o edición del comentario en una tarea ya completada. Vaciar el campo
// borra la nota junto con su firma (autor + fecha).
export async function updateTaskNote(
  taskId: string,
  note: string,
): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const limpio = note.trim();

  const { error } = await sb
    .from("tasks")
    .update(
      limpio
        ? {
            resolution_note: limpio,
            resolution_note_by: auth.user?.id ?? null,
            resolution_note_at: new Date().toISOString(),
          }
        : { resolution_note: null, resolution_note_by: null, resolution_note_at: null },
    )
    .eq("task_id", taskId);
  return { error: error?.message ?? null };
}
