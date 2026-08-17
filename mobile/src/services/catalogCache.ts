import type { SQLiteDatabase } from 'expo-sqlite';
import { getMeta, setMeta } from '../store/localStore';
import type { Product, SupervisorOption } from '../types';

export type CatalogOnline = { ok: true; items: Product[] } | { ok: false };
export interface CatalogResult { source: 'online' | 'cache' | 'empty'; items: Product[] }

/**
 * Puro: network-first con fallback a cache. Un catalogo online VACIO es
 * autoritativo y no resucita la cache — mismo criterio que resolveRouteLoad.
 */
export function resolveCatalogLoad(online: CatalogOnline, cached: Product[]): CatalogResult {
  if (online.ok) return { source: 'online', items: online.items };
  if (cached.length > 0) return { source: 'cache', items: cached };
  return { source: 'empty', items: [] };
}

export async function saveProducts(db: SQLiteDatabase, items: Product[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM products`);
    for (const p of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO products (product_id, sku, name, brand) VALUES (?, ?, ?, ?)`,
        p.product_id, p.sku, p.name, p.brand ?? null,
      );
    }
  });
}

export function loadProducts(db: SQLiteDatabase): Promise<Product[]> {
  return db.getAllAsync<Product>(`SELECT product_id, sku, name, brand FROM products ORDER BY name`);
}

// La lista de supervisores es corta (1-3 personas): va como JSON en meta,
// no amerita tabla propia.
const SUPERVISORS_KEY = 'supervisors';

export async function saveSupervisors(db: SQLiteDatabase, list: SupervisorOption[]): Promise<void> {
  await setMeta(db, SUPERVISORS_KEY, JSON.stringify(list));
}

export async function loadSupervisors(db: SQLiteDatabase): Promise<SupervisorOption[]> {
  const raw = await getMeta(db, SUPERVISORS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupervisorOption[]) : [];
  } catch { return []; }
}
