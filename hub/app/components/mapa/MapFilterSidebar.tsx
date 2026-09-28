"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Select } from "@/app/components/ui/Select";
import type { MapMerchandiser } from "@/app/lib/map-data";
import {
  DEFAULT_MAP_FILTER, NINGUNA, TODAS, estadoGrupo, incluye, resumenMapa, setVarios, toggleUno,
  type GrupoCadena, type MapFilterValue,
} from "@/app/lib/queries/mapFilters";
import { normalizeText } from "@/app/lib/queries/taskFilters";

function Casilla({ estado, onClick, label }: { estado: "todas" | "algunas" | "ninguna"; onClick: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={estado === "todas" ? true : estado === "algunas" ? "mixed" : false}
      aria-label={label} onClick={onClick}
      style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, cursor: "pointer", padding: 0,
        border: `1.5px solid ${estado === "ninguna" ? "var(--border)" : "var(--accent)"}`,
        background: estado === "todas" ? "var(--accent)" : "var(--bg-card)", color: "#fff", fontSize: 10, lineHeight: "10px" }}>
      {estado === "todas" ? "✓" : estado === "algunas" ? <span style={{ color: "var(--accent)" }}>–</span> : ""}
    </button>
  );
}

// Chips compactos: los .filter-chip de tamaño normal no caben junto al título en 250px.
const CHIP = { padding: "2px 7px", fontSize: 10 } as const;
const TITLE = { fontSize: 11, letterSpacing: 0.5 } as const;
// Casillas nativas con el mismo acento y tamaño que la casilla de cadena.
const CHECK = { width: 14, height: 14, margin: 0, flexShrink: 0, accentColor: "var(--accent)" } as const;

export function MapFilterSidebar({
  value, onChange, grupos, merchandisers, vendedores, onVendedor,
}: {
  value: MapFilterValue;
  onChange: (v: MapFilterValue) => void;
  grupos: GrupoCadena[];
  merchandisers: MapMerchandiser[];
  vendedores: { value: string; label: string }[];
  onVendedor: (userId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const allStoreIds = useMemo(() => grupos.flatMap((g) => g.tiendas.map((s) => s.store_id)), [grupos]);
  const allMerchIds = useMemo(() => merchandisers.map((m) => m.id), [merchandisers]);
  const k = normalizeText(q);
  const visibles = useMemo(() => grupos
    .map((g) => ({ ...g, tiendas: k ? g.tiendas.filter((s) => normalizeText(s.name).includes(k)) : g.tiendas }))
    .filter((g) => g.tiendas.length > 0), [grupos, k]);
  const dirty = value.tiendas.modo !== "todas" || value.merch.modo !== "todas" || !!value.vendedor;

  return (
    <div style={{ width: 250, flexShrink: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
      <div className="card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{resumenMapa(value, grupos, merchandisers.length)}</span>
        {dirty && (
          <button type="button" aria-label="Restablecer filtros" onClick={() => onChange(DEFAULT_MAP_FILTER)}
            style={{ all: "unset", cursor: "pointer", display: "inline-flex", color: "var(--text-muted)" }}><X size={14} /></button>
        )}
      </div>

      <Select label="Vendedor" value={value.vendedor} options={vendedores} onChange={onVendedor} />

      {/* Mercaderistas */}
      <div className="card" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="section-title" style={TITLE}>Mercaderistas</span>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="filter-chip" style={CHIP} onClick={() => onChange({ ...value, merch: TODAS })}>Todos</button>
            <button type="button" className="filter-chip" style={CHIP} onClick={() => onChange({ ...value, merch: NINGUNA })}>Ninguno</button>
          </span>
        </div>
        {merchandisers.map((m) => {
          const on = incluye(value.merch, m.id);
          return (
            <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" style={CHECK} checked={on} onChange={() => onChange({ ...value, merch: toggleUno(value.merch, m.id, allMerchIds) })} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.name}>{m.name}</span>
              <span style={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", background: m.status !== "offline" ? "var(--success)" : "var(--text-muted)" }}
                title={m.status !== "offline" ? "Activo" : "Desconectado"} />
            </label>
          );
        })}
      </div>

      {/* Sucursales por cadena */}
      <div className="card" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="section-title" style={TITLE}>Sucursales</span>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="filter-chip" style={CHIP} onClick={() => onChange({ ...value, tiendas: TODAS })}>Todas</button>
            <button type="button" className="filter-chip" style={CHIP} onClick={() => onChange({ ...value, tiendas: NINGUNA })}>Ninguna</button>
          </span>
        </div>
        <label style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 6 }}>
          <Search size={13} color="var(--text-muted)" style={{ position: "absolute", left: 8, pointerEvents: "none" }} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tienda" aria-label="Buscar tienda"
            style={{ width: "100%", padding: "6px 8px 6px 26px", fontFamily: "inherit", fontSize: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)" }} />
        </label>
        {visibles.map((g) => {
          const key = g.client_id ?? "__sin__";
          const ids = g.tiendas.map((s) => s.store_id);
          const est = estadoGrupo(value.tiendas, ids);
          const abierto = abiertos[key] ?? !!k;
          return (
            <div key={key} style={{ borderTop: "1px solid var(--border)", padding: "4px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Casilla estado={est} label={`Seleccionar ${g.nombre}`}
                  onClick={() => onChange({ ...value, tiendas: setVarios(value.tiendas, ids, est !== "todas", allStoreIds) })} />
                <button type="button" onClick={() => setAbiertos((s) => ({ ...s, [key]: !abierto }))} aria-expanded={abierto}
                  style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {abierto ? <ChevronDown size={12} style={{ flexShrink: 0 }} /> : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.nombre}>{g.nombre}</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>{g.tiendas.length}</span>
                </button>
              </div>
              {abierto && g.tiendas.map((s) => (
                <label key={s.store_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0 3px 22px", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" style={CHECK} checked={incluye(value.tiendas, s.store_id)}
                    onChange={() => onChange({ ...value, tiendas: toggleUno(value.tiendas, s.store_id, allStoreIds) })} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</span>
                </label>
              ))}
            </div>
          );
        })}
        {visibles.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>Ninguna tienda coincide.</div>}
      </div>
    </div>
  );
}
