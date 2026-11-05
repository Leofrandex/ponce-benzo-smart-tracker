import { getSupabaseBrowser } from "../supabase/client";
import { fetchAllPages } from "./paginate";
import type { CtxTiendas, CtxClientes } from "../carga/validar";

// Lectura sin filtro `active`: una tienda o cliente inactivo tambien cuenta como repetido.
// Se pagina con orden estable para que el tope de 1.000 filas de PostgREST no recorte nada.
async function todas<T>(tabla: string, columnas: string, orden: string, igual: Record<string, string | boolean> = {}): Promise<T[]> {
  const sb = getSupabaseBrowser();
  return fetchAllPages<T>(async (from, to) => {
    const { data, error } = await sb.from(tabla).select(columnas).match(igual).order(orden).range(from, to);
    if (error) throw error;
    return (data ?? []) as unknown as T[];
  });
}

export async function fetchContextoTiendas(): Promise<CtxTiendas> {
  const [clientes, tiendas, codigos] = await Promise.all([
    todas<CtxTiendas["clientes"][number]>("clients", "client_id, name", "client_id", { active: true }),
    todas<CtxTiendas["tiendas"][number]>("stores", "client_id, name, pdv_code", "store_id"),
    todas<CtxTiendas["codigos"][number]>("store_code_aliases", "code, kind", "code"),
  ]);
  return { clientes, tiendas, codigos };
}

export async function fetchContextoClientes(): Promise<CtxClientes> {
  const [clientes, vendedores] = await Promise.all([
    todas<CtxClientes["clientes"][number]>("clients", "name, rif", "client_id"),
    todas<CtxClientes["vendedores"][number] & { id: string }>("users", "id, full_name", "id", { role: "vendedor", active: true }),
  ]);
  return { clientes, vendedores: vendedores.map((u) => ({ user_id: u.id, full_name: u.full_name })) };
}
