import { getSupabaseBrowser } from "../supabase/client";
import { fetchDetalle, type DetalleRow, type Resultado } from "./merchandisers";

// Ruta planificada de un mercaderista por semana (lunes a viernes; sábado y
// domingo solo si tienen ruta). Fechas 'YYYY-MM-DD' de Caracas.

export type RutaRow = { route_date: string; store_ids: string[] };
export type TiendaInfo = { store_id: string; name: string; client_name: string | null };

// resultado null = el día no ha terminado (hoy o futuro): aún no se evalúa.
export type ParadaRuta = { orden: number; store_id: string; name: string; client_name: string | null; resultado: Resultado | null };
export type DiaRuta = { fecha: string; paradas: ParadaRuta[]; fueraDeAlcance: number };

export function sumarDias(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function lunesDe(ymd: string): string {
  const dow = new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = domingo
  return sumarDias(ymd, dow === 0 ? -6 : 1 - dow);
}

// Las tiendas que el usuario no puede ver (vendedor fuera de su cartera) no se
// listan, igual que en el día por día; se cuentan aparte.
export function armarSemana(
  lunes: string, rutas: RutaRow[], tiendas: TiendaInfo[], detalle: DetalleRow[], hoy: string,
): DiaRuta[] {
  const porId = new Map(tiendas.map((t) => [t.store_id, t]));
  const resultado = new Map(detalle.map((d) => [`${d.fecha}|${d.store_id}`, d.resultado]));
  const porFecha = new Map<string, string[]>();
  for (const r of rutas) porFecha.set(r.route_date, [...(porFecha.get(r.route_date) ?? []), ...r.store_ids]);

  const dias: DiaRuta[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i);
    const ids = porFecha.get(fecha) ?? [];
    if (i >= 5 && ids.length === 0) continue;
    const paradas: ParadaRuta[] = [];
    for (const id of ids) {
      const t = porId.get(id);
      if (!t) continue;
      paradas.push({
        orden: paradas.length + 1, store_id: id, name: t.name, client_name: t.client_name,
        resultado: fecha < hoy ? resultado.get(`${fecha}|${id}`) ?? "no_visitada" : null,
      });
    }
    dias.push({ fecha, paradas, fueraDeAlcance: ids.length - paradas.length });
  }
  return dias;
}

export async function fetchRutaSemana(userId: string, lunes: string, hoy: string): Promise<DiaRuta[]> {
  const domingo = sumarDias(lunes, 6);
  const sb = getSupabaseBrowser();
  const { data: rutas, error } = await sb
    .from("routes")
    .select("route_date, store_ids")
    .eq("user_id", userId)
    .eq("is_special", false)
    .gte("route_date", lunes)
    .lte("route_date", domingo);
  if (error) throw error;
  const rows = (rutas ?? []) as RutaRow[];
  const ids = Array.from(new Set(rows.flatMap((r) => r.store_ids)));

  const [tiendas, detalle] = await Promise.all([
    ids.length === 0 ? Promise.resolve([] as TiendaInfo[]) : (async () => {
      const { data, error: e } = await sb.from("stores").select("store_id, name, clients(name)").in("store_id", ids);
      if (e) throw e;
      return (data ?? []).map((s: { store_id: string; name: string; clients: { name: string } | { name: string }[] | null }) => ({
        store_id: s.store_id, name: s.name,
        client_name: Array.isArray(s.clients) ? s.clients[0]?.name ?? null : s.clients?.name ?? null,
      }));
    })(),
    // fn_mercaderista_detalle ya corta en ayer; si la semana es futura no hay nada que evaluar.
    lunes < hoy ? fetchDetalle(userId, lunes, domingo) : Promise.resolve([] as DetalleRow[]),
  ]);
  return armarSemana(lunes, rows, tiendas, detalle, hoy);
}
