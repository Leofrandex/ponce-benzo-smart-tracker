import type { TiendaInput, ClienteInput } from "../types";

const vacio = (s: string | null | undefined) => !s || s.trim() === "";

// Devuelven las etiquetas visibles de los obligatorios que faltan, en el orden del formulario.
export function faltantesTienda(v: TiendaInput): string[] {
  const f: string[] = [];
  if (vacio(v.client_id)) f.push("Cliente");
  if (vacio(v.name)) f.push("Nombre");
  if (vacio(v.business_channel)) f.push("Canal");
  if (vacio(v.estado)) f.push("Estado");
  if (vacio(v.municipio)) f.push("Municipio");
  if (vacio(v.address)) f.push("Dirección");
  return f;
}

export function faltantesCliente(v: ClienteInput): string[] {
  const f: string[] = [];
  if (vacio(v.name)) f.push("Nombre");
  if (vacio(v.business_channel)) f.push("Canal");
  return f;
}
