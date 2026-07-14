// tools/ingesta/parseTiendas.ts
import * as xlsx from "xlsx";
import { parseCoord, parseVisitDays, parseWeeks } from "./chains";
import { normClient } from "./tiendasConfig";

export interface TiendaRow {
  rowIndex: number; raw: unknown[];
  cliente: string; canal: string; tienda2: string;
  nombreTienda: string; lat: number | null; lng: number | null;
  municipio: string | null; ciudad: string | null; estado: string | null;
  direccion: string | null; region: string | null;
  merch: string;
  encargado: string | null; telefono: string | null; email: string | null; birthday: string | null;
  weekdays: number[]; weeks: number[];
  faltantes: string[];
}

const C = {
  canal: 0, cliente: 1, tienda2: 3, nombre: 4, coord: 5, municipio: 6, ciudad: 7,
  estado: 8, direccion: 9, region: 10, atencion: 11, encargado: 12, tel: 13,
  mail: 14, cumple: 15, dia: 18, semana: 19,
};

const txt = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
};
const nd = (s: string | null): boolean => !s || s.toUpperCase() === "N/D";
const upperNoAccent = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function parseBirthday(v: unknown): string | null {
  if (typeof v === "number" && isFinite(v) && v > 0) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

export function parseTiendas(filePath: string): TiendaRow[] {
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json<unknown[]>(
    wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null },
  ) as unknown[][];

  const out: TiendaRow[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const nombre = txt(r[C.nombre]);
    if (!nombre) continue;

    const coord = parseCoord(r[C.coord]);
    const cliente = txt(r[C.cliente]) ?? "";
    const canal = txt(r[C.canal]) ?? "";
    const merchRaw = txt(r[C.atencion]);
    const merch = merchRaw ? upperNoAccent(merchRaw) : "";
    const weekdays = parseVisitDays(r[C.dia]);
    const weeks = parseWeeks(r[C.semana]);

    const faltantes: string[] = [];
    if (!coord) faltantes.push("coord");
    if (nd(cliente)) faltantes.push("cliente");
    if (nd(canal)) faltantes.push("canal");
    if (nd(merchRaw)) faltantes.push("mercaderista");
    if (weekdays.length === 0) faltantes.push("dia_visita");
    if (weeks.length === 0) faltantes.push("semana");

    out.push({
      rowIndex: i, raw: r,
      cliente, canal, tienda2: txt(r[C.tienda2]) ?? "",
      nombreTienda: nombre.toUpperCase(),
      lat: coord?.lat ?? null, lng: coord?.lng ?? null,
      municipio: txt(r[C.municipio]), ciudad: txt(r[C.ciudad]), estado: txt(r[C.estado]),
      direccion: txt(r[C.direccion]), region: txt(r[C.region]),
      merch,
      encargado: txt(r[C.encargado]), telefono: txt(r[C.tel]), email: txt(r[C.mail]),
      birthday: parseBirthday(r[C.cumple]),
      weekdays, weeks, faltantes,
    });
  }
  return out;
}

export const isComplete = (r: TiendaRow): boolean => r.faltantes.length === 0;

// Desempate de homónimos: base = "PREFIJO NOMBRE". Si colisiona, intenta
// desempatar con municipio; si el municipio NO alcanza para desambiguar
// (municipios repetidos dentro del grupo), cae a índice incremental "(1)","(2)".
export function resolveStoreNames(
  items: { prefix: string; nombre: string; municipio: string | null }[],
): string[] {
  const base = items.map((it) => `${it.prefix} ${it.nombre}`.replace(/\s+/g, " ").trim());

  const groups = new Map<string, number[]>();
  base.forEach((b, i) => {
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(i);
  });

  const result = new Array<string>(items.length);
  for (const [b, idxs] of groups) {
    if (idxs.length === 1) { result[idxs[0]] = b; continue; }

    const withMuni = idxs.map((i) =>
      items[i].municipio ? `${b} (${items[i].municipio})` : null);
    const muniCounts = new Map<string, number>();
    for (const w of withMuni) if (w) muniCounts.set(w, (muniCounts.get(w) ?? 0) + 1);
    const allMuniUnique = withMuni.every((w) => w !== null && muniCounts.get(w) === 1);

    if (allMuniUnique) {
      idxs.forEach((i, k) => { result[i] = withMuni[k]!; });
    } else {
      idxs.forEach((i, k) => { result[i] = `${b} (${k + 1})`; });
    }
  }
  return result;
}

// Guard de integridad: dos sucursales DISTINTAS con la misma coordenada rompen
// la llave única cliente+coord (una se perdería y no se rutearía). Es un error
// de datos, así que se marcan como incompletas ("coord_duplicada") para que
// vuelvan a revisión en vez de corromper la ingesta. Muta `faltantes` in situ.
// Devuelve las claves en conflicto (para reporte).
export function markCoordCollisions(rows: TiendaRow[]): string[] {
  const groups = new Map<string, TiendaRow[]>();
  for (const r of rows) {
    if (!isComplete(r) || r.lat == null || r.lng == null) continue;
    const key = `${normClient(r.cliente)}|${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const conflicts: string[] = [];
  for (const [key, group] of groups) {
    const distinctNames = new Set(group.map((r) => r.nombreTienda));
    if (distinctNames.size > 1) {
      conflicts.push(`${key} → ${[...distinctNames].join(" / ")}`);
      for (const r of group) r.faltantes.push("coord_duplicada");
    }
  }
  return conflicts;
}

// Reexport para consumidores.
export { normClient };
