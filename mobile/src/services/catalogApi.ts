import { supabase } from './supabase';
import type { Product, SupervisorOption, Store } from '../types';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products').select('product_id, sku, name, brand').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []) as Product[];
}

// Quien puede figurar como acompañante: supervisores y admins, menos uno mismo.
export async function fetchSupervisors(currentUserId: string): Promise<SupervisorOption[]> {
  const { data, error } = await supabase
    .from('users').select('id, full_name, role, is_supervisor').eq('active', true).order('full_name');
  if (error) throw error;
  return (data ?? [])
    .filter((u) => (u.is_supervisor || u.role === 'admin') && u.id !== currentUserId)
    .map((u) => ({ id: u.id, full_name: u.full_name }));
}

// Catalogo completo de tiendas para el reporte suelto (el usuario busca
// cualquier sucursal, no solo las de su ruta).
export async function fetchAllStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores').select('*').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    contact_name: null, contact_phone: null, contact_email: null, ...s,
  })) as Store[];
}
