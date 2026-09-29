"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { typeaheadIndex } from "./Select";

export interface MultiSelectOption { value: string; label: string }

// Selección múltiple: chips de lo elegido + lista desplegable con casillas.
// Teclado: ↑↓ / Home / End mueven, Enter o Espacio marcan, Esc cierra y devuelve
// el foco al disparador, una letra salta a la opción que empieza con ella.
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
  const [active, setActive] = useState(0);
  const [kbd, setKbd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ buf: "", t: 0 });
  const id = useId();
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => { if (open) listRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (open) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  function openList(kb: boolean) {
    const first = options.findIndex((o) => value.includes(o.value));
    setActive(Math.max(0, first));
    setKbd(kb);
    setOpen(true);
  }
  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(true); }
  }

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(last, active + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) toggle(options[active].value); return; }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    else if (e.key === "Tab") { setOpen(false); return; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.buf = now - typed.current.t > 500 ? e.key : typed.current.buf + e.key;
      typed.current.t = now;
      next = typeaheadIndex(options.map((o) => o.label), typed.current.buf, active);
    }
    if (next < 0) return;
    e.preventDefault();
    setKbd(true);
    setActive(next);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: "220px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {value.length === 0 && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{placeholder}</span>}
        {value.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            {labelOf(v)}
            {!disabled && (
              <button type="button" onClick={() => toggle(v)} aria-label={`Quitar ${labelOf(v)}`} className="focus-ring"
                style={{ all: "unset", cursor: "pointer", display: "inline-flex" }}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <button ref={triggerRef} type="button" disabled={disabled} onClick={() => (open ? close(false) : openList(false))}
          onKeyDown={onTriggerKey} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
          aria-controls={open ? listId : undefined} className="ms-trigger focus-ring">
          Editar <ChevronDown size={12} aria-hidden />
        </button>
        {/* Disparador fantasma: se repite en cada fila, así que no compite con los datos hasta que se apunta. */}
        <style>{`
          .ms-trigger { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid transparent; border-radius: var(--radius-sm);
            background: transparent; color: var(--text-muted); font-family: inherit; font-size: var(--text-xs); font-weight: 600; cursor: pointer; }
          .ms-trigger:hover:not(:disabled), .ms-trigger:focus-visible, .ms-trigger[aria-expanded="true"] { color: var(--text-primary); border-color: var(--border); background: var(--bg-surface); }
          .ms-trigger:disabled { opacity: 0.4; cursor: not-allowed; }
        `}</style>
      </div>
      {open && (
        <div ref={listRef} id={listId} role="listbox" aria-multiselectable="true" aria-label={ariaLabel} tabIndex={-1}
          aria-activedescendant={options.length > 0 ? optId(active) : undefined}
          onKeyDown={onListKey}
          onBlur={(e) => { if (e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, minWidth: "260px", maxHeight: "280px", overflowY: "auto", outline: "none",
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "6px",
            boxShadow: "0 10px 30px rgba(0, 32, 92, 0.12)",
          }}>
          {options.map((o, i) => {
            const sel = value.includes(o.value);
            const isActive = i === active;
            return (
              <div key={o.value} id={optId(i)} role="option" aria-selected={sel} onClick={() => toggle(o.value)}
                onMouseMove={() => { if (!isActive || kbd) { setKbd(false); setActive(i); } }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%",
                  padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  background: sel ? "var(--accent-glow)" : isActive ? "var(--bg-elevated)" : "transparent",
                  boxShadow: isActive && kbd ? "inset 0 0 0 2px var(--accent)" : "none",
                  color: sel ? "var(--accent)" : "var(--text-primary)", fontSize: "var(--text-sm)", fontWeight: sel ? 600 : 500,
                  cursor: "pointer", textAlign: "left",
                }}>
                {o.label}
                {sel && <Check size={13} aria-hidden />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
