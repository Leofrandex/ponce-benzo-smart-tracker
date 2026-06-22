import type { SupabaseClient } from "@supabase/supabase-js";
export function storagePath(userId: string, ownerId: string, index: number): string {
  return `${userId}/${ownerId}/${index}.jpg`;
}
export async function uploadPhotos(supabase: SupabaseClient, userId: string, ownerId: string, uris: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const path = storagePath(userId, ownerId, i);
    const res = await fetch(uris[i]);
    const buf = await res.arrayBuffer();
    const { error } = await supabase.storage.from("visit-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}
