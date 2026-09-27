"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TaskFilterValue } from "../queries/taskFilters";
import { parseTaskParams, serializeTaskParams } from "../queries/taskUrl";

// La URL es la fuente de verdad de los filtros de Tareas. Conserva ?task= al
// cambiar filtros para no perder la tarea enlazada. replace (no push): cada
// tecla del buscador no debe llenar el historial del navegador.
export function useTaskFilterUrl(): [TaskFilterValue, (v: TaskFilterValue) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qs = searchParams.toString();

  const value = useMemo(() => parseTaskParams(new URLSearchParams(qs)), [qs]);

  const setValue = useCallback((v: TaskFilterValue) => {
    const next = serializeTaskParams(v, new URLSearchParams(qs).get("task"));
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [router, pathname, qs]);

  return [value, setValue];
}
