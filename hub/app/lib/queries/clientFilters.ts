import type { TaskAssignee } from "./assignments";
import type { ClientRow, StoreGeoRow } from "./clients";
import { clientesDeVendedor } from "./vendorScope";

export type ClientesFiltro = { estado: string; municipio: string; vendedor: string };

export function filtrarClientes(
  clients: ClientRow[], storeGeo: StoreGeoRow[], f: ClientesFiltro, assignments: TaskAssignee[],
): ClientRow[] {
  const delVendedor = f.vendedor ? clientesDeVendedor(assignments, f.vendedor) : null;
  const geo = !!(f.estado || f.municipio);
  const counts = new Map<string, number>();
  if (geo) {
    for (const s of storeGeo) {
      if (!s.client_id) continue;
      if (f.estado && s.estado !== f.estado) continue;
      if (f.municipio && s.municipio !== f.municipio) continue;
      counts.set(s.client_id, (counts.get(s.client_id) ?? 0) + 1);
    }
  }
  return clients
    .filter((c) => !delVendedor || delVendedor.has(c.client_id))
    .filter((c) => !geo || (counts.get(c.client_id) ?? 0) > 0)
    .map((c) => (geo ? { ...c, store_count: counts.get(c.client_id)! } : c));
}

const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "es"));

export function opcionesGeoClientes(storeGeo: StoreGeoRow[], estado: string) {
  return {
    estados: uniq(storeGeo.map((s) => s.estado)),
    municipios: uniq(storeGeo.filter((s) => !estado || s.estado === estado).map((s) => s.municipio)),
  };
}

export function parseClientesParams(p: URLSearchParams): ClientesFiltro {
  const g = (k: string) => (p.get(k) ?? "").trim();
  return { estado: g("estado_geo"), municipio: g("municipio"), vendedor: g("vendedor") };
}

export function serializeClientesParams(f: ClientesFiltro): string {
  const out = new URLSearchParams();
  if (f.estado) out.set("estado_geo", f.estado);
  if (f.municipio) out.set("municipio", f.municipio);
  if (f.vendedor) out.set("vendedor", f.vendedor);
  return out.toString();
}
