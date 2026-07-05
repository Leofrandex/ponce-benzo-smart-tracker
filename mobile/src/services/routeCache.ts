import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, setMeta } from '../store/localStore';
import type { Store } from '../types';

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
