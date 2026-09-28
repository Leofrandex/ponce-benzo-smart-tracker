import type { TaskAssignee } from "./assignments";
import type { ClientRow } from "./derive";
import { clientesDeVendedor } from "./vendorScope";
import { normalizeText } from "./taskFilters";

// Tipo de los filtros de Tiendas. Vive aquí (módulo puro) y ClientesFilters.tsx lo re-exporta.
export interface ClientesFilterValue {
  clientId: string;           // "" = todas las cadenas
  vendedor: string;           // user_id o ""
  estado: string;
  municipio: string;
  urbanizacion: string;
  channel: string;            // "" = todos
  classifications: string[];  // subconjunto de ["A","B","C"]
}

export const EMPTY_FILTERS: ClientesFilterValue = {
  clientId: "", vendedor: "", estado: "", municipio: "", urbanizacion: "", channel: "", classifications: [],
};

export function filtrarTiendas(rows: ClientRow[], f: ClientesFilterValue, search: string, assignments: TaskAssignee[]): ClientRow[] {
  const delVendedor = f.vendedor ? clientesDeVendedor(assignments, f.vendedor) : null;
  const q = normalizeText(search);
  return rows.filter((s) => {
    if (f.clientId && s.client_id !== f.clientId) return false;
    if (delVendedor && (!s.client_id || !delVendedor.has(s.client_id))) return false;
    if (f.estado && s.estado !== f.estado) return false;
    if (f.municipio && s.municipio !== f.municipio) return false;
    if (f.urbanizacion && s.urbanizacion !== f.urbanizacion) return false;
    if (f.channel && s.business_channel !== f.channel) return false;
    if (f.classifications.length > 0 && (!s.classification || !f.classifications.includes(s.classification))) return false;
    if (q && !normalizeText(s.name).includes(q)) return false;
    return true;
  });
}

export function parseTiendasParams(p: URLSearchParams): { filters: ClientesFilterValue; q: string } {
  const g = (k: string) => (p.get(k) ?? "").trim();
  return {
    filters: {
      ...EMPTY_FILTERS,
      clientId: g("client"), vendedor: g("vendedor"), estado: g("estado_geo"), municipio: g("municipio"),
      urbanizacion: g("urbanizacion"), channel: g("canal"),
      classifications: g("clasif").split(",").map((x) => x.trim().toUpperCase()).filter((x) => ["A", "B", "C"].includes(x)),
    },
    q: p.get("q") ?? "",
  };
}

export function serializeTiendasParams(f: ClientesFilterValue, q: string): string {
  const out = new URLSearchParams();
  const set = (k: string, v: string) => { if (v) out.set(k, v); };
  set("client", f.clientId); set("vendedor", f.vendedor); set("estado_geo", f.estado); set("municipio", f.municipio);
  set("urbanizacion", f.urbanizacion); set("canal", f.channel); set("clasif", f.classifications.join(",")); set("q", q);
  return out.toString();
}
