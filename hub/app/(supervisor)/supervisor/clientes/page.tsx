"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { mockStores, mockTasks } from "@/app/lib/mock-data";
import type { Store } from "@/app/lib/types";
import { ClientesFilters, EMPTY_FILTERS, type ClientesFilterValue } from "@/app/components/clientes/ClientesFilters";
import { ClientesTable, type ClientRow } from "@/app/components/clientes/ClientesTable";
import { StoreFormModal } from "@/app/components/clientes/StoreFormModal";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClientesFilterValue>(EMPTY_FILTERS);
  // Mock-first: lista local sembrada con las sucursales mock.
  const [stores, setStores] = useState<Store[]>(() => [...mockStores]);
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreate(store: Store) {
    // Se inserta también en el array mock para que la ficha de detalle la encuentre.
    mockStores.push(store);
    setStores([...mockStores]);
  }

  const rows = useMemo<ClientRow[]>(() => {
    return stores
      .filter((s) => {
        if (filters.estado && s.estado !== filters.estado) return false;
        if (filters.municipio && s.municipio !== filters.municipio) return false;
        if (filters.urbanizacion && s.urbanizacion !== filters.urbanizacion) return false;
        if (filters.channel && s.business_channel !== filters.channel) return false;
        if (filters.classifications.length > 0 && (!s.classification || !filters.classifications.includes(s.classification))) return false;
        if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .map((s) => ({
        ...s,
        pending_tasks: mockTasks.filter((t) => t.store_id === s.store_id && t.status !== "resolved").length,
      }));
  }, [stores, search, filters]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Clientes</h1>
          <p className="text-muted text-sm" style={{ marginTop: "4px" }}>{rows.length} de {stores.length} clientes</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="filter-chip" style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
          <Plus size={12} /> Agregar sucursal
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input className="form-input" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "34px" }} />
      </div>

      <ClientesFilters value={filters} onChange={setFilters} />
      <ClientesTable rows={rows} />

      <StoreFormModal open={createOpen} store={null} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
    </>
  );
}
