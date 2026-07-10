import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, setMeta } from '../store/localStore';
import type { Store, RouteStoreItem, StoreStatus } from '../types';

/** Snapshot de solo-lectura del plano de lectura (ruta + tiendas), para cold-start offline. */
export interface RouteSnapshot {
  route_id: string;
  route_date: string;   // YYYY-MM-DD de la ruta cacheada
  cached_at: string;    // ISO — cuándo se guardó
  stores: Store[];      // tiendas ya ordenadas según la ruta
}

/** Resultado de cargar la ruta online (éxito trae los datos; fallo no). */
export type OnlineResult =
  | { ok: true; route_id: string; route_date: string; stores: Store[] }
  | { ok: false };

/** Qué debe renderizar la UI tras intentar cargar la ruta. */
export type RouteLoad =
  | { source: 'online'; route_id: string; route_date: string; stores: Store[] }
  | { source: 'cache'; route_id: string; route_date: string; stores: Store[] }
  | { source: 'error' };

/** Puro: network-first con fallback a caché. Online gana; si falla, caché; si no hay, error. */
export function resolveRouteLoad(online: OnlineResult, cached: RouteSnapshot | null): RouteLoad {
  if (online.ok) {
    return { source: 'online', route_id: online.route_id, route_date: online.route_date, stores: online.stores };
  }
  if (cached) {
    return { source: 'cache', route_id: cached.route_id, route_date: cached.route_date, stores: cached.stores };
  }
  return { source: 'error' };
}

/** Forma mínima de una visita persistida que necesitamos para reconstruir el estado de la ruta. */
export interface RecordedVisit {
  store_id: string;
  status: string;         // 'completed' | 'skipped' | 'anomaly' (texto guardado en SQLite)
  check_in_time: string;  // ISO — desempata cuando hay varias visitas de la misma tienda
}

const KNOWN_STATUSES: ReadonlySet<StoreStatus> = new Set(['completed', 'skipped', 'anomaly']);

/**
 * Puro: reproyecta el estado de la ruta a partir de las visitas ya registradas hoy.
 * `routeItems` es efímero (se reconstruye en cada recarga), pero las visitas viven en
 * SQLite. Sin esta fusión, cualquier recarga (refresh de token, reconexión, foreground)
 * dejaba todas las tiendas en 'pending' y el conteo colapsaba al último registro.
 * Para cada tienda con visita, aplica el status de la visita MÁS RECIENTE.
 */
export function mergeRecordedStatuses(
  items: RouteStoreItem[],
  visits: RecordedVisit[],
): RouteStoreItem[] {
  const latestByStore = new Map<string, RecordedVisit>();
  for (const v of visits) {
    if (!KNOWN_STATUSES.has(v.status as StoreStatus)) continue;
    const prev = latestByStore.get(v.store_id);
    if (!prev || v.check_in_time > prev.check_in_time) latestByStore.set(v.store_id, v);
  }
  return items.map((item) => {
    const v = latestByStore.get(item.store.store_id);
    return v ? { ...item, status: v.status as StoreStatus } : item;
  });
}

export function serializeSnapshot(snapshot: RouteSnapshot): string {
  return JSON.stringify(snapshot);
}

/** Puro: parsea el blob del meta; null si no existe o está corrupto (nunca lanza). */
export function parseSnapshot(raw: string | null): RouteSnapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RouteSnapshot;
  } catch {
    return null;
  }
}

const key = (userId: string) => `route_snapshot:${userId}`;

export async function saveRouteSnapshot(db: SQLiteDatabase, userId: string, snapshot: RouteSnapshot): Promise<void> {
  await setMeta(db, key(userId), serializeSnapshot(snapshot));
}

export async function loadRouteSnapshot(db: SQLiteDatabase, userId: string): Promise<RouteSnapshot | null> {
  return parseSnapshot(await getMeta(db, key(userId)));
}
