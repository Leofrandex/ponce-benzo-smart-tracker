"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Filter, X } from "lucide-react";
import { useState } from "react";
import { mockStores } from "@/app/lib/mock-data";
import { mockActiveMerchandisers } from "@/app/lib/map-data";

export interface MapFilterValue {
  merchIds: string[];   // empty = all
  storeIds: string[];   // empty = all
}
export const EMPTY_MAP_FILTERS: MapFilterValue = { merchIds: [], storeIds: [] };

export function MapFilters({ value, onChange }: { value: MapFilterValue; onChange: (v: MapFilterValue) => void }) {
  const [open, setOpen] = useState(false);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }
  const activeCount = value.merchIds.length + value.storeIds.length;

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-secondary btn-sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "6px" }} onClick={() => setOpen((o) => !o)}>
        <Filter size={15} /> Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 1000, width: "min(320px, 90vw)", maxHeight: "60vh", overflowY: "auto", background: "white", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "13px" }}>Filtros</strong>
              <button onClick={() => onChange(EMPTY_MAP_FILTERS)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", color: "#2563eb", display: "flex", alignItems: "center", gap: "3px" }}><X size={12} /> Limpiar</button>
            </div>

            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, margin: "6px 0" }}>Mercaderistas</div>
            {mockActiveMerchandisers.map((m) => (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={value.merchIds.includes(m.id)} onChange={() => onChange({ ...value, merchIds: toggle(value.merchIds, m.id) })} />
                {m.name}{m.status === "offline" ? " (offline)" : ""}
              </label>
            ))}

            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, margin: "10px 0 6px" }}>Sucursales</div>
            {mockStores.map((s) => (
              <label key={s.store_id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={value.storeIds.includes(s.store_id)} onChange={() => onChange({ ...value, storeIds: toggle(value.storeIds, s.store_id) })} />
                {s.name}
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
