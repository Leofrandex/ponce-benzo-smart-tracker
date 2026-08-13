// Convierte las filas del Excel "Lista de asesores gerente y clientes" en
// asignaciones usuario↔cliente. Lógica pura: sin I/O ni Supabase.

// Nombre corto del Excel -> nombre del cliente en public.clients.
// null = existe en el Excel pero no en el sistema (se descarta).
export const SHORT_NAME_TO_CLIENT: Record<string, string | null> = {
  "20 FARMATODO": "FARMATODO,C.A.",
  "65 LOCATEL": "LOCATEL",
  "55 PLANSUAREZ": "PLAN SUAREZ",
  "GAMA": "GAMA",
  "PLAZAS": "PLAZA'S",
  "RÍO MARKET": "RIO SUPERMARKET",
  "SUPERM RIO VIDA": "RIO VIDA",
  "AUT LA MURALLA": "LA MURALLA 1061",
  "PÁRAMO": "PARAMO",
  "FARMATENCION": "PHARMATENCION",
  "CENTRAL MADEIRENSE": "CENTRAL MADEIRENSE",
  "EMPORIUM": "EMPORIUM",
  "FRESCO MARKET": "FRESCO MARKET",
  "MARAPLUS": "MARAPLUS",
  "MUNDO TOTAL": "MUNDO TOTAL",
  "RED VITAL": "RED VITAL",
  "TIO AMMI": "TIO AMMI",
  // Presentes en el Excel pero inexistentes en el sistema (2026-08-12):
  "FARMATUYA": null,
  "TODO BARATIIICO": null,
  "VIVA SUPERCENTRO": null,
};

export interface FilaExcel {
  nombreCorto: string;
  asesor: string;
  gerente: string;
  mailAsesor: string;
  mailGerente: string;
}

export interface Persona {
  nombre: string;
  email: string;
  clientes: string[];
}

// Mayúsculas, sin acentos, espacios colapsados. La deduplicación va por el
// NOMBRE porque los correos del Excel tienen errores de copiar/pegar.
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas diacriticas combinantes
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function construirAsignaciones(filas: FilaExcel[]): Persona[] {
  const acc = new Map<string, { email: string; clientes: Set<string> }>();

  function agregar(nombreCrudo: string, mail: string, cliente: string) {
    const nombre = normalizarNombre(nombreCrudo);
    if (!nombre) return;
    const email = mail.trim().toLowerCase();
    const actual = acc.get(nombre);
    if (!actual) {
      acc.set(nombre, { email, clientes: new Set([cliente]) });
      return;
    }
    actual.clientes.add(cliente);
    // Un correo vacío nunca pisa a uno ya conocido.
    if (!actual.email && email) actual.email = email;
  }

  for (const f of filas) {
    const cliente = SHORT_NAME_TO_CLIENT[f.nombreCorto.trim()];
    if (!cliente) continue; // desconocido o inexistente en la base
    agregar(f.asesor, f.mailAsesor, cliente);
    agregar(f.gerente, f.mailGerente, cliente);
  }

  return [...acc.entries()]
    .map(([nombre, v]) => ({ nombre, email: v.email, clientes: [...v.clientes] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
