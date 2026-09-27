"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { buildVendorRows, fetchVendorAssignmentData, vendorOptions, FILTRO_SIN_VENDEDOR, type VendorAssignRow } from "@/app/lib/queries/config";
import { saveClientVendors } from "@/app/lib/mutations/assignments";
import { MultiSelect } from "@/app/components/ui/MultiSelect";

type RowState = { draft: string[]; saving: boolean; error: string | null; saved: boolean };

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function VendedoresInner() {
  const { data, loading, error, refetch } = useSupabaseQuery(fetchVendorAssignmentData, []);
  const rows = useMemo(() => (data ? buildVendorRows(data.clients, data.assignments, data.users) : []), [data]);
  const options = useMemo(() => (data ? vendorOptions(data.users, rows) : []), [data, rows]);
  const [state, setState] = useState<Record<string, RowState>>({});

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const soloSinVendedor = searchParams.get("filtro") === FILTRO_SIN_VENDEDOR;
  const setSoloSinVendedor = (on: boolean) =>
    router.replace(on ? `${pathname}?filtro=${FILTRO_SIN_VENDEDOR}` : pathname, { scroll: false });

  const sinVendedor = rows.filter((r) => r.assigned.length === 0).length;
  const visible = soloSinVendedor ? rows.filter((r) => r.assigned.length === 0) : rows;

  const current = (r: VendorAssignRow) => r.assigned.map((p) => p.user_id);
  const draftOf = (r: VendorAssignRow) => state[r.client_id]?.draft ?? current(r);
  const patch = (id: string, p: Partial<RowState>, r: VendorAssignRow) =>
    setState((s) => {
      const base: RowState = { draft: draftOf(r), saving: false, error: null, saved: false };
      return { ...s, [id]: { ...base, ...s[id], ...p } };
    });

  async function guardar(r: VendorAssignRow) {
    const next = draftOf(r);
    patch(r.client_id, { saving: true, error: null, saved: false }, r);
    const { error: e } = await saveClientVendors(r.client_id, current(r), next);
    // Error: se conserva el borrador para reintentar. En ambos casos se relee,
    // así la fila muestra lo que de verdad quedó en la base; tras un éxito,
    // current(r) pasa a ser igual a `next` y la fila muestra "Guardado".
    setState((s) => ({ ...s, [r.client_id]: { draft: next, saving: false, error: e, saved: !e } }));
    refetch();
  }

  if (error) return <div className="empty-state"><div className="empty-title">Error al cargar</div><div className="empty-desc">{error}</div></div>;
  if (loading) return <div className="empty-state"><div className="empty-title">Cargando cadenas…</div></div>;

  return (
    <>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className={`filter-chip ${!soloSinVendedor ? "active" : ""}`} onClick={() => setSoloSinVendedor(false)}>
          Todas ({rows.length})
        </button>
        <button type="button" className={`filter-chip ${soloSinVendedor ? "active" : ""}`} onClick={() => setSoloSinVendedor(true)}>
          Sin vendedor ({sinVendedor})
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Cadena</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>Tiendas</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600 }}>Vendedores</th>
              <th style={{ padding: "10px 14px" }} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "18px 14px", color: "var(--text-muted)" }}>Todas las cadenas tienen vendedor.</td></tr>
            )}
            {visible.map((r) => {
              const st = state[r.client_id];
              const draft = draftOf(r);
              const dirty = !sameSet(draft, current(r));
              return (
                <tr key={r.client_id} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{r.name}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.store_count}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <MultiSelect value={draft} options={options} disabled={st?.saving}
                      ariaLabel={`Editar vendedores de ${r.name}`}
                      onChange={(v) => patch(r.client_id, { draft: v, saved: false, error: null }, r)} />
                    {st?.error && <div role="alert" style={{ marginTop: "6px", fontSize: "12px", color: "var(--danger)" }}>No se pudo guardar: {st.error}</div>}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                    {dirty ? (
                      <button type="button" className="filter-chip active" disabled={st?.saving} onClick={() => guardar(r)}>
                        {st?.saving ? "Guardando…" : "Guardar"}
                      </button>
                    ) : st?.saved ? (
                      <span style={{ fontSize: "12px", color: "var(--success)" }}>Guardado</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-sm">Cada vendedor ve las tiendas y tareas de las cadenas que tiene asignadas. El cambio aplica en su próxima carga.</p>
    </>
  );
}

export default function VendedoresPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="empty-title">Cargando…</div></div>}>
      <VendedoresInner />
    </Suspense>
  );
}
