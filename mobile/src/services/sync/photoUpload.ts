import type { SupabaseClient } from "@supabase/supabase-js";
import { photoExists } from "../photos/photoStore";
import { withDeadline } from "../../utils/withTimeout";

// Solo para la lectura local: list y upload ya los cancela timedFetch (60 s).
const LOCAL_READ_TIMEOUT_MS = 90_000;

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

export type PhotoResult = { listed: boolean; paths: string[]; missing: number[]; failed: { index: number; error: string }[] };

/**
 * Sube las fotos una a una; un fallo no frena a las demás. `paths` queda en orden de índice.
 * Una foto solo es `missing` si el archivo no existe Y Storage confirmó que tampoco está:
 * sin listado no se puede saber, y queda en `failed` para reintentar.
 */
export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  ownerId: string,
  uris: string[],
  opts: { timeoutMs?: number; exists?: (uri: string) => Promise<boolean>; onPhotoDone?: () => void } = {},
): Promise<PhotoResult> {
  const { timeoutMs = LOCAL_READ_TIMEOUT_MS, exists = photoExists, onPhotoDone } = opts;
  const folder = `${userId}/${ownerId}`;
  let uploaded: Set<string> | null = null;
  let listError = "sin datos";
  try {
    const { data, error } = await supabase.storage.from("visit-photos").list(folder);
    if (error) listError = shortError(error);
    else if (data) {
      // Un objeto vacío no cuenta como subido: se vuelve a subir.
      uploaded = new Set(data
        .filter((o: { metadata?: { size?: number } | null }) => (o.metadata?.size ?? 1) > 0)
        .map((o: { name: string }) => `${folder}/${o.name}`));
    }
  } catch (e) { listError = shortError(e); }

  const result: PhotoResult = { listed: uploaded !== null, paths: [], missing: [], failed: [] };
  for (let i = 0; i < uris.length; i++) {
    const path = storagePath(userId, ownerId, i);
    try {
      if (uploaded?.has(path)) { result.paths.push(path); onPhotoDone?.(); continue; }
      if (!(await exists(uris[i]))) {
        if (uploaded) result.missing.push(i);
        else result.failed.push({ index: i, error: `archivo ausente y Storage sin listar: ${listError}` });
        continue;
      }
      const res = await withDeadline(fetch(uris[i]), timeoutMs, `leer foto ${path}`);
      const buf = await withDeadline(res.arrayBuffer(), timeoutMs, `leer foto ${path}`);
      if (buf.byteLength === 0) { result.failed.push({ index: i, error: "archivo de 0 bytes" }); continue; }
      const { error } = await supabase.storage.from("visit-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      result.paths.push(path);
      onPhotoDone?.();
    } catch (e) {
      result.failed.push({ index: i, error: shortError(e) });
    }
  }
  return result;
}
