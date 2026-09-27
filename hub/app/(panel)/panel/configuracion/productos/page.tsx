"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchCatalog, filterCatalog, lineSuggestions, normalizeLine, type CatalogProduct } from "@/app/lib/queries/products";
import { updateProduct } from "@/app/lib/mutations/products";

type Feedback = { kind: "saving" | "saved" | "error"; msg?: string };

export default function ProductosPage() {
  const { data, loading, error, refetch } = useSupabaseQuery(fetchCatalog, []);
  const products = useMemo(() => data ?? [], [data]);
  const lines = useMemo(() => lineSuggestions(products), [products]);
  const [q, setQ] = useState("");
  const [soloSinLinea, setSoloSinLinea] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fb, setFb] = useState<Record<string, Feedback>>({});
  const visible = useMemo(() => filterCatalog(products, q, soloSinLinea), [products, q, soloSinLinea]);
  const sinLinea = products.filter((p) => !p.line).length;

  async function save(p: CatalogProduct, patch: { line?: string | null; active?: boolean }) {
    setFb((s) => ({ ...s, [p.product_id]: { kind: "saving" } }));
    const { error: e } = await updateProduct(p.product_id, patch);
    setFb((s) => ({ ...s, [p.product_id]: e ? { kind: "error", msg: e } : { kind: "saved" } }));
    if (!e) setDrafts((d) => { const n = { ...d }; delete n[p.product_id]; return n; });
    refetch();
  }

  function commitLine(p: CatalogProduct) {
    const raw = drafts[p.product_id];
    if (raw === undefined) return;
    const next = normalizeLine(raw, lines);
    if (next === p.line) { setDrafts((d) => { const n = { ...d }; delete n[p.product_id]; return n; }); return; }
    save(p, { line: next });
  }

  function toggleActive(p: CatalogProduct) {
    if (p.active && !window.confirm(`¿Desactivar "${p.name}"? Dejará de aparecer en la app de los mercaderistas.`)) return;
    save(p, { active: !p.active });
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

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>SKU</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Producto</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Marca</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Línea</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Activo</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "18px 14px", color: "var(--text-muted)" }}>Ningún producto coincide.</td></tr>
            )}
            {visible.map((p) => {
              const f = fb[p.product_id];
              return (
                <tr key={p.product_id} style={{ borderTop: "1px solid var(--border)", opacity: p.active ? 1 : 0.6 }}>
                  <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{p.sku}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{p.brand ?? "—"}</td>
                  <td style={{ padding: "8px 14px" }}>
                    <input list="lineas-producto" value={drafts[p.product_id] ?? p.line ?? ""} placeholder="Sin línea"
                      aria-label={`Línea de ${p.name}`}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.product_id]: e.target.value }))}
                      onBlur={() => commitLine(p)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      style={{ width: "100%", minWidth: "160px", padding: "6px 10px", fontFamily: "inherit", fontSize: "13px", color: "var(--text-primary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
                    {f?.kind === "error" && <div role="alert" style={{ marginTop: "4px", fontSize: "12px", color: "var(--danger)" }}>No se pudo guardar: {f.msg}</div>}
                    {f?.kind === "saved" && <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--success)" }}>Guardado</div>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input type="checkbox" checked={p.active} disabled={f?.kind === "saving"} onChange={() => toggleActive(p)} aria-label={`${p.name} activo`} />
                      {p.active ? "Sí" : "No"}
                    </label>
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
