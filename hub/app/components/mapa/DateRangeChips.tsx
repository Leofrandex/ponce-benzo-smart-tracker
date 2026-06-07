"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export interface DateRange { from: string; to: string; } // ISO yyyy-mm-dd

type Preset = "today" | "7d" | "30d" | "custom";

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
export function presetRange(p: Exclude<Preset, "custom">): DateRange {
  if (p === "today") return { from: isoDaysAgo(0), to: isoDaysAgo(0) };
  if (p === "7d") return { from: isoDaysAgo(7), to: isoDaysAgo(0) };
  return { from: isoDaysAgo(30), to: isoDaysAgo(0) };
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

function RangeCalendar({ range, onPick }: { range: DateRange; onPick: (r: DateRange) => void }) {
  const [viewDate, setViewDate] = useState(() => new Date(range.to + "T00:00:00"));
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = toISO(new Date());

  function clickDay(day: number) {
    const iso = toISO(new Date(year, month, day));
    if (iso > todayISO) return;
    if (!pendingFrom) {
      setPendingFrom(iso);
    } else {
      const [from, to] = pendingFrom <= iso ? [pendingFrom, iso] : [iso, pendingFrom];
      setPendingFrom(null);
      onPick({ from, to });
    }
  }

  const selFrom = pendingFrom ?? range.from;
  const selTo = pendingFrom ? pendingFrom : range.to;

  return (
    <div style={{ width: "252px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><ChevronLeft size={15} /></button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{MONTHS[month]} {year}</span>
        <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><ChevronRight size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
        {DOW.map((d, i) => <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", padding: "4px 0" }}>{d}</span>)}
        {Array.from({ length: firstDow }).map((_, i) => <span key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = toISO(new Date(year, month, day));
          const disabled = iso > todayISO;
          const isEdge = iso === selFrom || iso === selTo;
          const inRange = !pendingFrom && iso > range.from && iso < range.to;
          return (
            <button key={day} type="button" onClick={() => clickDay(day)} disabled={disabled} style={{
              border: "none", padding: "6px 0", fontSize: "11px", fontFamily: "inherit", cursor: disabled ? "default" : "pointer",
              borderRadius: "7px", fontWeight: isEdge ? 700 : 500,
              background: isEdge ? "var(--accent)" : inRange ? "var(--accent-glow)" : "transparent",
              color: disabled ? "rgba(140,144,145,0.4)" : isEdge ? "#fff" : inRange ? "var(--accent)" : "var(--text-secondary)",
            }}>{day}</button>
          );
        })}
      </div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", textAlign: "center" }}>
        {pendingFrom ? "Ahora elegí la fecha final" : "Elegí la fecha inicial"}
      </div>
    </div>
  );
}

export function DateRangeChips({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const [preset, setPreset] = useState<Preset>("7d");
  const [calOpen, setCalOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setCalOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [calOpen]);

  function pickPreset(p: Exclude<Preset, "custom">) {
    setPreset(p);
    setCalOpen(false);
    onChange(presetRange(p));
  }

  const presets: { key: Exclude<Preset, "custom">; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "7d", label: "Últimos 7 días" },
    { key: "30d", label: "Últimos 30 días" },
  ];

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      {presets.map(({ key, label }) => (
        <button key={key} type="button" className={`filter-chip ${preset === key ? "active" : ""}`} onClick={() => pickPreset(key)}>
          {label}
        </button>
      ))}
      <button type="button" className={`filter-chip ${preset === "custom" ? "active" : ""}`}
        onClick={() => { setPreset("custom"); setCalOpen((o) => !o); }}
        style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <Calendar size={12} />
        {preset === "custom" ? `${fmtShort(range.from)} — ${fmtShort(range.to)}` : "Personalizado"}
      </button>

      <AnimatePresence>
        {calOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 1000,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "14px",
              boxShadow: "0 10px 30px rgba(0, 32, 92, 0.15)",
            }}>
            <RangeCalendar range={range} onPick={(r) => { onChange(r); setCalOpen(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
