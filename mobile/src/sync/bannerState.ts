export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'synced';
export type BannerTone = 'syncing' | 'offline' | 'pending';

export interface BannerState {
  tone: BannerTone;
  text: string;
  icon: string; // nombre de Ionicon (el componente lo castea a su glyphMap)
}

/**
 * Puro: deriva qué mostrar en el banner de sync desde el estado del SyncContext.
 * Devuelve null cuando no hay nada que comunicar (nada en cola y sin sincronizar).
 */
export function deriveSyncBanner(input: { status: SyncStatus; pendingCount: number }): BannerState | null {
  const { status, pendingCount } = input;

  if (status === 'syncing') {
    return {
      tone: 'syncing',
      text: pendingCount > 0 ? `Sincronizando ${pendingCount}…` : 'Sincronizando…',
      icon: 'sync-outline',
    };
  }

  if (pendingCount > 0) {
    if (status === 'offline') {
      return { tone: 'offline', text: `Sin conexión · ${pendingCount} en cola`, icon: 'cloud-offline-outline' };
    }
    const noun = pendingCount === 1 ? 'registro' : 'registros';
    return { tone: 'pending', text: `${pendingCount} ${noun} por subir`, icon: 'cloud-upload-outline' };
  }

  return null;
}
