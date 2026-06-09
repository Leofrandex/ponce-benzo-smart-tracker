// tools/ingesta/helpers.ts
export type BusinessChannel =
  | "drogueria" | "farmacia" | "supermercado"
  | "autoservicio" | "mayorista" | "otro";

// Lookup cadena -> canal (decisión: MAESTRO es la verdad). Match por primer token.
const CHAIN_RULES: Array<[RegExp, BusinessChannel]> = [
  [/^(FTD|FTO|TDF)\b/, "farmacia"],     // Farmatodo + typos
  [/^LOCATEL\b/,       "farmacia"],
  [/^GAMA\b/,          "supermercado"],
  [/^PLAZAS?\b/,       "supermercado"], // PLAZA / PLAZAS
];

export function channelForStore(name: string): BusinessChannel {
  const n = cleanStoreName(name).toUpperCase();
  for (const [re, ch] of CHAIN_RULES) if (re.test(n)) return ch;
  return "otro";
}

// Recorta extremos y colapsa espacios internos; NO corrige typos.
export function cleanStoreName(name: string): string {
  return String(name ?? "").replace(/\s+/g, " ").trim();
}

// Clave natural para idempotencia (case-insensitive).
export function storeKey(name: string): string {
  return cleanStoreName(name).toUpperCase();
}

// Fecha ISO (YYYY-MM-DD) para una "Ruta N" del Excel, anclada al lunes de la
// semana ACTUAL de `from` (lunes en/antes de hoy). Cada hoja de asesor tiene
// rutas numeradas; el número codifica día y semana de rotación:
//   weekOffset = floor((N-1)/5)  (0 = esta semana, 1 = la siguiente)
//   weekday    = (N-1) % 5       (0 = Lunes … 4 = Viernes)
// Ej.: Ruta 1→Lun, Ruta 2→Mar, …, Ruta 5→Vie; Ruta 6→Lun (sem. siguiente), …
export function dateForRuta(rutaNumber: number, from: Date): string {
  const weekOffset = Math.floor((rutaNumber - 1) / 5);
  const weekday = (rutaNumber - 1) % 5;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Dom,1=Lun,...6=Sab
  const deltaToMonday = dow === 0 ? -6 : 1 - dow; // lunes de la semana actual (en/antes de hoy)
  const target = new Date(d);
  target.setUTCDate(d.getUTCDate() + deltaToMonday + weekOffset * 7 + weekday);
  return target.toISOString().slice(0, 10);
}
