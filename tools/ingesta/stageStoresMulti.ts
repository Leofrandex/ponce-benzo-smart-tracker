// tools/ingesta/stageStoresMulti.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { TiendaRow, resolveStoreNames } from "./parseTiendas";
import { prefixForClient, normClient } from "./tiendasConfig";

// La llave incluye el NOMBRE además de cliente+coord: dos locales distintos en
// el mismo centro comercial comparten coordenada legítimamente (BUG-024).
export function storeKeyFor(r: TiendaRow): string {
  return `${normClient(r.cliente)}|${r.lat!.toFixed(5)},${r.lng!.toFixed(5)}|${r.nombreTienda}`;
}

export interface ExistingStore { store_id: string; name: string }

// Asigna tiendas existentes de la DB a filas del Excel, por grupo de coordenada
// (key = cliente/client_id + coord SIN nombre). Dentro de cada grupo: nombre
// exacto primero, luego contención (｢FTD AVILA｣ ⊂ ｢FTD EL AVILA｣); si sobra una
// sola fila y un solo candidato, se emparejan (renombre en misma coord). Cada
// candidato se consume una vez; lo no asignado se crea nuevo.
export function assignExistingStores(
  rows: { key: string; finalName: string }[],
  existingByCoord: Map<string, ExistingStore[]>,
): Map<number, string> {
  const byKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key)!.push(i);
  });

  const core = (name: string) => name.replace(/\s+/g, " ").trim().toUpperCase();
  const assigned = new Map<number, string>();

  for (const [key, idxs] of byKey) {
    const cands = [...(existingByCoord.get(key) ?? [])];
    if (!cands.length) continue;

    let pending = [...idxs];
    // 1) nombre exacto
    pending = pending.filter((i) => {
      const j = cands.findIndex((c) => core(c.name) === core(rows[i].finalName));
      if (j < 0) return true;
      assigned.set(i, cands[j].store_id); cands.splice(j, 1); return false;
    });
    // 2) contención (uno contiene al otro)
    pending = pending.filter((i) => {
      const j = cands.findIndex((c) => {
        const a = core(c.name), b = core(rows[i].finalName);
        return a.includes(b) || b.includes(a);
      });
      if (j < 0) return true;
      assigned.set(i, cands[j].store_id); cands.splice(j, 1); return false;
    });
    // 3) última fila + único candidato: renombre en la misma coordenada
    if (pending.length === 1 && cands.length === 1) {
      assigned.set(pending[0], cands[0].store_id);
    }
  }
  return assigned;
}

export async function stageStoresMulti(
  supabase: SupabaseClient,
  completas: TiendaRow[],
  chainMap: Map<string, { client_id: string | null; channel: string }>,
  commit: boolean,
): Promise<{ pilot: Set<string>; idByKey: Map<string, string | null> }> {
  // Nombres finales con desempate de homónimos.
  const names = resolveStoreNames(completas.map((r) => ({
    prefix: prefixForClient(r.cliente)!, nombre: r.nombreTienda, municipio: r.municipio,
  })));

  // Índice de tiendas existentes por (client_id + coord redondeada). Varias
  // tiendas pueden compartir coordenada (mismo centro comercial): se guardan
  // todas y `assignExistingStores` desambigua por nombre.
  const { data: existing, error } = await supabase
    .from("stores").select("store_id, name, client_id, master_lat, master_lng");
  if (error) throw new Error(`select stores: ${error.message}`);
  const existingByCoord = new Map<string, ExistingStore[]>();
  for (const s of existing ?? []) {
    if (s.client_id == null || s.master_lat == null || s.master_lng == null) continue;
    const k = `${s.client_id}|${Number(s.master_lat).toFixed(5)},${Number(s.master_lng).toFixed(5)}`;
    if (!existingByCoord.has(k)) existingByCoord.set(k, []);
    existingByCoord.get(k)!.push({ store_id: s.store_id, name: s.name });
  }
  const matchRows = completas.map((r, i) => {
    const chain = chainMap.get(normClient(r.cliente))!;
    return {
      key: chain.client_id ? `${chain.client_id}|${r.lat!.toFixed(5)},${r.lng!.toFixed(5)}` : `sin-cliente|${i}`,
      finalName: names[i],
    };
  });
  const assigned = assignExistingStores(matchRows, existingByCoord);

  const pilot = new Set<string>();
  const idByKey = new Map<string, string | null>();
  let created = 0, updated = 0, contacts = 0;

  for (let i = 0; i < completas.length; i++) {
    const r = completas[i];
    const chain = chainMap.get(normClient(r.cliente))!;
    const key = storeKeyFor(r);
    const payload = {
      name: names[i], master_lat: r.lat, master_lng: r.lng, address: r.direccion,
      municipio: r.municipio, ciudad: r.ciudad, estado: r.estado, region: r.region,
      business_channel: chain.channel, client_id: chain.client_id, active: true,
    };
    let storeId: string | null = assigned.get(i) ?? null;

    if (commit) {
      if (storeId) {
        const { error: uErr } = await supabase.from("stores").update(payload).eq("store_id", storeId);
        if (uErr) throw new Error(`update ${payload.name}: ${uErr.message}`);
        updated++;
      } else {
        const { data: ins, error: iErr } = await supabase.from("stores")
          .insert(payload).select("store_id").single();
        if (iErr) throw new Error(`insert ${payload.name}: ${iErr.message}`);
        storeId = (ins as { store_id: string }).store_id;
        created++;
      }
      pilot.add(storeId);
      // Contacto primario (encargado).
      if (r.encargado) {
        const { data: prim } = await supabase.from("contacts").select("contact_id")
          .eq("store_id", storeId).eq("is_primary", true).eq("active", true).maybeSingle();
        const cp = {
          store_id: storeId, full_name: r.encargado, role_title: "Encargado",
          phone: r.telefono, email: r.email, birthday: r.birthday, is_primary: true, active: true,
        };
        if (prim) {
          const { error: e } = await supabase.from("contacts").update(cp)
            .eq("contact_id", (prim as { contact_id: string }).contact_id);
          if (e) throw new Error(`update contact ${r.encargado}: ${e.message}`);
        } else {
          const { error: e } = await supabase.from("contacts").insert(cp);
          if (e) throw new Error(`insert contact ${r.encargado}: ${e.message}`);
        }
        contacts++;
      }
    } else {
      if (storeId) updated++; else created++;
      if (r.encargado) contacts++;
    }
    idByKey.set(key, storeId);
  }
  console.log(`✓ Sucursales: ${updated} ${commit ? "actualizadas" : "a actualizar"}, ${created} ${commit ? "creadas" : "a crear"}, ${contacts} encargados. Total=${completas.length}.`);
  return { pilot, idByKey };
}
