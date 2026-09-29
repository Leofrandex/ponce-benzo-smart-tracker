"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStores } from "@/app/lib/queries/stores";
import { fetchTasks } from "@/app/lib/queries/tasks";
import { fetchClients } from "@/app/lib/queries/clients";
import { fetchUltimasVisitas } from "@/app/lib/queries/visits";
import { fetchTaskAssignees } from "@/app/lib/queries/assignments";
import { deriveClientRows } from "@/app/lib/queries/derive";
import { filtrarTiendas, parseTiendasParams, serializeTiendasParams, type ClientesFilterValue } from "@/app/lib/queries/storeFilters";
import { ClientesFilters } from "@/app/components/clientes/ClientesFilters";
import { ClientesTable } from "@/app/components/clientes/ClientesTable";
import SectionError from "@/app/components/ui/SectionError";

export default function TiendasPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}>
      <TiendasInner />
    </Suspense>
  );
}

function TiendasInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qs = sp.toString();

  const { filters, q } = useMemo(() => parseTiendasParams(new URLSearchParams(qs)), [qs]);

  const setParams = useCallback((f: ClientesFilterValue, query: string) => {
    const next = serializeTiendasParams(f, query);
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Búsqueda con debounce: el texto local se muestra al instante; el filtro
  // (y su round-trip a la URL) se dispara 300ms después de dejar de tipear.
  const [search, setSearch] = useState(q);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const lastPushed = useRef(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q;
      setSearch(q);
    }
  }, [q]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleSearchChange(next: string) {
    setSearch(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastPushed.current = next;
      setParams(filtersRef.current, next);
    }, 300);
  }

  function handleFiltersChange(f: ClientesFilterValue) {
    setParams(f, lastPushed.current);
  }

  const { data: stores, loading: loadingStores, error, refetch: refetchStores } = useSupabaseQuery(fetchStores, []);
  const qTasks = useSupabaseQuery(fetchTasks, []);
  const qClients = useSupabaseQuery(fetchClients, []);
  const qVisits = useSupabaseQuery(fetchUltimasVisitas, []);
  const qAssignees = useSupabaseQuery(fetchTaskAssignees, []);
  const { data: tasks } = qTasks;
  const { data: clients } = qClients;
  const { data: visits } = qVisits;
  const { data: rawAssignees } = qAssignees;

  // Si pendientes o última visita no cargaron, la tabla diría "Sin pendientes" /
  // "Sin visitas": se avisa arriba qué falta, con Reintentar solo de lo fallido.
  const fallidas: { what: string; q: { error: string | null; refetch: () => Promise<void> } }[] = [
    { what: "las tareas", q: qTasks },
    { what: "las visitas", q: qVisits },
    { what: "los clientes", q: qClients },
    { what: "los vendedores", q: qAssignees },
  ].filter((f) => f.q.error);
  // Mientras llegan tareas y visitas, las columnas saldrían en falso vacío.
  const cargandoTabla = loadingStores || (!tasks && !qTasks.error) || (!visits && !qVisits.error);

  const assignees = useMemo(() => rawAssignees ?? [], [rawAssignees]);

  const vendedores = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of assignees) byId.set(a.user_id, a.full_name);
    return Array.from(byId, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [assignees]);

  const allRows = useMemo(
    () => deriveClientRows(stores ?? [], visits ?? [], tasks ?? []),
    [stores, visits, tasks],
  );

  const rows = useMemo(
    () => filtrarTiendas(allRows, filters, search, assignees),
    [allRows, filters, search, assignees],
  );

  if (error) {
    return <SectionError what="las tiendas" detail={error} onRetry={refetchStores} />;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "var(--tracking-tight)" }}>Tiendas</h1>
          <p className="text-muted text-sm" style={{ marginTop: "4px" }}>
            {loadingStores ? "Cargando…" : `${rows.length} de ${(stores ?? []).length} tiendas`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert("La creación de sucursales llega en la siguiente fase (escritura).")}
          className="filter-chip"
          style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}
        >
          <Plus size={12} /> Agregar sucursal
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input className="form-input" placeholder="Buscar por nombre..." value={search} onChange={(e) => handleSearchChange(e.target.value)} style={{ paddingLeft: "34px" }} />
      </div>

      <ClientesFilters value={filters} onChange={handleFiltersChange} clients={clients ?? []} stores={stores ?? []} vendedores={vendedores} />
      {fallidas.length > 0 && (
        <div className="card" style={{ padding: "4px 16px" }}>
          <SectionError
            what={fallidas.map((f) => f.what).join(", ").replace(/, ([^,]*)$/, " y $1")}
            detail={fallidas.map((f) => f.q.error).join(" · ")}
            onRetry={() => { for (const f of fallidas) f.q.refetch(); }}
            compact
          />
        </div>
      )}
      <ClientesTable rows={rows} loading={cargandoTabla} />
    </>
  );
}
