"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { TiendaBuscable } from "@/app/lib/queries/rutaPlan";
import { buscarTiendas } from "@/app/lib/rutas/editorUi";

// Pie de cada columna: busca sucursales activas que no estén ya en ese día.
// Queda abierto tras agregar, para cargar varias seguidas.
export default function AgregarSucursal({ dia, tiendas, yaEnDia, bloqueado, onAgregar }: {
  dia: string; tiendas: TiendaBuscable[]; yaEnDia: Set<string>; bloqueado: boolean; onAgregar: (storeId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const resultados = useMemo(() => buscarTiendas(tiendas, q, yaEnDia), [tiendas, q, yaEnDia]);
  const cerrar = () => { setAbierto(false); setQ(""); };

  if (!abierto) {
    return (
      <button type="button" className="ed-add" disabled={bloqueado} onClick={() => setAbierto(true)}>
        <Plus size={13} aria-hidden /> Agregar sucursal
      </button>
    );
  }

  return (
    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input
          autoFocus
          disabled={bloqueado}
          className="form-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") cerrar(); }}
          placeholder="Nombre, cliente o zona"
          aria-label={`Buscar sucursal para el ${dia.toLowerCase()}`}
          style={{ padding: "6px 8px", fontSize: "var(--text-xs)", minWidth: 0 }}
        />
        <button type="button" onClick={cerrar} aria-label="Cerrar búsqueda" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      {q.trim() && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "180px", overflowY: "auto", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
          {resultados.length === 0 ? (
            <li style={{ padding: "8px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sin resultados</li>
          ) : resultados.map((t) => (
            <li key={t.store_id}>
              <button type="button" className="ed-result" disabled={bloqueado} onClick={() => { onAgregar(t.store_id); setQ(""); }}>
                <span style={{ display: "block", fontWeight: 600 }}>{t.name}</span>
                <span style={{ display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                  {[t.client_name, t.zona].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
