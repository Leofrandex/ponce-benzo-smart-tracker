export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'synced';
export type BannerTone = 'syncing' | 'offline' | 'pending' | 'synced';

export interface BannerState {
  tone: BannerTone;
  text: string;
  icon: string; // nombre de Ionicon (el componente lo castea a su glyphMap)
}

export interface BannerInput {
  status: SyncStatus;
  /** Registros de negocio en cola (sesiones + visitas + reportes). Lo que importa. */
  records: number;
  /** Fotos pendientes de registros que YA están arriba. */
  photos: number;
}

/**
 * Puro: deriva qué mostrar en el banner de sync.
 * Los pings de GPS quedan EXCLUIDOS a propósito: mezclarlos inflaba el conteo
 * ("150 registros por subir" siendo 148 pings) y el promotor no podía saber si
 * SUS visitas habían subido. Devuelve null sólo en idle sin nada que comunicar.
 */
export function deriveSyncBanner(input: BannerInput): BannerState | null {
  const { status, records, photos } = input;
  const queued = records + photos;

  if (status === 'syncing') {
    return {
      tone: 'syncing',
      text: queued > 0 ? `Sincronizando ${queued}…` : 'Sincronizando…',
      icon: 'sync-outline',
    };
  }

  if (records > 0) {
    if (status === 'offline') {
      return { tone: 'offline', text: `Sin conexión · ${records} en cola`, icon: 'cloud-offline-outline' };
    }
    const noun = records === 1 ? 'registro' : 'registros';
    return { tone: 'pending', text: `${records} ${noun} por subir`, icon: 'cloud-upload-outline' };
  }

  if (photos > 0) {
    const noun = photos === 1 ? 'foto' : 'fotos';
    if (status === 'offline') {
      return { tone: 'offline', text: `Registros arriba ✓ · ${photos} ${noun} en cola`, icon: 'cloud-offline-outline' };
    }
    return { tone: 'pending', text: `Registros arriba ✓ · ${photos} ${noun} por subir`, icon: 'image-outline' };
  }

  // Confirmación explícita: el promotor necesita VER que todo subió.
  if (status === 'synced') {
    return { tone: 'synced', text: 'Todo sincronizado', icon: 'checkmark-circle-outline' };
  }

  return null;
}
