"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Select } from "@/app/components/ui/Select";
import { VENDEDOR_NINGUNO, type TaskFilterOptions, type TaskFilterValue } from "@/app/lib/queries/taskFilters";

const LABEL_STYLE = { fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" } as const;
const INPUT_STYLE = {
  width: "100%", padding: "8px 12px", fontFamily: "inherit", fontSize: "13px", fontWeight: 500,
  color: "var(--text-primary)", background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", transition: "border-color var(--duration) var(--ease)",
  // Misma altura que los Select: el input date es 2px más alto y desalinea las etiquetas.
  height: "37px", boxSizing: "border-box",
} as const;

// Selects de vendedor / cliente / tipo / anomalía / producto / línea, periodo
// de creación y buscador. Solo UI: la lógica vive en lib/queries/taskFilters.ts.
export function TaskFilters({
  value, onChange, options, vendedorDisabled,
}: {
  value: TaskFilterValue;
  onChange: (v: TaskFilterValue) => void;
  options: TaskFilterOptions;
  vendedorDisabled?: boolean;
}) {
  const vendedores = [...options.vendedores, { value: VENDEDOR_NINGUNO, label: "Sin vendedor" }];

  // Búsqueda con debounce: el texto local se muestra al instante; el filtro
  // (y su round-trip a la URL) se dispara 300ms después de dejar de tipear.
  // `valueRef` evita pisar cambios de otros selects hechos durante la espera.
  const [texto, setTexto] = useState(value.texto);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastPushed = useRef(value.texto);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.texto !== lastPushed.current) {
      lastPushed.current = value.texto;
      setTexto(value.texto);
    }
  }, [value.texto]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleTextoChange(next: string) {
    setTexto(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastPushed.current = next;
      onChange({ ...valueRef.current, texto: next });
    }, 300);
  }

  return (
    <>
      <Select label="Vendedor" value={value.vendedor} options={vendedores} disabled={vendedorDisabled}
        onChange={(v) => onChange({ ...value, vendedor: v })} />
      <Select label="Cliente" value={value.cliente} options={options.clientes}
        onChange={(v) => onChange({ ...value, cliente: v })} />
      <Select label="Tipo" value={value.tipo} options={options.tipos}
        onChange={(v) => onChange({ ...value, tipo: v })} />
      <Select label="Anomalía" value={value.anomalia} options={options.anomalias}
        onChange={(v) => onChange({ ...value, anomalia: v })} />
      <Select label="Producto" value={value.producto} options={options.productos}
        onChange={(v) => onChange({ ...value, producto: v })} />
      <Select label="Línea" value={value.linea} options={options.lineas}
        onChange={(v) => onChange({ ...value, linea: v })} />
      <label style={{ display: "flex", flexDirection: "column", flex: "0 1 150px" }}>
        <span style={LABEL_STYLE}>Creadas desde</span>
        <input type="date" value={value.desde} max={value.hasta || undefined}
          onChange={(e) => onChange({ ...value, desde: e.target.value })} aria-label="Creadas desde" style={INPUT_STYLE} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", flex: "0 1 150px" }}>
        <span style={LABEL_STYLE}>Hasta</span>
        <input type="date" value={value.hasta} min={value.desde || undefined}
          onChange={(e) => onChange({ ...value, hasta: e.target.value })} aria-label="Creadas hasta" style={INPUT_STYLE} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", flex: "1 1 220px", minWidth: 0 }}>
        <span style={LABEL_STYLE}>Buscar</span>
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "12px", pointerEvents: "none" }} />
          <input
            type="search"
            value={texto}
            onChange={(e) => handleTextoChange(e.target.value)}
            placeholder="Tienda, título o descripción"
            aria-label="Buscar tareas"
            style={{ ...INPUT_STYLE, padding: "8px 12px 8px 32px" }}
          />
        </span>
      </label>
    </>
  );
}
