"use client";

import { Search } from "lucide-react";
import { Select } from "@/app/components/ui/Select";
import type { TaskFilterOptions, TaskFilterValue } from "@/app/lib/queries/taskFilters";

// Selects de vendedor / cliente / tipo + buscador de texto. Solo UI: la
// lógica de filtrado vive en lib/queries/taskFilters.ts.
export function TaskFilters({
  value, onChange, options, vendedorDisabled,
}: {
  value: TaskFilterValue;
  onChange: (v: TaskFilterValue) => void;
  options: TaskFilterOptions;
  vendedorDisabled?: boolean;
}) {
  return (
    <>
      <Select label="Vendedor" value={value.vendedor} options={options.vendedores} disabled={vendedorDisabled}
        onChange={(v) => onChange({ ...value, vendedor: v })} />
      <Select label="Cliente" value={value.cliente} options={options.clientes}
        onChange={(v) => onChange({ ...value, cliente: v })} />
      <Select label="Tipo" value={value.tipo} options={options.tipos}
        onChange={(v) => onChange({ ...value, tipo: v })} />
      <label style={{ display: "flex", flexDirection: "column", flex: "1 1 220px", minWidth: 0 }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Buscar</span>
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "12px", pointerEvents: "none" }} />
          <input
            type="search"
            value={value.texto}
            onChange={(e) => onChange({ ...value, texto: e.target.value })}
            placeholder="Tienda, título o descripción"
            aria-label="Buscar tareas"
            style={{
              width: "100%", padding: "8px 12px 8px 32px", fontFamily: "inherit", fontSize: "13px", fontWeight: 500,
              color: "var(--text-primary)", background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", transition: "border-color var(--duration) var(--ease)",
            }}
          />
        </span>
      </label>
    </>
  );
}
