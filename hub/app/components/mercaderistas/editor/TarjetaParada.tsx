"use client";

import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import type { Parada } from "@/app/lib/rutas/plan";
import type { TiendaBuscable } from "@/app/lib/queries/rutaPlan";

export const idTarjeta = (p: Pick<Parada, "weekday" | "store_id">) => `${p.weekday}|${p.store_id}`;

// Cuerpo visible de la tarjeta; lo reutiliza el overlay de arrastre.
export function CuerpoTarjeta({ parada, tienda, numero }: { parada: Parada; tienda: TiendaBuscable | undefined; numero: number | null }) {
  const toca = numero !== null;
  return (
    <>
      <GripVertical size={14} aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "1px" }} />
      <span style={{ width: "16px", flexShrink: 0, textAlign: "right", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{toca ? numero : "–"}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, lineHeight: 1.25, overflowWrap: "anywhere" }}>{tienda?.name ?? parada.store_id}</span>
        <span style={{ display: "block", fontSize: "var(--text-2xs)", color: "var(--text-muted)", marginTop: "2px" }}>
          {toca ? (tienda?.zona ?? "") : "No toca esta semana"}
        </span>
        {tienda && !tienda.active && (
          <span style={{ display: "block", fontSize: "var(--text-2xs)", color: "var(--danger)", fontWeight: 600, marginTop: "2px" }}>Sucursal inactiva</span>
        )}
        <span className={`ed-chip${parada.every_n_weeks > 1 ? " ed-chip-n" : ""}`}>
          {parada.every_n_weeks === 1 ? "Semanal" : `Cada ${parada.every_n_weeks} sem`}
        </span>
      </span>
    </>
  );
}

export default function TarjetaParada({ parada, tienda, numero, seleccionada, bloqueado, onAbrir }: {
  parada: Parada; tienda: TiendaBuscable | undefined; numero: number | null; seleccionada: boolean; bloqueado: boolean; onAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idTarjeta(parada), disabled: bloqueado });
  const off = numero === null;
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !isDragging) onAbrir(); // Enter edita; espacio arrastra (ver sensores en EditorRuta)
      }}
      aria-label={`${tienda?.name ?? parada.store_id}. Enter para editar, espacio para mover`}
      className={`ed-card${off ? " ed-card-off" : ""}${seleccionada ? " ed-card-sel" : ""}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        opacity: isDragging ? 0.35 : undefined,
      }}
    >
      <CuerpoTarjeta parada={parada} tienda={tienda} numero={numero} />
    </li>
  );
}
