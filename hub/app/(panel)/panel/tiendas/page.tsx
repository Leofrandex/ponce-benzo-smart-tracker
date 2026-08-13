"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStores } from "@/app/lib/queries/stores";
import { fetchTasks } from "@/app/lib/queries/tasks";
import { fetchClients } from "@/app/lib/queries/clients";
import { deriveClientRows } from "@/app/lib/queries/derive";
import { ClientesFilters, EMPTY_FILTERS, type ClientesFilterValue } from "@/app/components/clientes/ClientesFilters";
import { ClientesTable } from "@/app/components/clientes/ClientesTable";

export default function TiendasPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}>
      <TiendasInner />
    </Suspense>
  );
}

function TiendasInner() {
  const sp = useSearchParams();
  const initialClient = sp.get("client") ?? "";

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClientesFilterValue>({ ...EMPTY_FILTERS, clientId: initialClient });

  const { data: stores, loading: loadingStores, error } = useSupabaseQuery(fetchStores, []);
  const { data: tasks } = useSupabaseQuery(fetchTasks, []);
  const { data: clients } = useSupabaseQuery(fetchClients, []);

  const allRows = useMemo(
    () => deriveClientRows(stores ?? [], [], tasks ?? []),
    [stores, tasks],
  );

  const rows = useMemo(() => {
    return allRows.filter((s) => {
      if (filters.clientId && s.client_id !== filters.clientId) return false;
      if (filters.estado && s.estado !== filters.estado) return false;
      if (filters.municipio && s.municipio !== filters.municipio) return false;
      if (filters.urbanizacion && s.urbanizacion !== filters.urbanizacion) return false;
      if (filters.channel && s.business_channel !== filters.channel) return false;
      if (filters.classifications.length > 0 && (!s.classification || !filters.classifications.includes(s.classification))) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allRows, search, filters]);

  if (error) {
    return <div className="empty-state"><div className="empty-title">Error al cargar clientes</div><div className="empty-desc">{error}</div></div>;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Tiendas</h1>
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
        <input className="form-input" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "34px" }} />
      </div>

      <ClientesFilters value={filters} onChange={setFilters} clients={clients ?? []} stores={stores ?? []} />
      <ClientesTable rows={rows} />
    </>
  );
}
