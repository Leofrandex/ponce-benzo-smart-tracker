"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

// Control segmentado con semántica de pestañas: role="tablist", roving tabindex
// (una sola parada de Tab), ← → / Home / End mueven y activan.
export default function Segmented<T extends string>({
  options, value, onChange, ariaLabel, style,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  style?: React.CSSProperties;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = options.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1) :
      e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) :
      e.key === "Home" ? 0 :
      e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "3px", ...style }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="focus-ring"
            style={{
              flex: 1, minWidth: 0, border: "none", borderRadius: "calc(var(--radius-md) - 2px)", padding: "7px 12px",
              fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: selected ? "var(--bg-surface)" : "transparent",
              color: selected ? "var(--text-primary)" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
