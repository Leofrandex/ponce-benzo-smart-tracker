"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext, DragOverlay, KeyboardCode, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { sumarDias } from "@/app/lib/queries/rutas";
import { guardarRuta, ultimaVersionVista, type TiendaBuscable } from "@/app/lib/queries/rutaPlan";
import { primerLunesDesde, versionesFuturas, type Parada, type Version, type Weekday } from "@/app/lib/rutas/plan";
import { contarCambios, iniciarEditor, reducir, stopsDelDia, type Accion, type EditorState } from "@/app/lib/rutas/editorState";
import { armarVersionesAGuardar, avisoFecha, baseParaFecha, esConflictoVersion, fechaCorta, numerosDelDia, rangoSemana } from "@/app/lib/rutas/editorUi";
import ColumnaDia from "./ColumnaDia";
import { CuerpoTarjeta, idTarjeta } from "./TarjetaParada";
import PanelParada from "./PanelParada";
import ConfirmarFuturas from "./ConfirmarFuturas";
import { ESTILOS_EDITOR } from "./estilos";

const DIAS: { w: Weekday; nombre: string }[] = [
  { w: 1, nombre: "Lunes" }, { w: 2, nombre: "Martes" }, { w: 3, nombre: "Miércoles" }, { w: 4, nombre: "Jueves" }, { w: 5, nombre: "Viernes" },
];
const NOMBRE_DIA = Object.fromEntries(DIAS.map((d) => [d.w, d.nombre])) as Record<Weekday, string>;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const SALIR_SIN_GUARDAR = "Tienes cambios sin guardar. ¿Salir sin guardar?";

// Ids del tablero: "dia-N" para la columna, "N|store_id" para cada tarjeta.
const diaDe = (id: UniqueIdentifier): Weekday => {
  const s = String(id);
  return Number(s.startsWith("dia-") ? s.slice(4) : s.slice(0, s.indexOf("|"))) as Weekday;
};
const tiendaDe = (id: UniqueIdentifier) => { const s = String(id); return s.slice(s.indexOf("|") + 1); };

// "reiniciar" vuelve a tomar la base de la versión vigente en una fecha (sin cambios pendientes).
type AccionEditor = Accion | { tipo: "reiniciar"; base: Parada[]; fecha: string };
const reducirEditor = (s: EditorState, a: AccionEditor): EditorState => (a.tipo === "reiniciar" ? iniciarEditor(a.base, a.fecha) : reducir(s, a));

