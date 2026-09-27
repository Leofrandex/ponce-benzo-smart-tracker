"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCatalog, filterCatalog, lineSuggestions, normalizeLine, type CatalogProduct } from "@/app/lib/queries/products";
import { updateProduct } from "@/app/lib/mutations/products";

// `field` dice qué disparó el guardado, para mostrar el aviso junto a ese control.
type Feedback = { field: "line" | "active"; kind: "saving" | "saved" | "error"; msg?: string };

const SAVED_MS = 2500;

export default function ProductosPage() {
  const { data, loading, error, refetch } = useSupabaseQuery(fetchCatalog, []);
  const products = useMemo(() => data ?? [], [data]);
  const lines = useMemo(() => lineSuggestions(products), [products]);
  const [q, setQ] = useState("");
  const [soloSinLinea, setSoloSinLinea] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fb, setFb] = useState<Record<string, Feedback>>({});
  // Un temporizador de "Guardado" por fila: cada guardado o edición nueva cancela el anterior,
  // así un timer viejo no apaga la confirmación de un guardado más reciente.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cancelTimer = (id: string) => { clearTimeout(timers.current[id]); delete timers.current[id]; };
  useEffect(() => { const t = timers.current; return () => Object.values(t).forEach(clearTimeout); }, []);
  const visible = useMemo(() => filterCatalog(products, q, soloSinLinea), [products, q, soloSinLinea]);
  const sinLinea = products.filter((p) => !p.line).length;

  const clearFb = (id: string, only?: Feedback["kind"]) =>
    setFb((s) => { if (!s[id] || (only && s[id].kind !== only)) return s; const n = { ...s }; delete n[id]; return n; });

  async function save(p: CatalogProduct, field: Feedback["field"], patch: { line?: string | null; active?: boolean }) {
    cancelTimer(p.product_id);
    setFb((s) => ({ ...s, [p.product_id]: { field, kind: "saving" } }));
    const { error: e } = await updateProduct(p.product_id, patch);
    setFb((s) => ({ ...s, [p.product_id]: e ? { field, kind: "error", msg: e } : { field, kind: "saved" } }));
    if (!e) {
      setDrafts((d) => { const n = { ...d }; delete n[p.product_id]; return n; });
      // "Guardado" es una confirmación, no un estado: se apaga sola.
      timers.current[p.product_id] = setTimeout(() => { delete timers.current[p.product_id]; clearFb(p.product_id, "saved"); }, SAVED_MS);
    }
    refetch();
  }

  function commitLine(p: CatalogProduct) {
    const raw = drafts[p.product_id];
    if (raw === undefined) return;
    const next = normalizeLine(raw, lines);
    if (next === p.line) { setDrafts((d) => { const n = { ...d }; delete n[p.product_id]; return n; }); return; }
    save(p, "line", { line: next });
  }

  function toggleActive(p: CatalogProduct) {
    if (p.active && !window.confirm(`¿Desactivar "${p.name}"? Dejará de aparecer en la app de los mercaderistas.`)) return;
    save(p, "active", { active: !p.active });
  }

  if (error) return <div className="empty-state"><div className="empty-title">Error al cargar</div><div className="empty-desc">{error}</div></div>;
  if (loading) return <div className="empty-state"><div className="empty-title">Cargando productos…</div></div>;

  return (
    <>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ position: "relative", display: "flex", alignItems: "center", flex: "1 1 240px", maxWidth: "360px" }}>
          <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "12px", pointerEvents: "none" }} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, SKU o marca" aria-label="Buscar productos"
            style={{ width: "100%", padding: "8px 12px 8px 32px", fontFamily: "inherit", fontSize: "13px", color: "var(--text-primary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
        </label>
        <button type="button" className={`filter-chip ${soloSinLinea ? "active" : ""}`} onClick={() => setSoloSinLinea((v) => !v)}>
          Sin línea ({sinLinea})
        </button>
      </div>

      <datalist id="lineas-producto">
        {lines.map((l) => <option key={l} value={l} />)}
      </datalist>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="cfg-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Marca</th>
              <th>Línea</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "18px 14px", color: "var(--text-muted)" }}>Ningún producto coincide.</td></tr>
            )}
            {visible.map((p) => {
              const f = fb[p.product_id];
              const saving = f?.kind === "saving";
              const note = (field: Feedback["field"]) =>
                f?.field !== field ? null
                  : f.kind === "error" ? <div role="alert" style={{ marginTop: "4px", fontSize: "12px", color: "var(--danger)" }}>No se pudo guardar: {f.msg}</div>
                  : f.kind === "saved" ? <span role="status" style={{ marginLeft: "8px", whiteSpace: "nowrap", fontSize: "12px", color: "var(--success)" }}>Guardado</span>
                  : null;
              return (
                <tr key={p.product_id} style={{ opacity: p.active ? 1 : 0.6 }}>
                  <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{p.sku}</td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    <div title={p.name} style={{ maxWidth: "420px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  </td>
                  <td style={{ color: p.brand ? "var(--text-secondary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{p.brand ?? "–"}</td>
                  <td style={{ padding: "6px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input list="lineas-producto" value={drafts[p.product_id] ?? p.line ?? ""} placeholder="Sin línea"
                        aria-label={`Línea de ${p.name}`} className="cfg-inline-input" disabled={saving}
                        onChange={(e) => { cancelTimer(p.product_id); clearFb(p.product_id, "saved"); setDrafts((d) => ({ ...d, [p.product_id]: e.target.value })); }}
                        onBlur={() => commitLine(p)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                      {f?.kind === "saved" && note("line")}
                    </div>
                    {f?.kind === "error" && note("line")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input type="checkbox" checked={p.active} disabled={saving} onChange={() => toggleActive(p)} aria-label={`${p.name} activo`} />
                      {p.active ? "Sí" : "No"}
                    </label>
                    {note("active")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-sm">La línea agrupa productos en los filtros y rankings de Tareas. Un producto inactivo deja de aparecer en la app de los mercaderistas.</p>
    </>
  );
}
