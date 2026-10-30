"use client";

import { useEffect } from "react";

// Al guardar con una versión futura ya programada: ¿el cambio también va a esa ruta?
export default function ConfirmarFuturas({ fecha, onAmbas, onSoloEsta, onCancelar }: {
  fecha: string; onAmbas: () => void; onSoloEsta: () => void; onCancelar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  return (
    <div onClick={onCancelar} style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(10, 14, 26, 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="ed-confirmar" onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "20px", width: "min(420px, 100%)",
        boxShadow: "0 20px 50px rgba(0, 32, 92, 0.25)", display: "flex", flexDirection: "column", gap: "16px",
      }}>
        <p id="ed-confirmar" style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
          Hay un cambio programado desde el {fecha}. ¿Aplicar también este cambio a esa ruta?
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSoloEsta}>No, solo esta</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onAmbas} autoFocus>Sí, aplicar a ambas</button>
        </div>
      </div>
    </div>
  );
}
