"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchClients, fetchStoreGeo, filterClientsByEstado, estadoOptions } from "@/app/lib/queries/clients";
import { Select } from "@/app/components/ui/Select";

export default function ClientesPage() {
  const { data: clients, loading, error } = useSupabaseQuery(fetchClients, []);
  const { data: storeGeo } = useSupabaseQuery(fetchStoreGeo, []);
  const [estado, setEstado] = useState("");

  const estados = useMemo(() => estadoOptions(storeGeo ?? []), [storeGeo]);
  const rows = useMemo(
    () => filterClientsByEstado(clients ?? [], storeGeo ?? [], estado),
    [clients, storeGeo, estado],
  );

  if (error) return <div className="empty-state"><div className="empty-title">Error al cargar clientes</div><div className="empty-desc">{error}</div></div>;
  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Clientes</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>{loading ? "Cargando…" : `${rows.length} cadenas`}</p>
      </div>
      <div className="card" style={{ padding: "12px", display: "flex", gap: "10px", alignItems: "flex-end" }}>
        <Select label="Estado" value={estado}
          options={estados.map((e) => ({ value: e, label: e }))}
          onChange={setEstado} />
        {estado && (
          <button className="filter-chip" onClick={() => setEstado("")} style={{ marginLeft: "auto" }}>
            Limpiar
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
        {rows.map((c) => (
          <Link key={c.client_id} href={`/supervisor/tiendas?client=${c.client_id}`} className="card"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Store size={18} />
              <div><div style={{ fontWeight: 700 }}>{c.name}</div><div className="text-muted text-sm">{c.business_channel ?? "—"}</div></div>
            </div>
            <span className="filter-chip">{c.store_count} sucursales</span>
          </Link>
        ))}
      </div>
    </>
  );
}
