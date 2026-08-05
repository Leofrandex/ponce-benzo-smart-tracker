import type { BusinessChannel } from "./helpers";

export function normClient(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[´'`]/g, "").replace(/\s+/g, " ").trim();
}

// Clave = normClient(nombre de cliente). Valor = prefijo del nombre de sucursal.
const PREFIX_BY_CLIENT: Record<string, string> = {
  "FARMATODO,C.A.": "FTD",
  "FARMATODO, C.A.": "FTD",
  "LOCATEL": "LOCATEL",
  "GAMA": "GAMA",
  "PLAZAS": "PLAZA'S",
  "RIO SUPERMARKET": "RIO",
  "CENTRAL MADEIRENSE": "CMD",
  "PARAMO": "PARAMO",
  "MARAPLUS": "MARAPLUS",
  "RED VITAL": "RED VITAL",
  "EMPORIUM": "EMPORIUM",
  "PLAN SUAREZ": "PLAN SUAREZ",
  "LA MURALLA 1061": "MURALLA",
  "RIO VIDA": "RIO VIDA",
  "TIO AMMI": "TIO AMMI",
  "FRESCO MARKET": "FRESCO",
  "HUMMY": "HUMMY",
  "MUNDO TOTAL": "MUNDO TOTAL",
  "DULCINEA 2019": "DULCINEA",
  "PHARMATENCION": "PHARMATENCION",
};

export function prefixForClient(raw: string): string | null {
  return PREFIX_BY_CLIENT[normClient(raw)] ?? null;
}

// Typos del Excel del cliente confirmados por él y corregidos en la ingesta.
// Se arreglan AQUÍ y no editando el .xlsx: el archivo fuente queda idéntico a
// lo que envió el cliente y la corrección es visible/revisable en git.
// Clave: `${normClient(cliente)}|${NOMBRE_EN_EL_EXCEL}` → nombre correcto.
const NAME_FIXES: Record<string, string> = {
  // Excel 2026-08-05: llegó sin la S final (confirmado con el cliente 2026-08-05).
  "CENTRAL MADEIRENSE|PLAZA LAS AMERICA": "PLAZA LAS AMERICAS",
};

export function fixStoreName(cliente: string, nombreTienda: string): string {
  return NAME_FIXES[`${normClient(cliente)}|${nombreTienda}`] ?? nombreTienda;
}

export function channelForCanal(raw: string): BusinessChannel {
  const c = normClient(raw);
  if (c.includes("FARMACIA")) return "farmacia";
  if (c.includes("SUPERMERCADO")) return "supermercado";
  return "otro";
}
