"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;               // "" = sin selección (placeholder)
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;        // default "Todos"
  disabled?: boolean;
}

// Índice de la primera opción cuyo label empieza con `buf`, buscando después de `from`
// (así, repetir la misma letra recorre las opciones que empiezan con ella).
export function typeaheadIndex(labels: string[], buf: string, from: number): number {
  const q = buf.toLocaleLowerCase("es");
  const n = labels.length;
  const start = buf.length > 1 ? from : from + 1;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (labels[i].toLocaleLowerCase("es").startsWith(q)) return i;
  }
  return -1;
}

export function Select({ label, value, options, onChange, placeholder = "Todos", disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [kbd, setKbd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ buf: "", t: 0 });
  const id = useId();
  const labelId = `${id}-label`;
  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;

  const all = [{ value: "", label: placeholder }, ...options];
  const selectedIdx = Math.max(0, all.findIndex((o) => o.value === value));
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Al abrir, el foco pasa a la lista (anuncia la opción activa vía aria-activedescendant).
  useEffect(() => { if (open) listRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (open) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function openList(kb: boolean) {
    setActive(selectedIdx);
    setKbd(kb);
    setOpen(true);
  }
  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }
  function choose(i: number) {
    onChange(all[i].value);
    close(true);
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(true); }
  }

  function onListKey(e: KeyboardEvent) {
    const last = all.length - 1;
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(last, active + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); return; }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    else if (e.key === "Tab") { setOpen(false); return; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.buf = now - typed.current.t > 500 ? e.key : typed.current.buf + e.key;
      typed.current.t = now;
      next = typeaheadIndex(all.map((o) => o.label), typed.current.buf, active);
    }
    if (next < 0) return;
    e.preventDefault();
    setKbd(true);
    setActive(next);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: "130px" }}>
      <div id={labelId} style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{label}</div>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${triggerId}`}
        className="focus-ring"
        onClick={() => (open ? close(false) : openList(false))}
        onKeyDown={onTriggerKey}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          width: "100%", padding: "8px 12px", fontFamily: "inherit", fontSize: "var(--text-sm)", fontWeight: 500,
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1, transition: "border-color var(--duration) var(--ease)",
        }}
      >
        {selected?.label ?? placeholder}
        <ChevronDown size={14} color="var(--text-muted)" aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease", flexShrink: 0 }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={optId(active)}
            onKeyDown={onListKey}
            onBlur={(e) => { if (e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
              minWidth: "100%", maxHeight: "260px", overflowY: "auto", outline: "none",
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "6px",
              boxShadow: "0 10px 30px rgba(0, 32, 92, 0.12)",
            }}
          >
            {all.map((o, i) => {
              const isSel = o.value === value;
              const isActive = i === active;
              return (
                <div
                  key={o.value || "__all__"}
                  id={optId(i)}
                  role="option"
                  aria-selected={isSel}
                  onClick={() => choose(i)}
                  onMouseMove={() => { if (!isActive || kbd) { setKbd(false); setActive(i); } }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
                    background: isSel ? "var(--accent-glow)" : isActive ? "var(--bg-elevated)" : "transparent",
                    // Opción activa por teclado: anillo (forma distinta del relleno de la seleccionada).
                    boxShadow: isActive && kbd ? "inset 0 0 0 2px var(--accent)" : "none",
                    color: isSel ? "var(--accent)" : "var(--text-primary)",
                    fontSize: "var(--text-sm)", fontWeight: isSel ? 600 : 500,
                    cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
                  }}
                >
                  {o.label}
                  {isSel && <Check size={13} aria-hidden />}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
