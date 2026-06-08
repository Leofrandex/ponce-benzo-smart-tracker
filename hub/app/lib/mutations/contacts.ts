import { getSupabaseBrowser } from "../supabase/client";
import type { ContactFormValue } from "@/app/components/clientes/ContactFormModal";

export async function setPrimaryContact(storeId: string, contactId: string): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.rpc("fn_set_primary_contact", { p_store_id: storeId, p_contact_id: contactId });
  return { error: error?.message ?? null };
}

export async function createContact(storeId: string, v: ContactFormValue): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from("contacts").insert({
    store_id: storeId,
    full_name: v.full_name,
    role_title: v.role_title || null,
    phone: v.phone || null,
    email: v.email || null,
    birthday: v.birthday || null,
    is_primary: false,
    active: true,
  }).select("contact_id").single();
  if (error) return { error: error.message };
  if (v.is_primary && data) return setPrimaryContact(storeId, data.contact_id);
  return { error: null };
}

export async function updateContact(storeId: string, contactId: string, v: ContactFormValue): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("contacts").update({
    full_name: v.full_name,
    role_title: v.role_title || null,
    phone: v.phone || null,
    email: v.email || null,
    birthday: v.birthday || null,
  }).eq("contact_id", contactId);
  if (error) return { error: error.message };
  if (v.is_primary) return setPrimaryContact(storeId, contactId);
  return { error: null };
}

export async function deleteContact(contactId: string): Promise<{ error: string | null }> {
  const sb = getSupabaseBrowser();
  const { error } = await sb.from("contacts").delete().eq("contact_id", contactId);
  return { error: error?.message ?? null };
}
