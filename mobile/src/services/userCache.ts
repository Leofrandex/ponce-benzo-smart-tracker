import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, setMeta } from '../store/localStore';
import type { User } from '../types';

/** Perfil de red del usuario (éxito trae el perfil; fallo = offline / no encontrado). */
export type ProfileOnline = { ok: true; user: User } | { ok: false };

/** Resultado de restaurar el perfil al arrancar. `none` = no hay ni red ni caché → Login. */
export type ProfileLoad =
  | { user: User; source: 'online' }
  | { user: User; source: 'cache' }
  | { user: null; source: 'none' };

/**
 * Puro: red primero con fallback a caché local. Si la red falla pero hay perfil
 * cacheado, se RESTAURA (no se desloguea al mercaderista offline).
 */
export function resolveProfileLoad(online: ProfileOnline, cached: User | null): ProfileLoad {
  if (online.ok) return { user: online.user, source: 'online' };
  if (cached) return { user: cached, source: 'cache' };
  return { user: null, source: 'none' };
}

export function serializeUserProfile(user: User): string {
  return JSON.stringify(user);
}

/** Puro: parsea el perfil cacheado; null si no existe o está corrupto (nunca lanza). */
export function parseUserProfile(raw: string | null): User | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

const key = (userId: string) => `user_profile:${userId}`;

export async function saveUserProfile(db: SQLiteDatabase, user: User): Promise<void> {
  await setMeta(db, key(user.id), serializeUserProfile(user));
}

export async function loadUserProfile(db: SQLiteDatabase, userId: string): Promise<User | null> {
  return parseUserProfile(await getMeta(db, key(userId)));
}

export async function clearUserProfile(db: SQLiteDatabase, userId: string): Promise<void> {
  await db.runAsync(`DELETE FROM meta WHERE key = ?`, key(userId));
}
