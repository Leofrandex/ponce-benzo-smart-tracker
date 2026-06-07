"use client";

import { useEffect, useRef, useState } from "react";
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

export function Select({ label, value, options, onChange, placeholder = "Todos", disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: "130px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{label}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          width: "100%", padding: "8px 12px", fontFamily: "inherit", fontSize: "13px", fontWeight: 500,
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1, transition: "border-color var(--duration) var(--ease)",
        }}
      >
        {selected?.label ?? placeholder}
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease", flexShrink: 0 }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
              minWidth: "100%", maxHeight: "260px", overflowY: "auto",
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "6px",
              boxShadow: "0 10px 30px rgba(0, 32, 92, 0.12)",
            }}
          >
            {[{ value: "", label: placeholder }, ...options].map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value || "__all__"}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    width: "100%", padding: "8px 10px", border: "none", borderRadius: "var(--radius-sm)",
                    background: isSel ? "var(--accent-glow)" : "transparent",
                    color: isSel ? "var(--accent)" : "var(--text-primary)",
                    fontFamily: "inherit", fontSize: "13px", fontWeight: isSel ? 600 : 500,
                    cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {o.label}
                  {isSel && <Check size={13} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
