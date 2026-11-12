"use client";

import { useEffect } from "react";

// Detalle de una parada: quitarla de la ruta. El día y el orden se cambian arrastrando.
export default function PanelParada({ nombreTienda, nombreDia, onQuitar, onCerrar }: {
  nombreTienda: string; nombreDia: string; onQuitar: () => void; onCerrar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="ed-pop" role="dialog" aria-label={`${nombreTienda} · ${nombreDia}`}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "10px", overflowWrap: "anywhere" }}>{nombreTienda} · {nombreDia}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" onClick={onQuitar} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          Quitar de la ruta
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}
