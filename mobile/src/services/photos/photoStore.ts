// Fotos de visita en carpeta permanente (documentDirectory/photos/), no en el cache de Android,
// que el sistema puede vaciar antes de que la foto suba. Nunca perder una foto.
export interface PhotoFs {
  ensureDir(): Promise<void>;
  copyToPermanent(uri: string, name: string): Promise<string>;
  exists(uri: string): Promise<boolean>;
  remove(uri: string): Promise<void>;
  list(): Promise<{ uri: string; modifiedMs: number }[]>;
  size(uri: string): Promise<number>;
}

// expo-file-system se carga perezoso: las pruebas corren en Node plano y no lo tienen.
async function fsApi() {
  const { File, Directory, Paths } = await import('expo-file-system');
  return { File, Directory, dir: new Directory(Paths.document, 'photos') };
}

export const expoPhotoFs: PhotoFs = {
  async ensureDir() {
    const { dir } = await fsApi();
    dir.create({ intermediates: true, idempotent: true });
  },
  async copyToPermanent(uri, name) {
    const { File, dir } = await fsApi();
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, name);
    new File(uri).copy(dest);
    return dest.uri;
  },
  async exists(uri) {
    const { File } = await fsApi();
    return new File(uri).exists;
  },
  async remove(uri) {
    const { File } = await fsApi();
    const f = new File(uri);
    if (f.exists) f.delete();
  },
  async list() {
    const { File, dir } = await fsApi();
    if (!dir.exists) return [];
    return dir.list()
      .filter((e): e is InstanceType<typeof File> => e instanceof File)
      .map((f) => ({ uri: f.uri, modifiedMs: f.modificationTime ?? 0 }));
  },
  async size(uri) {
    const { File } = await fsApi();
    // File.size da 0 tambien si el archivo no existe o no se puede leer: info() los distingue.
    const info = new File(uri).info();
    if (!info.exists || typeof info.size !== 'number') throw new Error('no se pudo leer el tamano de la foto');
    return info.size;
  },
};

/** Copia la foto a la carpeta permanente y borra el original solo si la copia salio bien.
 *  Si algo falla devuelve la ruta original: la foto nunca se pierde. */
export async function persistPhoto(cacheUri: string, fs: PhotoFs = expoPhotoFs): Promise<string> {
  let permanent: string;
  try {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    permanent = await fs.copyToPermanent(cacheUri, name);
  } catch (e) {
    console.warn('[photos] no se pudo copiar a carpeta permanente, se usa la original:', (e as Error)?.message ?? e);
    return cacheUri;
  }
  try { await fs.remove(cacheUri); } catch { /* el original sobrante lo limpia el cache */ }
  return permanent;
}

/** Borra fotos; nunca lanza (un fallo individual no frena a las demas). */
export async function deletePhotos(uris: string[], fs: PhotoFs = expoPhotoFs): Promise<void> {
  for (const uri of uris) {
    try { await fs.remove(uri); } catch { /* ignorar */ }
  }
}

/** Solo false cuando la ausencia esta confirmada; ante un error asume que existe (nunca dar por perdida una foto). */
export async function photoExists(uri: string, fs: PhotoFs = expoPhotoFs): Promise<boolean> {
  try { return await fs.exists(uri); } catch { return true; }
}

/** Tamano real en disco. Un error se propaga: nunca debe leerse como 0 bytes. */
export function photoSize(uri: string, fs: PhotoFs = expoPhotoFs): Promise<number> {
  return fs.size(uri);
}
