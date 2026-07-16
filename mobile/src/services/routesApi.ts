import { supabase } from './supabase';
import { pickRoute } from './pickRoute';
import type { Route, Store, CompetitorBrand } from '../types';

// Ruta de HOY del usuario (RLS la filtra a las propias). null si no hay ruta hoy.
export async function fetchTodayRoute(userId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes').select('*').eq('user_id', userId).order('route_date', { ascending: false });
  if (error) throw error;
  // Fecha LOCAL del dispositivo (route_date es una fecha de negocio local). Con
  // toISOString (UTC), después de las 8:00 PM en Venezuela "hoy" era mañana → la
  // app cargaba la ruta del día siguiente y escondía la vigente (familia BUG-021).
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return pickRoute((data ?? []) as Route[], today);
}

// Tiendas por id, preservando el orden de `ids` (la ruta es ordenada).
export async function fetchStoresByIds(ids: string[]): Promise<Store[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('stores').select('*').in('store_id', ids);
  if (error) throw error;
  const rows = (data ?? []).map((s) => ({
    contact_name: null, contact_phone: null, contact_email: null, ...s,
  })) as Store[];
  const byId = new Map(rows.map((s) => [s.store_id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Store => Boolean(s));
}

// Marcas de competencia activas (brand_id es uuid real, con FK desde competition_reports).
export async function fetchCompetitorBrands(): Promise<CompetitorBrand[]> {
  const { data, error } = await supabase
    .from('competitor_brands').select('brand_id, name, active').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []) as CompetitorBrand[];
}
