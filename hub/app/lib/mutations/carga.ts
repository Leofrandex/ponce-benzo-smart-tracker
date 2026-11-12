import { getSupabaseBrowser } from "../supabase/client";
import type { TiendaInput, ClienteInput } from "../types";
import { payloadTiendas, payloadClientes, type FilaCarga } from "../carga/panel";

export type ResultadoCarga = { insertadas: number; repetidas: { fila: number; motivo: string }[]; error?: string };

async function llamar(fn: string, filas: unknown[]): Promise<ResultadoCarga> {
  const { data, error } = await getSupabaseBrowser().rpc(fn, { p_filas: filas });
  if (error) return { insertadas: 0, repetidas: [], error: error.message };
  const d = (data ?? {}) as Partial<ResultadoCarga>;
  return { insertadas: d.insertadas ?? 0, repetidas: d.repetidas ?? [] };
}

// Todo o nada: cualquier error que no sea "repetida" aborta la transaccion completa.
export const cargarTiendas = (filas: FilaCarga<TiendaInput>[]) => llamar("fn_cargar_tiendas", payloadTiendas(filas));
export const cargarClientes = (filas: FilaCarga<ClienteInput>[]) => llamar("fn_cargar_clientes", payloadClientes(filas));
