import { validateCoords } from "./mutations/stores";

// Sucursales nuevas registradas desde la app (Spec 2026-10-14).
export type ProposalStatus = "pendiente" | "aprobada" | "rechazada";

export interface Proposal {
  proposal_id: string; name: string; client_id: string | null; client_name: string | null; note: string | null;
  photo_urls: string[]; photo_signed: string | null; lat: number; lng: number; accuracy_m: number | null;
  captured_at: string; created_at: string; status: ProposalStatus; author_name: string;
  reject_reason: string | null; store_id: string | null;
}

export interface StoreDraft {
  name: string; address: string; estado: string; municipio: string; urbanizacion: string;
  ciudad: string; region: string; business_channel: string; classification: string; client_id: string;
  master_lat: number; master_lng: number;
}

export interface NearbyStore {
  store_id: string; name: string; address: string | null; master_lat: number; master_lng: number; distancia_m: number;
}

export function draftFromProposal(p: Proposal): StoreDraft {
  return {
    name: p.name.trim(), address: "", estado: "", municipio: "", urbanizacion: "", ciudad: "", region: "",
    business_channel: "", classification: "", client_id: p.client_id ?? "",
    master_lat: p.lat, master_lng: p.lng,
  };
}

export function validateStoreDraft(d: StoreDraft): string | null {
  if (!d.name.trim()) return "El nombre es obligatorio.";
  if (!validateCoords(d.master_lat, d.master_lng)) return "Coordenadas fuera de rango.";
  return null;
}

const ERRORES: Record<string, string> = {
  propuesta_ya_revisada: "Esta propuesta ya fue revisada",
  solo_admin: "Solo un administrador puede revisar propuestas.",
  coordenadas_invalidas: "Coordenadas fuera de rango.",
  nombre_requerido: "El nombre es obligatorio.",
  motivo_requerido: "Escribe el motivo del rechazo.",
};

export function reviewErrorMessage(raw: string): string {
  const code = Object.keys(ERRORES).find((k) => raw.includes(k));
  return code ? ERRORES[code] : raw;
}

export const PROPOSALS_CHANGED_EVENT = "store-proposals-changed";
export function notifyProposalsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT));
}
