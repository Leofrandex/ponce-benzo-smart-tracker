import * as xlsx from "xlsx";
import { parseCoord, parseVisitDays } from "./chains";
import { cleanStoreName } from "./helpers";

export interface FarmatodoRow {
  nombreTienda: string; lat: number; lng: number;
  direccion: string | null; municipio: string | null; ciudad: string | null;
  estado: string | null; region: string | null;
  encargado: string | null; telefono: string | null; email: string | null; birthday: string | null;
  merch: string; weekdays: number[];
}
const C = { nombre:4, coord:5, municipio:6, ciudad:7, estado:8, direccion:9, region:10,
  merch:11, encargado:12, telefono:13, email:14, cumple:15, dia:18 };
const txt = (v: unknown): string | null => { if (v == null) return null; const s = String(v).replace(/\s+/g," ").trim(); return s.length ? s : null; };
function parseBirthday(v: unknown): string | null {
  if (typeof v === "number" && isFinite(v) && v > 0) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}
export function parseFarmatodo(filePath: string): FarmatodoRow[] {
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null }) as unknown[][];
  const out: FarmatodoRow[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const nombre = txt(r[C.nombre]); if (!nombre) continue;
    const coord = parseCoord(r[C.coord]); if (!coord) continue;
    out.push({
      nombreTienda: cleanStoreName(nombre).toUpperCase(), lat: coord.lat, lng: coord.lng,
      direccion: txt(r[C.direccion]), municipio: txt(r[C.municipio]), ciudad: txt(r[C.ciudad]),
      estado: txt(r[C.estado]), region: txt(r[C.region]),
      encargado: txt(r[C.encargado]), telefono: txt(r[C.telefono]), email: txt(r[C.email]), birthday: parseBirthday(r[C.cumple]),
      merch: (txt(r[C.merch]) ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
      weekdays: parseVisitDays(r[C.dia]),
    });
  }
  return out;
}
