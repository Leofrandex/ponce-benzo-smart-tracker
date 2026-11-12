"use client";

import { useRef, useState } from "react";
import { Download, Upload, AlertCircle } from "lucide-react";
import { crearPlantilla, crearExcelErrores, leerExcel, MAX_BYTES, type TipoCarga } from "@/app/lib/carga/excel";
import { validarTiendas, validarClientes, type Clasificada, type FilaCruda } from "@/app/lib/carga/validar";
import { agrupar, textoResumen, etiquetaCargar, sustantivo, repetidasConNombre, type FilaCarga } from "@/app/lib/carga/panel";
import { fetchContextoTiendas, fetchContextoClientes } from "@/app/lib/queries/cargaContexto";
import { cargarTiendas, cargarClientes, type ResultadoCarga } from "@/app/lib/mutations/carga";

type Filas = Clasificada<unknown>[];
type Fase =
  | { f: "inicial"; aviso?: string }
  | { f: "validando" }
  | { f: "resultado"; filas: Filas; crudas: FilaCruda[] }
  | { f: "cargando"; filas: Filas; crudas: FilaCruda[] }
  | { f: "final"; filas: Filas; crudas: FilaCruda[]; res: ResultadoCarga };

function descargar(buf: ArrayBuffer, nombre: string) {
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const th: React.CSSProperties = { textAlign: "left", fontWeight: 600, padding: "6px 8px", color: "var(--text-muted)", fontSize: "var(--text-sm)" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: "var(--text-sm)", verticalAlign: "top" };

function Grupo({ titulo, abierto, children }: { titulo: string; abierto?: boolean; children: React.ReactNode }) {
  return (
    <details open={abierto} className="card" style={{ padding: "10px 14px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{titulo}</summary>
      <div style={{ overflowX: "auto", marginTop: "8px" }}>{children}</div>
    </details>
  );
}

function Tabla({ cols, filas }: { cols: string[]; filas: string[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>
        {filas.map((r, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const btn = (extra: string) => `btn ${extra} btn-sm`;

export function CargaMasivaPanel({ tipo, onCargado }: { tipo: TipoCarga; onCargado: () => void }) {
  const [fase, setFase] = useState<Fase>({ f: "inicial" });
  const input = useRef<HTMLInputElement>(null);
  const enCurso = useRef(false); // evita doble envio aunque el estado aun no se haya pintado
  const quien = tipo === "tiendas" ? "Tienda" : "Cliente";

  async function elegir(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setFase({ f: "inicial", aviso: "El archivo pesa más de 5 MB." });
    setFase({ f: "validando" });
    try {
      const leido = await leerExcel(tipo, await file.arrayBuffer());
      if ("errorGeneral" in leido) return setFase({ f: "inicial", aviso: leido.errorGeneral });
      const filas: Filas = tipo === "tiendas"
        ? validarTiendas(leido.filas, await fetchContextoTiendas())
        : validarClientes(leido.filas, await fetchContextoClientes());
      setFase({ f: "resultado", filas, crudas: leido.filas });
    } catch (e) {
      setFase({ f: "inicial", aviso: `No se pudo validar el archivo: ${e instanceof Error ? e.message : String(e)}.` });
    }
  }

  async function cargar(filas: Filas, crudas: FilaCruda[]) {
    if (enCurso.current) return;
    enCurso.current = true;
    setFase({ f: "cargando", filas, crudas });
    try {
      const listas = agrupar(filas).listas.map((l) => ({ fila: l.fila, datos: l.datos })) as FilaCarga<never>[];
      const res = tipo === "tiendas" ? await cargarTiendas(listas) : await cargarClientes(listas);
      setFase({ f: "final", filas, crudas, res });
      if (!res.error) onCargado();
    } catch (e) {
      setFase({ f: "final", filas, crudas, res: { insertadas: 0, repetidas: [], error: e instanceof Error ? e.message : String(e) } });
    } finally {
      enCurso.current = false;
    }
  }

  const nuevo = () => setFase({ f: "inicial" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input ref={input} type="file" accept=".xlsx" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void elegir(f); }} />

      {fase.f === "inicial" && (
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
          {fase.aviso && (
            <p role="alert" style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--danger)" }}>
              <AlertCircle size={16} aria-hidden /> {fase.aviso} Elige otro archivo.
            </p>
          )}
          <button type="button" className={btn("btn-secondary")} style={{ width: "auto" }}
            onClick={async () => descargar(await crearPlantilla(tipo), `plantilla-${tipo}.xlsx`)}>
            <Download size={14} /> Descargar plantilla de Excel
          </button>
          <button type="button" className={btn("btn-primary")} style={{ width: "auto" }} onClick={() => input.current?.click()}>
            <Upload size={14} /> Elegir archivo (.xlsx)
          </button>
        </div>
      )}

      {fase.f === "validando" && (
        <div className="card" role="status" aria-live="polite" style={{ padding: "16px" }}>Validando archivo…</div>
      )}

      {(fase.f === "resultado" || fase.f === "cargando") && (() => {
        const { filas, crudas } = fase;
        const g = agrupar(filas);
        const cargando = fase.f === "cargando";
        return (
          <>
            <p style={{ fontWeight: 600 }}>{textoResumen({ listas: g.listas.length, repetidas: g.repetidas.length, errores: g.errores.length })}</p>
            {g.errores.length > 0 && (
              <Grupo abierto titulo={`Con errores (${g.errores.length}) · no se cargarán`}>
                <Tabla cols={["Fila", quien, "Qué corregir"]} filas={g.errores.map((f) => [String(f.fila), f.nombre, f.errores.join("; ")])} />
              </Grupo>
            )}
            {g.repetidas.length > 0 && (
              <Grupo abierto titulo={`Repetidas (${g.repetidas.length}) · se saltarán`}>
                <Tabla cols={["Fila", quien, "Coincidencia"]} filas={g.repetidas.map((f) => [String(f.fila), f.nombre, f.motivo])} />
              </Grupo>
            )}
            <Grupo titulo={`Listas para cargar (${g.listas.length})`}>
              <Tabla cols={["Fila", quien]} filas={g.listas.map((f) => [String(f.fila), f.nombre])} />
            </Grupo>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {g.errores.length > 0 && (
                <button type="button" className={btn("btn-secondary")} style={{ width: "auto" }} disabled={cargando}
                  onClick={async () => {
                    const porFila = new Map(crudas.map((c) => [c.fila, c.valores]));
                    descargar(
                      await crearExcelErrores(tipo, g.errores.map((f) => ({ fila: f.fila, valores: porFila.get(f.fila) ?? {}, errores: f.errores }))),
                      `errores-${tipo}.xlsx`,
                    );
                  }}>
                  <Download size={14} /> Descargar errores en Excel
                </button>
              )}
              <button type="button" className={btn("btn-primary")} style={{ width: "auto" }}
                disabled={cargando || g.listas.length === 0} onClick={() => void cargar(filas, crudas)}>
                {cargando ? "Cargando…" : etiquetaCargar(tipo, g.listas.length)}
              </button>
              <button type="button" className={btn("btn-secondary")} style={{ width: "auto" }} disabled={cargando} onClick={nuevo}>
                Elegir otro archivo
              </button>
            </div>
          </>
        );
      })()}

      {fase.f === "final" && (() => {
        const { res, filas, crudas } = fase;
        if (res.error) {
          return (
            <div className="card" role="alert" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
              <p style={{ fontWeight: 600 }}>No se cargó ninguna fila</p>
              <p className="text-muted text-sm">{res.error}</p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className={btn("btn-primary")} style={{ width: "auto" }} onClick={() => void cargar(filas, crudas)}>Reintentar</button>
                <button type="button" className={btn("btn-secondary")} style={{ width: "auto" }} onClick={nuevo}>Elegir otro archivo</button>
              </div>
            </div>
          );
        }
        const nuevas = repetidasConNombre(res.repetidas, filas);
        return (
          <div className="card" role="status" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
            <p style={{ fontWeight: 600 }}>Se cargaron {res.insertadas} {sustantivo(tipo, res.insertadas)}.</p>
            {nuevas.length > 0 && (
              <Grupo abierto titulo={`La base detectó ${nuevas.length} ${nuevas.length === 1 ? "repetida" : "repetidas"} · se saltaron`}>
                <Tabla cols={["Fila", quien, "Motivo"]} filas={nuevas.map((f) => [String(f.fila), f.nombre, f.motivo])} />
              </Grupo>
            )}
            <button type="button" className={btn("btn-secondary")} style={{ width: "auto" }} onClick={nuevo}>Cargar otro archivo</button>
          </div>
        );
      })()}
    </div>
  );
}
