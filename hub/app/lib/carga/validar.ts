import type { TiendaInput, ClienteInput } from "../types";
import { CANALES, CANAL_LABEL } from "./canales";
import { faltantesTienda, faltantesCliente } from "./obligatorios";
import { normTexto, normRif } from "./normalizar";

export type FilaCruda = { fila: number; valores: Record<string, string> };

export type Clasificada<T> =
  | { fila: number; nombre: string; estado: "lista"; datos: T }
  | { fila: number; nombre: string; estado: "repetida"; motivo: string }
  | { fila: number; nombre: string; estado: "error"; errores: string[] };

export interface CtxTiendas {
  clientes: { client_id: string; name: string }[];
  tiendas: { client_id: string | null; name: string; pdv_code: string | null }[];
  codigos: { code: string; kind: "alias" | "reservado" }[];
}
export interface CtxClientes {
  clientes: { name: string; rif: string | null }[];
  vendedores: { user_id: string; full_name: string }[];
}

const v = (r: FilaCruda, k: string) => (r.valores[k] ?? "").trim();
const PDV_FORMATO = /^PDV-[0-9]{4,}$/;

function canalDe(s: string): string | null {
  const n = normTexto(s);
  return CANALES.find((c) => c === n || normTexto(CANAL_LABEL[c]) === n) ?? null;
}

// Acepta coma decimal. null = vacio; NaN = no numerico.
function numero(s: string): number | null {
  if (!s) return null;
  return /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : NaN;
}

function buscar<T>(items: T[], nombre: (x: T) => string, texto: string): T[] {
  const n = normTexto(texto);
  return items.filter((x) => normTexto(nombre(x)) === n);
}

export function validarTiendas(filas: FilaCruda[], ctx: CtxTiendas): Clasificada<TiendaInput>[] {
  const reservado = new Set(ctx.codigos.filter((c) => c.kind === "reservado").map((c) => c.code.toUpperCase()));
  const alias = new Set(ctx.codigos.filter((c) => c.kind === "alias").map((c) => c.code.toUpperCase()));
  const codigos = new Set(ctx.tiendas.map((t) => t.pdv_code?.toUpperCase()).filter(Boolean) as string[]);
  const nombres = new Set(ctx.tiendas.map((t) => `${t.client_id}|${normTexto(t.name)}`));

  return filas.map((r): Clasificada<TiendaInput> => {
    const nombre = v(r, "nombre");
    const errores: string[] = [];

    const clienteTxt = v(r, "cliente");
    let client_id: string | null = null;
    if (clienteTxt) {
      const hits = buscar(ctx.clientes, (c) => c.name, clienteTxt);
      if (hits.length === 0) errores.push(`Cliente no existe: ${clienteTxt}`);
      else if (hits.length > 1) errores.push(`Cliente ambiguo: ${clienteTxt}`);
      else client_id = hits[0].client_id;
    }

    const canalTxt = v(r, "canal");
    const canal = canalDe(canalTxt);
    if (canalTxt && !canal) errores.push(`Canal inválido: ${canalTxt}`);

    const datos: TiendaInput = {
      client_id,
      name: nombre,
      business_channel: canal ?? "",
      estado: v(r, "estado"),
      municipio: v(r, "municipio"),
      address: v(r, "direccion"),
    };
    for (const k of ["urbanizacion", "ciudad", "region"] as const) {
      if (v(r, k)) datos[k] = v(r, k);
    }
    // Un cliente escrito pero no resuelto ya tiene su error; no lo contamos tambien como faltante.
    const faltan = faltantesTienda({ ...datos, client_id: clienteTxt ? "x" : null });
    if (faltan.length) errores.push(`Faltan: ${faltan.join(", ")}`);

    const lat = numero(v(r, "latitud"));
    const lng = numero(v(r, "longitud"));
    if (Number.isNaN(lat) || Number.isNaN(lng)) errores.push("Latitud o longitud no numérica");
    else if ((lat === null) !== (lng === null)) errores.push("Latitud y longitud van juntas");
    else if (lat !== null && lng !== null) {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) errores.push("Latitud o longitud fuera de rango");
      else { datos.master_lat = lat; datos.master_lng = lng; }
    }

    const pdv = v(r, "pdv").toUpperCase();
    if (pdv) {
      if (!PDV_FORMATO.test(pdv)) errores.push(`Código PDV con formato inválido: ${v(r, "pdv")}`);
      else if (reservado.has(pdv)) errores.push(`Código PDV reservado: ${pdv}`);
      else datos.pdv_code = pdv;
    }

    if (errores.length) return { fila: r.fila, nombre, estado: "error", errores };

    const clave = `${client_id}|${normTexto(nombre)}`;
    let motivo: string | null = null;
    if (datos.pdv_code && (codigos.has(datos.pdv_code) || alias.has(datos.pdv_code))) motivo = `Código ${datos.pdv_code} ya existe`;
    else if (nombres.has(clave)) motivo = "Ya existe una tienda con ese cliente y nombre";
    if (motivo) return { fila: r.fila, nombre, estado: "repetida", motivo };

    // Solo las filas listas reservan su clave para las siguientes.
    nombres.add(clave);
    if (datos.pdv_code) codigos.add(datos.pdv_code);
    return { fila: r.fila, nombre, estado: "lista", datos };
  });
}

export function validarClientes(filas: FilaCruda[], ctx: CtxClientes): Clasificada<ClienteInput>[] {
  const nombres = new Set(ctx.clientes.map((c) => normTexto(c.name)));
  const rifs = new Set(ctx.clientes.map((c) => normRif(c.rif ?? "")).filter(Boolean));

  return filas.map((r): Clasificada<ClienteInput> => {
    const nombre = v(r, "nombre");
    const errores: string[] = [];

    const canalTxt = v(r, "canal");
    const canal = canalDe(canalTxt);
    if (canalTxt && !canal) errores.push(`Canal inválido: ${canalTxt}`);

    const datos: ClienteInput = { name: nombre, business_channel: canal ?? "" };
    const faltan = faltantesCliente(datos);
    if (faltan.length) errores.push(`Faltan: ${faltan.join(", ")}`);

    const rif = v(r, "rif");
    if (rif) datos.rif = rif;

    const vendTxt = v(r, "vendedor");
    if (vendTxt) {
      const hits = buscar(ctx.vendedores, (x) => x.full_name, vendTxt);
      if (hits.length === 0) errores.push(`Vendedor no es un vendedor activo: ${vendTxt}`);
      else if (hits.length > 1) errores.push(`Vendedor ambiguo: ${vendTxt}`);
      else datos.vendedor_id = hits[0].user_id;
    }

    if (errores.length) return { fila: r.fila, nombre, estado: "error", errores };

    const n = normTexto(nombre);
    const rk = normRif(rif);
    let motivo: string | null = null;
    if (nombres.has(n)) motivo = "Ya existe un cliente con ese nombre";
    else if (rk && rifs.has(rk)) motivo = "Ya existe un cliente con ese RIF";
    if (motivo) return { fila: r.fila, nombre, estado: "repetida", motivo };

    nombres.add(n);
    if (rk) rifs.add(rk);
    return { fila: r.fila, nombre, estado: "lista", datos };
  });
}
