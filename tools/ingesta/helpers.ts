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

// Devuelve las fechas ISO (YYYY-MM-DD) de Lun..Vie de la semana de referencia:
// el lunes en/después de `from`.
export function referenceWeekDates(from: Date): string[] {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Dom,1=Lun,...6=Sab
  const deltaToMonday = dow === 1 ? 0 : (8 - dow) % 7; // próximo lunes (hoy si ya es lunes)
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + deltaToMonday);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(monday);
    x.setUTCDate(monday.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}
