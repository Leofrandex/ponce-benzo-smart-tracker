import type { SupabaseClient } from '@supabase/supabase-js';

/** Puro: la ruta especial del dia acumula tiendas sin repetirlas. */
export function mergeSpecialStores(existing: string[], storeId: string): string[] {
  return existing.includes(storeId) ? existing : [...existing, storeId];
}

/** Fecha local del telefono en formato YYYY-MM-DD. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ruta con la que se abre la jornada. Sin ruta cargada (ruta especial armada a mano por
 * quien no tiene ruta hoy) se crea la especial. Devuelve null si no se pudo: el servidor
 * rechazaria para siempre una sesion sin ruta valida, asi que no se abre la jornada.
 */
export async function resolveStartRoute(
  current: string | null,
  firstStoreId: string | undefined,
  ensure: (storeId: string) => Promise<string>,
): Promise<string | null> {
  if (current) return current;
  if (!firstStoreId) return null;
  try { return await ensure(firstStoreId); } catch { return null; }
}

/**
 * Get-or-create de la ruta especial de HOY para este usuario, agregandole la
 * tienda. Devuelve el route_id. El indice parcial uq_routes_special garantiza
 * que solo haya una por persona y dia, y convive con su ruta fija normal.
 */
export async function ensureSpecialRoute(
  supabase: SupabaseClient,
  userId: string,
  storeId: string,
  today: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from('routes')
    .select('route_id, store_ids')
    .eq('user_id', userId).eq('route_date', today).eq('is_special', true)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const merged = mergeSpecialStores((existing.store_ids ?? []) as string[], storeId);
    if (merged.length !== (existing.store_ids ?? []).length) {
      const { error } = await supabase
        .from('routes').update({ store_ids: merged }).eq('route_id', existing.route_id);
      if (error) throw error;
    }
    return existing.route_id as string;
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({ user_id: userId, route_date: today, store_ids: [storeId], is_special: true })
    .select('route_id').single();
  if (error) throw error;
  return data.route_id as string;
}
