"use client";

import { X } from "lucide-react";
import { mockStores } from "@/app/lib/mock-data";
import { Select } from "@/app/components/ui/Select";
import { GeoFilters } from "@/app/components/geo/GeoFilters";

export interface ClientesFilterValue {
  clientId: string;           // "" = all (cadena/cliente)
  estado: string;
  municipio: string;
  urbanizacion: string;
  channel: string;            // "" = all
  classifications: string[];  // subset of ["A","B","C"]
}

export const EMPTY_FILTERS: ClientesFilterValue = {
  clientId: "", estado: "", municipio: "", urbanizacion: "", channel: "", classifications: [],
};

const CHANNELS = ["drogueria", "farmacia", "supermercado", "autoservicio", "mayorista", "otro"];
const CHANNEL_LABELS: Record<string, string> = {
  drogueria: "Droguería", farmacia: "Farmacia", supermercado: "Supermercado",
  autoservicio: "Autoservicio", mayorista: "Mayorista", otro: "Otro",
};

export function ClientesFilters({
  value, onChange, clients = [],
}: {
  value: ClientesFilterValue;
  onChange: (v: ClientesFilterValue) => void;
  clients?: { client_id: string; name: string }[];
}) {

  const isDirty =
    value.clientId || value.estado || value.municipio || value.urbanizacion || value.channel || value.classifications.length > 0;

  function toggleClass(c: string) {
    const has = value.classifications.includes(c);
    onChange({ ...value, classifications: has ? value.classifications.filter((x) => x !== c) : [...value.classifications, c] });
  }

  return (
    <div className="card" style={{ padding: "12px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
      <Select label="Cliente" value={value.clientId}
        options={clients.map((c) => ({ value: c.client_id, label: c.name }))}
        onChange={(v) => onChange({ ...value, clientId: v })} />
      <GeoFilters
        items={mockStores}
        value={{ estado: value.estado, municipio: value.municipio, urbanizacion: value.urbanizacion }}
        onChange={(g) => onChange({ ...value, ...g })}
      />
      <Select label="Canal" value={value.channel}
        options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] ?? c }))}
        onChange={(v) => onChange({ ...value, channel: v })} />

      <div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Clasificación</div>
        <div style={{ display: "flex", gap: "4px" }}>
          {["A", "B", "C"].map((c) => (
            <button key={c} onClick={() => toggleClass(c)}
              className={`filter-chip ${value.classifications.includes(c) ? "active" : ""}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {isDirty && (
        <button className="filter-chip" onClick={() => onChange(EMPTY_FILTERS)}
          style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
          <X size={12} /> Limpiar filtros
        </button>
      )}
    </div>
  );
}
