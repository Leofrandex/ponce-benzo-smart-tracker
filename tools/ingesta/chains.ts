import { cleanStoreName, type BusinessChannel } from "./helpers";

const CADENA_RULES: Array<[RegExp, string]> = [
  [/^(FTD|FTO|TDF)\b/, "Farmatodo"],
  [/^LOCATEL\b/,       "Locatel"],
  [/^GAMA\b/,          "Gama"],
  [/^PLAZA(S)?\b/,     "Plaza's"],
];
export function chainForStore(name: string): string | null {
  const n = cleanStoreName(name).toUpperCase();
  for (const [re, c] of CADENA_RULES) if (re.test(n)) return c;
  return null;
}
export function channelForChain(cadena: string): BusinessChannel {
  if (cadena === "Farmatodo" || cadena === "Locatel") return "farmacia";
  if (cadena === "Gama" || cadena === "Plaza's") return "supermercado";
  return "otro";
}
function stripAccents(s: string): string { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
export function normalizeBranch(name: string): string {
  const n = stripAccents(String(name ?? "")).toUpperCase().replace(/\s+/g, " ").trim();
  return n.replace(/^(FTD|FTO|TDF)\s+/, "").trim();
}
export function parseCoord(cell: unknown): { lat: number; lng: number } | null {
  if (cell == null) return null;
  const p = String(cell).trim().split(",");
  if (p.length < 2) return null;
  const lat = parseFloat(p[0].trim()), lng = parseFloat(p[1].trim());
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < 8 || lat > 13 || lng < -74 || lng > -59) return null;
  return { lat, lng };
}
const DAY_MAP: Record<string, number> = { LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6, DOM: 7 };
export function parseVisitDays(cell: unknown): number[] {
  if (cell == null) return [];
  return String(cell).toUpperCase().split(/[-/,]/).map((t) => DAY_MAP[stripAccents(t).trim()])
    .filter((d): d is number => Boolean(d));
}

// Semanas del mes (1..5). Separadores: . - / , y espacios. Dedup + orden asc.
export function parseWeeks(cell: unknown): number[] {
  if (cell == null) return [];
  const set = new Set<number>();
  for (const t of String(cell).split(/[.\-/,\s]+/)) {
    const n = parseInt(t.trim(), 10);
    if (n >= 1 && n <= 5) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
