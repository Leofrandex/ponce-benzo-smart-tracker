import { getSupabaseBrowser } from "../supabase/client";

// El bucket `visit-photos` es privado: las visitas y los reportes de competencia
// guardan RUTAS de storage, no URLs. Hay que firmarlas para mostrarlas en <img>.
//
// Si una ruta no se puede firmar (RLS de storage, archivo borrado), se descarta:
// devolver la ruta cruda como `src` sólo producía imágenes rotas sin explicación.
// El motivo queda en consola para poder diagnosticarlo. [BUG-025]
export async function signVisitPhotos(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;

  const sb = getSupabaseBrowser();
  const { data, error } = await sb.storage
    .from("visit-photos")
    .createSignedUrls(paths, 60 * 60); // 1 hora

  if (error) {
    console.warn("[fotos] no se pudieron firmar las fotos de visita:", error.message);
    return signed;
  }

  for (const s of data ?? []) {
    if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    else if (s.path) console.warn(`[fotos] sin acceso a ${s.path}: ${s.error ?? "motivo desconocido"}`);
  }
  return signed;
}

// Firma una lista de rutas y devuelve sólo las que se pudieron firmar,
// conservando el orden original.
export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  const signed = await signVisitPhotos(paths);
  return paths.map((p) => signed.get(p)).filter((u): u is string => u != null);
}
