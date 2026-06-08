import { getSupabaseBrowser } from "../supabase/client";
import type { Contact, ContactEngagement, Store } from "../types";

export async function fetchStoreById(storeId: string): Promise<Store | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("stores").select("*").eq("store_id", storeId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { contact_name: null, contact_phone: null, contact_email: null, ...data } as Store;
}

export async function fetchContacts(storeId: string): Promise<Contact[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("contacts").select("*").eq("store_id", storeId);
  if (error) throw error;
  return ((data ?? []) as Contact[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
}

export async function fetchEngagements(storeId: string): Promise<ContactEngagement[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("contact_engagements").select("*").eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContactEngagement[];
}
