"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { kpiDef, type KpiId } from "@/app/lib/dashboard-kpis";
import "./dashboard.css";

interface Props {
  kpi: KpiId;
  valor: string;
  detalle?: string;
  tono?: "normal" | "peligro" | "exito";
  // Sustituye la etiqueta del registro cuando el rotulo depende del rol (p.ej.
  // "Mis tareas abiertas" para un vendedor vs "Tareas abiertas" para un admin).
  // La descripcion del tooltip no cambia: solo el titulo.
  etiqueta?: string;
  // El contenido de la tarjeta enlaza aqui.
  href?: string;
  // El texto de detalle es un enlace aparte (p.ej. "+15 dias").
  detalleHref?: string;
  // La metrica sobre la que se decide: tarjeta grande. Solo una por fila.
  primaria?: boolean;
  // Contexto extra que solo la primaria tiene sitio para mostrar.
  children?: React.ReactNode;
}

const COLOR = { normal: undefined, peligro: "var(--danger)", exito: "var(--success)" };

export default function KpiCard({ kpi, valor, detalle, tono = "normal", etiqueta, href, detalleHref, primaria, children }: Props) {
  const def = kpiDef(kpi);
  const rotulo = etiqueta ?? def.etiqueta;
  // Un solo estado sirve a los tres gestos: hover en escritorio, tap en tactil
  // y foco por teclado. Sin esto, en un telefono el tooltip seria inalcanzable.
  const [abierto, setAbierto] = useState(false);
  const tooltipId = `kpi-tooltip-${kpi}`;

  const cuerpo = (
    <>
      <div className="kpi-label">{rotulo}</div>
      <div className="kpi-valor" style={{ color: COLOR[tono] }}>{valor}</div>
    </>
  );

  return (
    <div className={`kpi-card${primaria ? " kpi-primaria" : ""}`}>
      <button
        type="button"
        className="dash-focus"
        aria-label={`Qué mide ${rotulo}`}
        aria-describedby={abierto ? tooltipId : undefined}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        // El foco por teclado (Tab) tambien debe abrir el tooltip, pero solo
        // cuando NO viene de un puntero: en tactil, el toque dispara primero
        // "focus" y despues "click" sobre el mismo boton. Si focus abriera
        // siempre, el click inmediato lo volveria a cerrar y el primer toque
        // no mostraria nada. Filtrando por relatedTarget/puntero evitamos
        // reaccionar al focus sintetico del tap y dejamos que sea el click
        // (onClick) el que abra/cierre en tactil, y el foco real de teclado
        // el que abra al navegar con Tab.
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setAbierto(true);
        }}
        onBlur={() => setAbierto(false)}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
        }}
        style={{
          position: "absolute", top: 8, right: 8, background: "none", border: "none",
          padding: 4, cursor: "pointer", color: "var(--text-muted)", lineHeight: 0,
        }}
      >
        <Info size={14} />
      </button>

      {abierto && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute", top: 30, right: 8, zIndex: 20, width: 260,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.45,
            color: "var(--text-muted)", boxShadow: "0 6px 20px rgba(0,0,0,.12)",
            textAlign: "left", fontWeight: 400,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>
            {rotulo}
          </strong>
          {def.descripcion}
        </div>
      )}

      {href ? <Link href={href} className="dash-link" style={{ display: "block" }}>{cuerpo}</Link> : <div>{cuerpo}</div>}
      {detalle && (detalleHref ? (
        <Link href={detalleHref} className="dash-link kpi-detalle" style={{ color: tono === "peligro" ? "var(--danger)" : undefined }}>{detalle}</Link>
      ) : (
        <div className="kpi-detalle">{detalle}</div>
      ))}
      {children}
    </div>
  );
}
