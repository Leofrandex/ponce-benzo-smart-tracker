"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchClients } from "@/app/lib/queries/clients";

export default function ClientesPage() {
  const { data: clients, loading, error } = useSupabaseQuery(fetchClients, []);
  if (error) return <div className="empty-state"><div className="empty-title">Error al cargar clientes</div><div className="empty-desc">{error}</div></div>;
  const rows = clients ?? [];
  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Clientes</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>{loading ? "Cargando…" : `${rows.length} cadenas`}</p>
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
