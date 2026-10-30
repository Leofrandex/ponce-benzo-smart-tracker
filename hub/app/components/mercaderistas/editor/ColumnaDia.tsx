"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { paradasDelDia, type Parada, type Weekday } from "@/app/lib/rutas/plan";
import type { TiendaBuscable } from "@/app/lib/queries/rutaPlan";
import TarjetaParada, { idTarjeta } from "./TarjetaParada";
import AgregarSucursal from "./AgregarSucursal";

export const idColumna = (w: Weekday) => `dia-${w}`;

// Una columna del tablero: las paradas del día (todas, toquen o no la semana vista).
export default function ColumnaDia({ weekday, nombre, fechaVista, stops, tiendas, porId, seleccion, resaltada, onAbrir, onAgregar }: {
  weekday: Weekday; nombre: string; fechaVista: string; stops: Parada[];
  tiendas: TiendaBuscable[]; porId: Map<string, TiendaBuscable>;
  seleccion: string | null; resaltada: boolean;
  onAbrir: (p: Parada) => void; onAgregar: (storeId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: idColumna(weekday) });
  // Número de orden: solo entre las que tocan en la fecha vista.
  const numeros = useMemo(() => new Map(paradasDelDia(stops, fechaVista).map((p, i) => [p.store_id, i + 1])), [stops, fechaVista]);
  const yaEnDia = useMemo(() => new Set(stops.map((s) => s.store_id)), [stops]);

  return (
    <section className={`ed-col${resaltada ? " ed-col-over" : ""}`} aria-label={nombre}>
      <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "2px 4px 8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
        {nombre}
        <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "var(--text-xs)", fontVariantNumeric: "tabular-nums" }}>
          {numeros.size} de {stops.length}
        </span>
      </h2>
      <SortableContext id={idColumna(weekday)} items={stops.map(idTarjeta)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="ed-list">
          {stops.map((p) => (
            <TarjetaParada
              key={idTarjeta(p)}
              parada={p}
              tienda={porId.get(p.store_id)}
              numero={numeros.get(p.store_id) ?? null}
              seleccionada={seleccion === idTarjeta(p)}
              onAbrir={() => onAbrir(p)}
            />
          ))}
          {stops.length === 0 && <li style={{ padding: "8px 4px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Sin sucursales</li>}
        </ol>
      </SortableContext>
      <AgregarSucursal dia={nombre} tiendas={tiendas} yaEnDia={yaEnDia} onAgregar={onAgregar} />
    </section>
  );
}
