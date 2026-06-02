"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { mockStores, mockTasks } from "@/app/lib/mock-data";
import { ClientesFilters, EMPTY_FILTERS, type ClientesFilterValue } from "@/app/components/clientes/ClientesFilters";
import { ClientesTable, type ClientRow } from "@/app/components/clientes/ClientesTable";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClientesFilterValue>(EMPTY_FILTERS);

  const rows = useMemo<ClientRow[]>(() => {
    return mockStores
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
  }, [search, filters]);

  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Clientes</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>{rows.length} de {mockStores.length} clientes</p>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input className="form-input" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "34px" }} />
      </div>

      <ClientesFilters value={filters} onChange={setFilters} />
      <ClientesTable rows={rows} />
    </>
  );
}
