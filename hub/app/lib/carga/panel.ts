import type { TiendaInput, ClienteInput } from "../types";
import type { Clasificada } from "./validar";
import type { TipoCarga } from "./excel";

export type Resumen = { listas: number; repetidas: number; errores: number };
export type FilaCarga<T> = { fila: number; datos: T };
export type RepetidaBase = { fila: number; motivo: string };

export function agrupar<T>(filas: Clasificada<T>[]) {
  return {
    listas: filas.filter((f): f is Extract<Clasificada<T>, { estado: "lista" }> => f.estado === "lista"),
    repetidas: filas.filter((f): f is Extract<Clasificada<T>, { estado: "repetida" }> => f.estado === "repetida"),
    errores: filas.filter((f): f is Extract<Clasificada<T>, { estado: "error" }> => f.estado === "error"),
  };
}

export function textoResumen(r: Resumen): string {
  return [
    `${r.listas} ${r.listas === 1 ? "lista" : "listas"} para cargar`,
    `${r.repetidas} ${r.repetidas === 1 ? "repetida" : "repetidas"}`,
    `${r.errores} ${r.errores === 1 ? "con error" : "con errores"}`,
  ].join(" · ");
}

const NOMBRE: Record<TipoCarga, [string, string]> = { tiendas: ["tienda", "tiendas"], clientes: ["cliente", "clientes"] };
export const sustantivo = (tipo: TipoCarga, n: number) => NOMBRE[tipo][n === 1 ? 0 : 1];
export const etiquetaCargar = (tipo: TipoCarga, n: number) => `Cargar ${n} ${sustantivo(tipo, n)}`;

const opc = <V>(x: V | undefined | null): V | null => (x === undefined || x === "" ? null : (x as V | null));

// Forma exacta que lee fn_cargar_tiendas.
export function payloadTiendas(filas: FilaCarga<TiendaInput>[]) {
  return filas.map(({ fila, datos: d }) => ({
    fila, client_id: d.client_id, name: d.name, business_channel: d.business_channel,
    estado: d.estado, municipio: d.municipio, address: d.address,
    urbanizacion: opc(d.urbanizacion), ciudad: opc(d.ciudad), region: opc(d.region),
    master_lat: opc(d.master_lat), master_lng: opc(d.master_lng), pdv_code: opc(d.pdv_code),
  }));
}

// Forma exacta que lee fn_cargar_clientes.
export function payloadClientes(filas: FilaCarga<ClienteInput>[]) {
  return filas.map(({ fila, datos: d }) => ({
    fila, name: d.name, business_channel: d.business_channel, rif: opc(d.rif), vendedor_id: opc(d.vendedor_id),
  }));
}

// Las repetidas que detecta la base traen solo el numero de fila; el nombre sale de la validacion.
export function repetidasConNombre<T>(repetidas: RepetidaBase[], filas: Clasificada<T>[]) {
  const nombre = new Map(filas.map((f) => [f.fila, f.nombre]));
  return repetidas.map((r) => ({ fila: r.fila, nombre: nombre.get(r.fila) ?? "", motivo: r.motivo }));
}
