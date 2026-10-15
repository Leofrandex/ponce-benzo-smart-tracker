import { getSupabaseBrowser } from "../supabase/client";
import { signVisitPhotos } from "./photos";
import type { NearbyStore, Proposal, ProposalStatus } from "../storeProposals";

interface ProposalRow {
  proposal_id: string; name: string; client_id: string | null; note: string | null;
  photo_urls: string[] | null; lat: number; lng: number; accuracy_m: number | null;
  captured_at: string; created_at: string; status: ProposalStatus;
  reject_reason: string | null; store_id: string | null;
  users: { full_name: string } | null; clients: { name: string } | null;
}

export async function fetchProposals(status: ProposalStatus): Promise<Proposal[]> {
  // FK `users!store_proposals_user_id_fkey`: nombre por defecto de Postgres, pendiente de verificar tras aplicar la migracion.
  const { data, error } = await getSupabaseBrowser()
    .from("store_proposals")
    .select("proposal_id, name, client_id, note, photo_urls, lat, lng, accuracy_m, captured_at, created_at, status, reject_reason, store_id, users!store_proposals_user_id_fkey(full_name), clients(name)")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ProposalRow[];
  const signed = await signVisitPhotos(rows.flatMap((r) => r.photo_urls ?? []));
  return rows.map((r) => ({
    proposal_id: r.proposal_id, name: r.name, client_id: r.client_id, client_name: r.clients?.name ?? null,
    note: r.note, photo_urls: r.photo_urls ?? [], photo_signed: r.photo_urls?.[0] ? signed.get(r.photo_urls[0]) ?? null : null,
    lat: r.lat, lng: r.lng, accuracy_m: r.accuracy_m, captured_at: r.captured_at, created_at: r.created_at,
    status: r.status, author_name: r.users?.full_name ?? "—", reject_reason: r.reject_reason, store_id: r.store_id,
  }));
}

export async function countPendingProposals(): Promise<number> {
  const { count, error } = await getSupabaseBrowser()
    .from("store_proposals").select("proposal_id", { count: "exact", head: true }).eq("status", "pendiente");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchNearbyStores(lat: number, lng: number): Promise<NearbyStore[]> {
  const { data, error } = await getSupabaseBrowser().rpc("fn_tiendas_cercanas", { p_lat: lat, p_lng: lng, p_radio_m: 100 });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyStore[];
}

export async function fetchClientOptions(): Promise<{ client_id: string; name: string }[]> {
  const { data, error } = await getSupabaseBrowser().from("clients").select("client_id, name").eq("active", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { client_id: string; name: string }[];
}
