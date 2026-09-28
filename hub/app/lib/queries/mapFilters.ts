import type { TaskAssignee } from "./assignments";
import { tiendasDeVendedor } from "./vendorScope";

// "Todas" es explícito; una selección vacía significa NINGUNA (antes una lista
// vacía significaba "todas" y eso confundía a Diego).
export type Seleccion = { modo: "todas" } | { modo: "seleccion"; ids: string[] };
export const TODAS: Seleccion = { modo: "todas" };
export const NINGUNA: Seleccion = { modo: "seleccion", ids: [] };

export type MapFilterValue = { tiendas: Seleccion; merch: Seleccion; vendedor: string };
export const DEFAULT_MAP_FILTER: MapFilterValue = { tiendas: TODAS, merch: TODAS, vendedor: "" };

export const incluye = (sel: Seleccion, id: string) => sel.modo === "todas" || sel.ids.includes(id);

export function aplicar<T>(items: T[], sel: Seleccion, idOf: (t: T) => string): T[] {
  return sel.modo === "todas" ? items : items.filter((t) => sel.ids.includes(idOf(t)));
}

function normalizar(ids: string[], allIds: string[]): Seleccion {
  const set = new Set(ids);
  return allIds.length > 0 && allIds.every((id) => set.has(id)) ? TODAS : { modo: "seleccion", ids: Array.from(set) };
}

export function toggleUno(sel: Seleccion, id: string, allIds: string[]): Seleccion {
  const actual = sel.modo === "todas" ? allIds : sel.ids;
  const next = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
  return normalizar(next, allIds);
}

export function setVarios(sel: Seleccion, ids: string[], on: boolean, allIds: string[]): Seleccion {
  const actual = new Set(sel.modo === "todas" ? allIds : sel.ids);
  for (const id of ids) { if (on) actual.add(id); else actual.delete(id); }
  return normalizar(allIds.filter((id) => actual.has(id)), allIds);
}

export function estadoGrupo(sel: Seleccion, ids: string[]): "todas" | "algunas" | "ninguna" {
  const n = ids.filter((id) => incluye(sel, id)).length;
  return n === 0 ? "ninguna" : n === ids.length ? "todas" : "algunas";
}

export type TiendaMapa = { store_id: string; name: string; client_id: string | null; client_name: string | null };
export type GrupoCadena = { client_id: string | null; nombre: string; tiendas: TiendaMapa[] };

export function agruparPorCadena(stores: TiendaMapa[]): GrupoCadena[] {
  const map = new Map<string, GrupoCadena>();
  for (const s of stores) {
    const key = s.client_id ?? "__sin__";
    const g = map.get(key) ?? { client_id: s.client_id, nombre: s.client_id ? (s.client_name ?? "(sin nombre)") : "Sin cadena", tiendas: [] };
    g.tiendas.push(s);
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.client_id === null ? 1 : b.client_id === null ? -1 : a.nombre.localeCompare(b.nombre, "es"));
}

// Elegir un vendedor selecciona UNA VEZ las tiendas de sus cadenas; los ajustes
// manuales posteriores no se pisan. Vaciar el vendedor vuelve a Todas.
export function elegirVendedor(
  value: MapFilterValue, userId: string, stores: TiendaMapa[], assignments: TaskAssignee[],
): MapFilterValue {
  if (!userId) return { ...value, vendedor: "", tiendas: TODAS };
  return { ...value, vendedor: userId, tiendas: { modo: "seleccion", ids: tiendasDeVendedor(stores, assignments, userId) } };
}

export function resumenMapa(value: MapFilterValue, grupos: GrupoCadena[], totalMerch: number): string {
  const t = value.tiendas;
  let tiendas: string;
  if (t.modo === "todas") tiendas = "Todas las tiendas";
  else if (t.ids.length === 0) tiendas = "Ninguna tienda";
  else {
    const cadenas = grupos.filter((g) => g.tiendas.some((s) => t.ids.includes(s.store_id))).length;
    tiendas = `${cadenas} ${cadenas === 1 ? "cadena" : "cadenas"} · ${t.ids.length} ${t.ids.length === 1 ? "tienda" : "tiendas"}`;
  }
  const m = value.merch;
  const merch = m.modo === "todas" || m.ids.length === totalMerch ? "todos los mercaderistas"
    : m.ids.length === 0 ? "ningún mercaderista"
    : `${m.ids.length} ${m.ids.length === 1 ? "mercaderista" : "mercaderistas"}`;
  return `${tiendas} · ${merch}`;
}

const lista = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export function parseMapParams(p: URLSearchParams, stores: TiendaMapa[]): MapFilterValue {
  const vendedor = (p.get("vendedor") ?? "").trim();
  const merchRaw = p.get("merch");
  const merch: Seleccion = merchRaw === null ? TODAS : merchRaw === "ninguno" ? NINGUNA : { modo: "seleccion", ids: lista(merchRaw) };
  const cadenasRaw = p.get("cadenas");
  const tiendasRaw = p.get("tiendas");
  let tiendas: Seleccion = TODAS;
  if (cadenasRaw !== null || tiendasRaw !== null) {
    const known = new Set(stores.map((s) => s.store_id));
    const cadenas = new Set(lista(cadenasRaw));
    const ids = new Set(tiendasRaw === "ninguna" ? [] : lista(tiendasRaw).filter((id) => known.has(id)));
    for (const s of stores) if (s.client_id && cadenas.has(s.client_id)) ids.add(s.store_id);
    tiendas = { modo: "seleccion", ids: Array.from(ids) };
  }
  return { tiendas, merch, vendedor };
}

// Cadenas completas viajan como cadenas= (pocas), las tiendas sueltas como
// tiendas=: así la URL no crece con 197 uuids.
export function serializeMapParams(v: MapFilterValue, grupos: GrupoCadena[]): string {
  const out = new URLSearchParams();
  if (v.vendedor) out.set("vendedor", v.vendedor);
  if (v.merch.modo === "seleccion") out.set("merch", v.merch.ids.length === 0 ? "ninguno" : v.merch.ids.join(","));
  if (v.tiendas.modo === "seleccion") {
    const sel = new Set(v.tiendas.ids);
    const cadenas: string[] = [];
    for (const g of grupos) {
      if (g.client_id && g.tiendas.length > 0 && g.tiendas.every((s) => sel.has(s.store_id))) {
        cadenas.push(g.client_id);
        for (const s of g.tiendas) sel.delete(s.store_id);
      }
    }
    if (cadenas.length > 0) out.set("cadenas", cadenas.join(","));
    if (sel.size > 0) out.set("tiendas", Array.from(sel).join(","));
    if (cadenas.length === 0 && sel.size === 0) out.set("tiendas", "ninguna");
  }
  return out.toString();
}
