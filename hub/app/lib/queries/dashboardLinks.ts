import { serializeTaskParams } from "./taskUrl";
import { ANOMALIA_CUALQUIERA, DEFAULT_TASK_FILTER, type AgeBucket } from "./taskFilters";
import { serializePeriodo } from "./period";
import { FILTRO_SIN_VENDEDOR } from "./config";

// Destinos del dashboard (spec Bloque 2 §2.1). Se arman con los mismos
// serializadores que usan las pantallas, para que un enlace y un filtro
// elegido a mano produzcan la misma URL.

const tareas = (patch: Partial<typeof DEFAULT_TASK_FILTER>) => {
  const q = serializeTaskParams({ ...DEFAULT_TASK_FILTER, ...patch });
  return q ? `/panel/tareas?${q}` : "/panel/tareas";
};

// El tramo "+30" de fn_dash_backlog_tareas se llama "30+" en el panel.
const TRAMO: Record<string, AgeBucket> = { "0-7": "0-7", "8-15": "8-15", "16-30": "16-30", "+30": "30+" };

export const linkMercaderistas = (desde: string, hasta: string) => `/panel/mercaderistas?${serializePeriodo(desde, hasta)}`;
export const linkMercaderista = (userId: string, desde: string, hasta: string) =>
  `/panel/mercaderistas/${userId}?${serializePeriodo(desde, hasta)}`;
export const linkTareasAnomalias = (codigo: string | null, desde: string, hasta: string) =>
  tareas({ status: "all", anomalia: codigo ?? ANOMALIA_CUALQUIERA, desde, hasta });
export const linkTareasAbiertas = () => tareas({});
export const linkTareasViejas = () => tareas({ antiguedad: ["16-30", "30+"] });
export const linkTareasTramo = (tramoDb: string) => tareas({ antiguedad: TRAMO[tramoDb] ? [TRAMO[tramoDb]] : [] });
export const linkCadena = (clientId: string | null) => (clientId ? `/panel/tiendas?client=${encodeURIComponent(clientId)}` : null);
export const linkTienda = (storeId: string) => `/panel/tiendas/${storeId}`;
export const linkSinVendedor = () => `/panel/configuracion/vendedores?filtro=${FILTRO_SIN_VENDEDOR}`;
