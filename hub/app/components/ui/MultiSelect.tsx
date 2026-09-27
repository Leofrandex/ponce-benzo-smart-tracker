"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export interface MultiSelectOption { value: string; label: string }

// Selección múltiple: chips de lo elegido + lista desplegable con casillas.
export function MultiSelect({
  value, options, onChange, placeholder = "Nadie", disabled, ariaLabel,
}: {
  value: string[];
  options: MultiSelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: "220px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {value.length === 0 && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{placeholder}</span>}
        {value.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            {labelOf(v)}
            {!disabled && (
              <button type="button" onClick={() => toggle(v)} aria-label={`Quitar ${labelOf(v)}`}
                style={{ all: "unset", cursor: "pointer", display: "inline-flex" }}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-label={ariaLabel} aria-expanded={open}
          className="ms-trigger">
          Editar <ChevronDown size={12} />
        </button>
        {/* Disparador fantasma: se repite en cada fila, así que no compite con los datos hasta que se apunta. */}
        <style>{`
          .ms-trigger { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid transparent; border-radius: var(--radius-sm);
            background: transparent; color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
          .ms-trigger:hover:not(:disabled), .ms-trigger:focus-visible, .ms-trigger[aria-expanded="true"] { color: var(--text-primary); border-color: var(--border); background: var(--bg-surface); }
          .ms-trigger:disabled { opacity: 0.4; cursor: not-allowed; }
        `}</style>
      </div>
      {open && (
        <div role="listbox" aria-multiselectable="true" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, minWidth: "260px", maxHeight: "280px", overflowY: "auto",
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "6px",
          boxShadow: "0 10px 30px rgba(0, 32, 92, 0.12)",
        }}>
          {options.map((o) => {
            const sel = value.includes(o.value);
            return (
              <button key={o.value} type="button" role="option" aria-selected={sel} onClick={() => toggle(o.value)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%",
                padding: "8px 10px", border: "none", borderRadius: "var(--radius-sm)", background: sel ? "var(--accent-glow)" : "transparent",
                color: sel ? "var(--accent)" : "var(--text-primary)", fontFamily: "inherit", fontSize: "13px", fontWeight: sel ? 600 : 500,
                cursor: "pointer", textAlign: "left",
              }}>
                {o.label}
                {sel && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
