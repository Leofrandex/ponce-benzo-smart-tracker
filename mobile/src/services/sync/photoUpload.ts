import type { SupabaseClient } from "@supabase/supabase-js";
import { photoExists, photoSize } from "../photos/photoStore";
import { withDeadline } from "../../utils/withTimeout";

// Solo para la lectura local: list y upload ya los cancela timedFetch (60 s).
const LOCAL_READ_TIMEOUT_MS = 90_000;
const EMPTY_FILE_ATTEMPTS = 3;

export function storagePath(userId: string, ownerId: string, index: number): string {
  return `${userId}/${ownerId}/${index}.jpg`;
}

/** Texto de error apto para el log: corto, sin URLs firmadas ni tokens. */
export function shortError(e: unknown): string {
  const msg = (e as { message?: unknown } | null)?.message;
  return String(typeof msg === "string" ? msg : JSON.stringify(e))
    .replace(/https?:\/\/\S+|eyJ\S+/g, "<oculto>")
    .slice(0, 200);
}

export type PhotoResult = { listed: boolean; paths: string[]; missing: number[]; empty: number[]; failed: { index: number; error: string }[]; stopped: boolean };

/**
 * ¿La foto está en Storage? true/false si Storage lo confirmó, null si no se pudo saber.
 * Se consulta foto por foto y no con list(): la política de lectura se evalúa fila a fila y
 * list() agota el tiempo en producción (30 s por llamada), mientras que el nombre exacto usa índice.
 * Solo "Object not found" cuenta como ausente: un token vencido también responde 404 ("Bucket not found").
 */
async function isOnServer(supabase: SupabaseClient, path: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.storage.from("visit-photos").info(path);
    // Un objeto vacío no cuenta como subido: se vuelve a subir.
    if (data) return (data.size ?? 1) > 0;
    return (error as { message?: string } | null)?.message === "Object not found" ? false : null;
  } catch { return null; }
}

/**
 * Sube las fotos una a una; un fallo no frena a las demás. `paths` queda en orden de índice.
 * El primer intento sube directo (upsert: repetir no duplica); con `resume` (reintento o pasada
 * cortada a medias) pregunta antes para no volver a gastar datos en lo que ya está arriba.
 * Una foto solo es `missing` si el archivo no existe Y Storage confirmó que tampoco está:
 * sin confirmación queda en `failed` para reintentar.
 * Un archivo de 0 bytes cuenta igual, pero solo con `attempts` agotados y si el disco confirma
 * tamaño 0: la lectura vacía puede ser pasajera, y cerrar la fila borra el archivo.
 * Queda además en `empty`, para que el log lo distinga.
 * Con `shouldStop` no arranca más subidas y marca `stopped`; las fotos ya arriba se siguen
 * contando para que `paths` no pierda ninguna ya enlazada.
 * `listed` dice si se sabe el estado de TODAS las fotos: sin eso, escribir `paths` podría
 * quitar una foto ya enlazada.
 */
export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  ownerId: string,
  uris: string[],
  opts: { timeoutMs?: number; exists?: (uri: string) => Promise<boolean>; size?: (uri: string) => Promise<number>; onPhotoDone?: () => void | Promise<void>; shouldStop?: () => boolean; attempts?: number; resume?: boolean } = {},
): Promise<PhotoResult> {
  const { timeoutMs = LOCAL_READ_TIMEOUT_MS, exists = photoExists, size = photoSize, onPhotoDone, shouldStop, attempts = 0 } = opts;
  const resume = opts.resume ?? attempts > 0;
  const result: PhotoResult = { listed: true, paths: [], missing: [], empty: [], failed: [], stopped: false };
  const up = new Set<number>();
  const pending = new Set<number>(); // Sin subir en esta pasada: pueden estar arriba de antes.
  const markUp = async (i: number) => { up.add(i); pending.delete(i); await onPhotoDone?.(); };

  for (let i = 0; i < uris.length; i++) {
    const path = storagePath(userId, ownerId, i);
    let server: boolean | null | undefined;
    const onServer = async () => (server === undefined ? (server = await isOnServer(supabase, path)) : server);
    try {
      if (resume && (await onServer())) { await markUp(i); continue; }
      if (shouldStop?.()) { result.stopped = true; pending.add(i); continue; }
      if (!(await exists(uris[i]))) {
        const known = await onServer();
        if (known) await markUp(i);
        else if (known === false) result.missing.push(i);
        else { result.failed.push({ index: i, error: "archivo ausente y Storage sin confirmar" }); result.listed = false; }
        continue;
      }
      const res = await withDeadline(fetch(uris[i]), timeoutMs, `leer foto ${path}`);
      const buf = await withDeadline(res.arrayBuffer(), timeoutMs, `leer foto ${path}`);
      if (buf.byteLength === 0) {
        if (attempts >= EMPTY_FILE_ATTEMPTS && (await size(uris[i])) === 0 && (await onServer()) === false) { result.missing.push(i); result.empty.push(i); }
        else { result.failed.push({ index: i, error: "archivo de 0 bytes" }); pending.add(i); }
        continue;
      }
      const { error } = await supabase.storage.from("visit-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      await markUp(i);
    } catch (e) {
      result.failed.push({ index: i, error: shortError(e) });
      pending.add(i);
    }
  }

  // Solo importa si hay algo que enlazar: sin fotos arriba no se escribe nada y, sin red, no se pregunta en vano.
  if (up.size && pending.size) {
    for (const i of [...pending]) {
      const known = await isOnServer(supabase, storagePath(userId, ownerId, i));
      if (known === null) result.listed = false;
      if (known) {
        result.failed = result.failed.filter((f) => f.index !== i);
        await markUp(i);
      }
    }
  } else if (pending.size) result.listed = false;

  result.paths = [...up].sort((a, b) => a - b).map((i) => storagePath(userId, ownerId, i));
  return result;
}