export default function EditorRuta({ userId, nombre, versiones, tiendas, manana, onRecargar }: {
  userId: string; nombre: string; versiones: Version[]; tiendas: TiendaBuscable[]; manana: string; onRecargar: () => Promise<void>;
}) {
  const router = useRouter();
  const [s, dispatch] = useReducer(reducirEditor, undefined, () => iniciarEditor(baseParaFecha(versiones, manana), manana));
  const [fechaBase, setFechaBase] = useState(manana); // fecha cuya versión vigente es s.base
  const [semana, setSemana] = useState(() => primerLunesDesde(manana));
  const [recargando, setRecargando] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [overDia, setOverDia] = useState<Weekday | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saliendo = useRef(false);

  const porId = useMemo(() => new Map(tiendas.map((t) => [t.store_id, t])), [tiendas]);
  const futuras = useMemo(() => versionesFuturas(versiones, s.effectiveFrom), [versiones, s.effectiveFrom]);
  const cambios = contarCambios(s);
  const perfil = `/panel/mercaderistas/${userId}`;
  const aviso = cambios > 0 ? avisoFecha(versiones, fechaBase, s.effectiveFrom) : null;
  const conflicto = error !== null && esConflictoVersion(error);

  const reiniciar = (fecha: string) => {
    dispatch({ tipo: "reiniciar", base: baseParaFecha(versiones, fecha), fecha });
    setFechaBase(fecha); setSel(null);
  };
  const cambiarFecha = (v: string) => {
    if (cambios === 0) reiniciar(v);
    else dispatch({ tipo: "fecha", effectiveFrom: v });
    setSemana(primerLunesDesde(v));
  };
  const recargar = async () => {
    if (cambios > 0 && !window.confirm("Se perderán los cambios sin guardar. ¿Recargar la ruta?")) return;
    setRecargando(true);
    try { await onRecargar(); } finally { setRecargando(false); }
  };

  useEffect(() => {
    if (cambios === 0) return;
    const onUnload = (e: BeforeUnloadEvent) => { if (!saliendo.current) { e.preventDefault(); e.returnValue = ""; } };
    // Los <Link> de Next (menú, encabezado, volver) navegan sin recargar: se interceptan en captura.
    const onClick = (e: MouseEvent) => {
      if (saliendo.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(SALIR_SIN_GUARDAR)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [cambios]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // por debajo de esto es un click (abre el panel)
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space, KeyboardCode.Tab] },
    }),
  );

  const onDragStart = (e: DragStartEvent) => { setSel(null); setArrastrada(String(e.active.id)); };
  const onDragOver = (e: DragOverEvent) => setOverDia(e.over ? diaDe(e.over.id) : null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setArrastrada(null); setOverDia(null);
    if (!over) return;
    const desde = diaDe(active.id);
    const hacia = diaDe(over.id);
    const destino = stopsDelDia(s, hacia);
    let indice = destino.length; // soltada en el hueco de la columna: al final
    if (!String(over.id).startsWith("dia-")) {
      indice = destino.findIndex((p) => idTarjeta(p) === over.id);
      // Otra columna: si quedó por debajo del centro de la tarjeta, va después de ella.
      const r = active.rect.current.translated;
      if (desde !== hacia && r && r.top > over.rect.top + over.rect.height / 2) indice += 1;
    }
    dispatch({ tipo: "mover", store_id: tiendaDe(active.id), desde, hacia, indice });
  };

  const seleccionada = sel ? s.stops.find((p) => idTarjeta(p) === sel) ?? null : null;
  const enArrastre = arrastrada ? s.stops.find((p) => idTarjeta(p) === arrastrada) ?? null : null;
  const numeroEnSemana = (p: Parada) =>
    numerosDelDia(stopsDelDia(s, p.weekday), sumarDias(semana, p.weekday - 1), s.effectiveFrom, (id) => porId.get(id)?.active !== false)
      .get(p.store_id) ?? null;

  async function guardar(aplicarAFuturas: boolean) {
    setConfirmar(false); setSel(null); setGuardando(true); setError(null);
    try {
      await guardarRuta(userId, armarVersionesAGuardar(s.base, s.stops, s.effectiveFrom, futuras, aplicarAFuturas), ultimaVersionVista(versiones));
      saliendo.current = true;
      router.push(`${perfil}?ver=ruta&semana=${primerLunesDesde(s.effectiveFrom)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); // mensaje del servidor, tal cual
      setGuardando(false);
    }
  }

  return (
    <>
      <style>{ESTILOS_EDITOR}</style>
      <Link
        href={perfil}
        style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--text-muted)", textDecoration: "none", fontWeight: 500 }}
      >
        <ArrowLeft size={15} /> {nombre}
      </Link>

      <div className="card" style={{ padding: 0, overflow: "hidden", flexShrink: 0 }}>
        <div className="ed-bar">
          <h1 style={{ flex: 1, minWidth: "200px", margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>Ruta fija de {nombre}</h1>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            Los cambios aplican desde
            <input
              type="date"
              className="form-input"
              min={manana}
              value={s.effectiveFrom}
              disabled={guardando}
              onChange={(e) => {
                const v = e.target.value;
                if (YMD.test(v) && v >= manana) cambiarFecha(v);
              }}
              style={{ width: "auto", padding: "5px 8px", fontSize: "var(--text-sm)", borderColor: "var(--border-accent)" }}
            />
          </label>
          {aviso && (
            <span role="status" style={{ flexBasis: "100%", order: 1, color: "var(--warning)", fontWeight: 600 }}>
              {aviso.tipo === "reemplaza"
                ? `Tus cambios se armaron sobre la ruta vigente antes del ${fechaCorta(aviso.fecha)}. Si guardas con esta fecha, reemplazarán el cambio programado.`
                : aviso.tipo === "adelanta"
                  ? `Tus cambios se armaron sobre el cambio programado del ${fechaCorta(aviso.fecha)}. Si guardas con esta fecha, ese contenido empezará a regir antes, desde el ${fechaCorta(s.effectiveFrom)}.`
                  : `Ojo: hay un cambio programado desde el ${fechaCorta(aviso.fecha)} que rige antes de esta fecha.`}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            Viendo la semana
            <button type="button" className="filter-chip" aria-label="Semana anterior" disabled={semana <= primerLunesDesde(s.effectiveFrom)} onClick={() => setSemana(sumarDias(semana, -7))}><ChevronLeft size={14} /></button>
            <span style={{ minWidth: "110px", textAlign: "center", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rangoSemana(semana)}</span>
            <button type="button" className="filter-chip" aria-label="Semana siguiente" onClick={() => setSemana(sumarDias(semana, 7))}><ChevronRight size={14} /></button>
          </span>
        </div>
        {futuras.length > 0 && (
          <div className="ed-aviso">Hay un cambio programado desde el {fechaCorta(futuras[0].effective_from)}</div>
        )}

        <div className="ed-board-wrap" aria-busy={guardando} style={guardando ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setArrastrada(null); setOverDia(null); }}>
            <div className="ed-board">
              {DIAS.map(({ w, nombre: dia }) => (
                <ColumnaDia
                  key={w}
                  weekday={w}
                  nombre={dia}
                  fechaVista={sumarDias(semana, w - 1)}
                  desde={s.effectiveFrom}
                  stops={stopsDelDia(s, w)}
                  tiendas={tiendas}
                  porId={porId}
                  seleccion={sel}
                  bloqueado={guardando}
                  resaltada={overDia === w && enArrastre?.weekday !== w}
                  onAbrir={(p) => { if (!guardando) setSel(idTarjeta(p)); }}
                  onAgregar={(store_id) => dispatch({ tipo: "agregar", weekday: w, store_id })}
                />
              ))}
            </div>
            <DragOverlay>
              {enArrastre && (
                <div className="ed-card ed-card-drag">
                  <CuerpoTarjeta parada={enArrastre} tienda={porId.get(enArrastre.store_id)} numero={numeroEnSemana(enArrastre)} anterior={sumarDias(semana, enArrastre.weekday - 1) < s.effectiveFrom} />
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {seleccionada && (
            <PanelParada
              parada={seleccionada}
              nombreTienda={porId.get(seleccionada.store_id)?.name ?? seleccionada.store_id}
              nombreDia={NOMBRE_DIA[seleccionada.weekday]}
              fecha={s.effectiveFrom}
              onFrecuencia={(n) => dispatch({ tipo: "frecuencia", weekday: seleccionada.weekday, store_id: seleccionada.store_id, n })}
              onSemana={(anchor_monday) => dispatch({ tipo: "semana", weekday: seleccionada.weekday, store_id: seleccionada.store_id, anchor_monday })}
              onQuitar={() => { dispatch({ tipo: "quitar", weekday: seleccionada.weekday, store_id: seleccionada.store_id }); setSel(null); }}
              onCerrar={() => setSel(null)}
            />
          )}
        </div>

        <div className="ed-bar" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end" }}>
          <span style={{ marginRight: "auto", color: cambios ? "var(--text-secondary)" : "var(--text-muted)" }}>
            {cambios === 0 ? "Sin cambios" : cambios === 1 ? "1 cambio sin guardar" : `${cambios} cambios sin guardar`}
          </span>
          {error && (
            <span role="alert" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", color: "var(--danger)", fontWeight: 600, flexBasis: "100%", order: -1 }}>
              {error}
              {conflicto && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={recargando} onClick={recargar}>
                  {recargando ? "Recargando…" : "Recargar"}
                </button>
              )}
            </span>
          )}
          {/* Descartar vuelve a la versión vigente en la fecha elegida. */}
          <button type="button" className="btn btn-secondary btn-sm" disabled={cambios === 0 || guardando} onClick={() => { reiniciar(s.effectiveFrom); if (!conflicto) setError(null); }}>Descartar</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={cambios === 0 || guardando || conflicto} onClick={() => (futuras.length > 0 ? setConfirmar(true) : guardar(false))}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {confirmar && (
        <ConfirmarFuturas fecha={fechaCorta(futuras[0].effective_from)} mas={futuras.length - 1} onAmbas={() => guardar(true)} onSoloEsta={() => guardar(false)} onCancelar={() => setConfirmar(false)} />
      )}
    </>
  );
}
