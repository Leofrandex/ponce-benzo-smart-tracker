"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchClients, fetchStoreGeo } from "@/app/lib/queries/clients";
import { fetchTaskAssignees } from "@/app/lib/queries/assignments";
import {
  filtrarClientes, opcionesGeoClientes, parseClientesParams, serializeClientesParams,
  type ClientesFiltro,
} from "@/app/lib/queries/clientFilters";
import { Select } from "@/app/components/ui/Select";
import { CHANNEL_LABELS } from "@/app/components/clientes/ClientesTable";

function ClientesInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qs = sp.toString();
  const filters = useMemo(() => parseClientesParams(new URLSearchParams(qs)), [qs]);

  const { data: clients, loading, error } = useSupabaseQuery(fetchClients, []);
  const { data: storeGeo } = useSupabaseQuery(fetchStoreGeo, []);
  const { data: rawAssignees } = useSupabaseQuery(fetchTaskAssignees, []);
  const assignees = useMemo(() => rawAssignees ?? [], [rawAssignees]);

  const setFilters = (f: ClientesFiltro) => {
    const next = serializeClientesParams(f);
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const { estados, municipios } = useMemo(
    () => opcionesGeoClientes(storeGeo ?? [], filters.estado),
    [storeGeo, filters.estado],
  );
  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assignees) m.set(a.user_id, a.full_name);
    return Array.from(m, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [assignees]);

  const rows = useMemo(
    () => filtrarClientes(clients ?? [], storeGeo ?? [], filters, assignees),
    [clients, storeGeo, filters, assignees],
  );

  const hasFilters = !!(filters.estado || filters.municipio || filters.vendedor);
  const extraParams = new URLSearchParams();
  if (filters.vendedor) extraParams.set("vendedor", filters.vendedor);
  if (filters.estado) extraParams.set("estado_geo", filters.estado);
  if (filters.municipio) extraParams.set("municipio", filters.municipio);
  const extraQs = extraParams.toString();

  if (error) return <div className="empty-state"><div className="empty-title">Error al cargar clientes</div><div className="empty-desc">{error}</div></div>;
  return (
    <>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>Clientes</h1>
        <p className="text-muted text-sm" style={{ marginTop: "4px" }}>{loading ? "Cargando…" : hasFilters ? `${rows.length} de ${(clients ?? []).length} cadenas` : `${rows.length} cadenas`}</p>
      </div>
      <div className="card" style={{ padding: "12px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
        <Select label="Estado" value={filters.estado}
          options={estados.map((e) => ({ value: e, label: e }))}
          onChange={(estado) => setFilters({ ...filters, estado, municipio: "" })} />
        <Select label="Municipio" value={filters.municipio}
          options={municipios.map((m) => ({ value: m, label: m }))}
          disabled={municipios.length === 0}
          onChange={(municipio) => setFilters({ ...filters, municipio })} />
        <Select label="Vendedor" value={filters.vendedor}
          options={vendedores}
          onChange={(vendedor) => setFilters({ ...filters, vendedor })} />
        {hasFilters && (
          <button className="filter-chip" onClick={() => setFilters({ estado: "", municipio: "", vendedor: "" })}
            style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>
      {!loading && rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">Sin cadenas</div>
          <div className="empty-desc">Ninguna cadena coincide con los filtros.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {rows.map((c, idx) => (
            <Link key={c.client_id} href={`/panel/tiendas?client=${c.client_id}${extraQs ? `&${extraQs}` : ""}`}
              className="contactos-table-row"
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", textDecoration: "none", color: "inherit",
                borderTop: idx === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>{c.name}</div>
                <div className="text-muted text-sm">{c.business_channel ? (CHANNEL_LABELS[c.business_channel] ?? c.business_channel) : "—"}</div>
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" }}>
                {c.store_count} {c.store_count === 1 ? "sucursal" : "sucursales"}
              </span>
              <ChevronRight size={15} color="var(--text-muted)" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}>
      <ClientesInner />
    </Suspense>
  );
}
