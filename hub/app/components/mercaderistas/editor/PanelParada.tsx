"use client";

import { useEffect } from "react";
import { opcionesSemana, primerLunesDesde, proximasVisitas, type Frecuencia, type Parada } from "@/app/lib/rutas/plan";
import { fechaCorta } from "@/app/lib/rutas/editorUi";

const FRECUENCIAS: { n: Frecuencia; label: string }[] = [
  { n: 1, label: "Semanal" }, { n: 2, label: "Cada 2" }, { n: 3, label: "Cada 3" }, { n: 4, label: "Cada 4" },
];

function Segmentado<T extends string | number>({ label, opciones, valor, onCambio }: {
  label: string; opciones: { v: T; label: string }[]; valor: T; onCambio: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="ed-seg">
      {opciones.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={o.v === valor} className={o.v === valor ? "on" : undefined} onClick={() => onCambio(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Detalle de una parada: frecuencia, semana en que le toca primero y quitar.
export default function PanelParada({ parada, nombreTienda, nombreDia, fecha, onFrecuencia, onSemana, onQuitar, onCerrar }: {
  parada: Parada; nombreTienda: string; nombreDia: string; fecha: string;
  onFrecuencia: (n: Frecuencia) => void; onSemana: (anchor: string) => void; onQuitar: () => void; onCerrar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const n = parada.every_n_weeks;
  return (
    <div className="ed-pop" role="dialog" aria-label={`${nombreTienda} · ${nombreDia}`}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "10px", overflowWrap: "anywhere" }}>{nombreTienda} · {nombreDia}</div>
      <div className="ed-label">¿Cada cuánto se visita?</div>
      <Segmentado label="¿Cada cuánto se visita?" opciones={FRECUENCIAS.map((f) => ({ v: f.n, label: f.label }))} valor={n} onCambio={onFrecuencia} />
      {n > 1 && (
        <>
          <div className="ed-label">¿En qué semana le toca primero?</div>
          <Segmentado
            label="¿En qué semana le toca primero?"
            opciones={opcionesSemana(primerLunesDesde(fecha), n).map((l) => ({ v: l, label: fechaCorta(l) }))}
            valor={parada.anchor_monday}
            onCambio={onSemana}
          />
        </>
      )}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: "12px" }}>
        Visitas: {proximasVisitas(parada, fecha, 4).map(fechaCorta).join(" · ")}…
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" onClick={onQuitar} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          Quitar de la ruta
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}
