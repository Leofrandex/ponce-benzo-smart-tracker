"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Store as StoreIcon, User, X } from "lucide-react";
import type { Store } from "@/app/lib/types";
import type { MapMerchandiser } from "@/app/lib/map-data";

export interface MapFilterValue {
  merchIds: string[];   // empty = all
  storeIds: string[];   // empty = all
}
export const EMPTY_MAP_FILTERS: MapFilterValue = { merchIds: [], storeIds: [] };

function FilterCard({ icon, label, sub, selected, onClick }: {
  icon: React.ReactNode; label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "8px", width: "100%",
      padding: "8px 10px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
      border: selected ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
      background: selected ? "var(--accent-glow)" : "var(--bg-card)",
      fontFamily: "inherit", transition: "border-color var(--duration) var(--ease), background var(--duration) var(--ease)",
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        background: selected ? "rgba(0,32,92,0.12)" : "var(--bg-elevated)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: selected ? "var(--accent)" : "var(--text-muted)",
      }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>{sub}</span>}
      </span>
    </button>
  );
}

function SectionHeader({ title, count, open, onToggle }: {
  title: string; count: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)",
      background: "var(--bg-card)", cursor: "pointer", fontFamily: "inherit",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
      </span>
      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)" }}>{count}</span>
    </button>
  );
}

interface MapFilterSidebarProps {
  value: MapFilterValue;
  onChange: (v: MapFilterValue) => void;
  stores: Store[];
  merchandisers: MapMerchandiser[];
}

export function MapFilterSidebar({ value, onChange, stores, merchandisers }: MapFilterSidebarProps) {
  const [merchOpen, setMerchOpen] = useState(true);
  const [storesOpen, setStoresOpen] = useState(false);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }
  const isDirty = value.merchIds.length > 0 || value.storeIds.length > 0;

  return (
    <div style={{ width: "230px", flexShrink: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", paddingRight: "2px" }}>
      <SectionHeader
        title="Mercaderistas" open={merchOpen} onToggle={() => setMerchOpen((o) => !o)}
        count={value.merchIds.length === 0 ? "todos" : `${value.merchIds.length} / ${merchandisers.length}`}
      />
      {merchOpen && merchandisers.map((m) => {
        const active = m.status !== "offline";
        return (
          <FilterCard key={m.id}
            icon={
              <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={13} />
                <span style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 8, height: 8, borderRadius: "50%",
                  background: active ? "var(--success, #16a34a)" : "var(--text-muted)",
                  border: "1.5px solid var(--bg-card)",
                }} />
              </span>
            }
            label={m.name}
            sub={active ? "Activo" : "Desconectado"}
            selected={value.merchIds.includes(m.id)}
            onClick={() => onChange({ ...value, merchIds: toggle(value.merchIds, m.id) })}
          />
        );
      })}

      <SectionHeader
        title="Sucursales" open={storesOpen} onToggle={() => setStoresOpen((o) => !o)}
        count={value.storeIds.length === 0 ? "todas" : `${value.storeIds.length} / ${stores.length}`}
      />
      {storesOpen && stores.map((s) => (
        <FilterCard key={s.store_id}
          icon={<StoreIcon size={13} />} label={s.name}
          selected={value.storeIds.includes(s.store_id)}
          onClick={() => onChange({ ...value, storeIds: toggle(value.storeIds, s.store_id) })}
        />
      ))}

      <button type="button" className="filter-chip" disabled={!isDirty}
        onClick={() => onChange(EMPTY_MAP_FILTERS)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "4px", opacity: isDirty ? 1 : 0.45, cursor: isDirty ? "pointer" : "default" }}>
        <X size={12} /> Limpiar filtros
      </button>
    </div>
  );
}
