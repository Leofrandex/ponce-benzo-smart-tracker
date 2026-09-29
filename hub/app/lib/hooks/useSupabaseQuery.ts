"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Caché en memoria compartida por todo el panel (stale-while-revalidate).
// Con `key`, volver a una sección pinta al instante lo último que se leyó y
// refresca por detrás; sin `key` el hook se comporta como siempre.
// Vive solo en esta pestaña: se pierde al recargar y se vacía al cerrar sesión.
const cache = new Map<string, unknown>();
// Misma consulta pedida a la vez por varias secciones (p. ej. vendedores) = un solo request.
const inflight = new Map<string, Promise<unknown>>();

export function clearQueryCache() {
  cache.clear();
  inflight.clear();
}

// Hook genérico de lectura: ejecuta `fetcher` y expone estados.
// `deps` controla cuándo re-ejecutar (igual semántica que useEffect deps).
// `key` (opcional) activa la caché: el dato se guarda bajo `key` + `deps`.
//   - `loading` es true solo mientras NO hay nada que mostrar para esa key;
//     un refetch con datos en pantalla los mantiene visibles (sin parpadeo).
//   - Al cambiar `deps` (p. ej. otro periodo) no se muestra el dato del periodo
//     anterior: o el cacheado de ese periodo o `null` + loading.
export function useSupabaseQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  key?: string,
): { data: T | null; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const cacheKey = key ? `${key}|${JSON.stringify(deps)}` : null;
  const cached = cacheKey !== null && cache.has(cacheKey) ? (cache.get(cacheKey) as T) : undefined;

  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  // Cambió la key: se adopta lo cacheado en el mismo render, sin esperar al efecto.
  const [shownKey, setShownKey] = useState(cacheKey);
  if (cacheKey !== shownKey) {
    setShownKey(cacheKey);
    if (cacheKey !== null) {
      setData(cached ?? null);
      setLoading(cached === undefined);
      setError(null);
    }
  }

  // Solo la respuesta del último request pinta: una lenta de un periodo viejo no pisa la nueva.
  const reqId = useRef(0);

  const run = useCallback(async (dedupe: boolean) => {
    const id = ++reqId.current;
    if (cacheKey === null || !cache.has(cacheKey)) setLoading(true);
    setError(null);
    try {
      // El montaje reutiliza un request en vuelo; un refetch (tras guardar algo) nunca.
      let p = dedupe && cacheKey !== null ? (inflight.get(cacheKey) as Promise<T> | undefined) : undefined;
      if (!p) {
        const fresh = fetcher();
        p = fresh;
        if (cacheKey !== null) {
          inflight.set(cacheKey, fresh);
          fresh.then(
            () => { if (inflight.get(cacheKey) === fresh) inflight.delete(cacheKey); },
            () => { if (inflight.get(cacheKey) === fresh) inflight.delete(cacheKey); },
          );
        }
      }
      const result = await p;
      if (cacheKey !== null) cache.set(cacheKey, result);
      if (id === reqId.current) setData(result);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  // `deps` las decide quien llama (como en useEffect); `fetcher` cambia en cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps]);

  useEffect(() => { run(true); }, [run]);

  const refetch = useCallback(() => run(false), [run]);

  return { data, loading, error, refetch };
}
