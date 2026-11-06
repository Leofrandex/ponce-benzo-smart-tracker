export type UpdateBanner = { kind: 'downloading' | 'ready'; text: string; progress: number | null };

/** Qué mostrar según el estado de expo-updates. `progress` va de 0 a 1; null si no se conoce. */
export function deriveUpdateBanner(s: { isDownloading: boolean; isUpdatePending: boolean; downloadProgress?: number }): UpdateBanner | null {
  if (s.isDownloading) {
    if (s.downloadProgress == null) return { kind: 'downloading', text: 'Descargando nueva versión…', progress: null };
    const progress = Math.min(1, Math.max(0, s.downloadProgress));
    return { kind: 'downloading', text: `Descargando nueva versión… ${Math.round(progress * 100)}%`, progress };
  }
  if (s.isUpdatePending) return { kind: 'ready', text: 'App lista para actualizar. Por favor, ciérrala y ábrela de nuevo.', progress: null };
  return null;
}
