import type { SupabaseClient } from "@supabase/supabase-js";
import { withDeadline } from "../../utils/withTimeout";

export function storagePath(userId: string, ownerId: string, index: number): string {
  return `${userId}/${ownerId}/${index}.jpg`;
}

/**
 * Sube las fotos una a una con plazo máximo por foto: con señal débil un upload
 * colgado no puede congelar el flush completo (se lanza error y se reintenta después).
 */
export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  ownerId: string,
  uris: string[],
  timeoutMs = 30_000,
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const path = storagePath(userId, ownerId, i);
    const res = await withDeadline(fetch(uris[i]), timeoutMs, `leer foto ${path}`);
    const buf = await res.arrayBuffer();
    const { error } = await withDeadline(
      supabase.storage.from("visit-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true }),
      timeoutMs,
      `subir foto ${path}`,
    );
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}
