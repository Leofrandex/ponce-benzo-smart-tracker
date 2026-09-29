"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Map as MapIcon, Radio, History, Activity, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSupabaseQuery } from "@/app/lib/hooks/useSupabaseQuery";
import { fetchStores } from "@/app/lib/queries/stores";
import { fetchLivePositions, fetchMerchandisers, type LivePosition } from "@/app/lib/queries/sessions";
import { fetchTaskAssignees } from "@/app/lib/queries/assignments";
import { MapFilterSidebar } from "@/app/components/mapa/MapFilterSidebar";
import Segmented from "@/app/components/ui/Segmented";
import {
  TODAS, agruparPorCadena, elegirVendedor, parseMapParams, resumenMapa, serializeMapParams,
  type MapFilterValue, type TiendaMapa,
} from "@/app/lib/queries/mapFilters";
import type { MapMerchandiser } from "@/app/lib/map-data";
import { MapaSkeleton, Skeleton, SkeletonCard, SkeletonList } from "@/app/components/ui/Skeleton";

const MapLiveView = dynamic(() => import("@/app/components/mapa/MapLiveView"), {
  ssr: false,
  loading: () => <MapLoading label="Cargando mapa…" />,
});
const MapHistoryView = dynamic(() => import("@/app/components/mapa/MapHistoryView"), {
  ssr: false,
  loading: () => <MapLoading label="Generando mapa de calor…" />,
});

function MapLoading({ label }: { label: string }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}><MapIcon size={20} style={{ marginRight: 8, opacity: 0.5 }} /> {label}</div>;
}

type Tab = "live" | "history";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Bottom sheet de filtros (solo < 768px; en escritorio el CSS lo oculta).
// Esc / tap fuera cierran; el foco entra al abrir y vuelve al botón al cerrar.
function FilterSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-overlay map-filters-sheet" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="sheet map-filters-sheet" role="dialog" aria-modal="true" aria-labelledby="map-filters-title" tabIndex={-1}>
        <div className="sheet-grip" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div id="map-filters-title" className="sheet-title" style={{ margin: 0 }}>Filtros del mapa</div>
          <button type="button" onClick={onClose} aria-label="Cerrar filtros" className="focus-ring"
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

function MapaInner() {
  const [tab, setTab] = useState<Tab>("live");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // --- Real data from Supabase ---
  const { data: stores } = useSupabaseQuery(fetchStores, [], "stores");
  const { data: roster } = useSupabaseQuery(fetchMerchandisers, [], "merch:roster");
  const { data: rawAssignees } = useSupabaseQuery(fetchTaskAssignees, [], "assignees");
  const assignees = useMemo(() => rawAssignees ?? [], [rawAssignees]);

  // parseMapParams descarta las tiendas que no conoce: si corre mientras
  // `stores` sigue cargando, la selección de una URL compartida colapsaría a
  // "ninguna" y cualquier cambio de filtro escribiría tiendas=ninguna en la
  // URL. Por eso, mientras stores no cargó, no se renderiza el sidebar y las
  // vistas del mapa usan TODAS para tiendas (el merch/vendedor sí es
  // independiente de stores y se parsea igual).
  const storesLoaded = stores !== null;
  const tiendasMapa = useMemo<TiendaMapa[]>(
    () => (stores ?? []).map((s) => ({ store_id: s.store_id, name: s.name, client_id: s.client_id ?? null, client_name: s.client_name ?? null })),
    [stores],
  );
  const grupos = useMemo(() => agruparPorCadena(tiendasMapa), [tiendasMapa]);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qs = sp.toString();
  const parsedFilters = useMemo(
    () => parseMapParams(new URLSearchParams(qs), storesLoaded ? tiendasMapa : []),
    [qs, tiendasMapa, storesLoaded],
  );
  const filters: MapFilterValue = storesLoaded ? parsedFilters : { ...parsedFilters, tiendas: TODAS };
  const setFilters = (v: MapFilterValue) => {
    const next = serializeMapParams(v, grupos);
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assignees) m.set(a.user_id, a.full_name);
    return Array.from(m, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [assignees]);

  const [positions, setPositions] = useState<LivePosition[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const p = await fetchLivePositions();
        if (active) setPositions(p);
      } catch { /* silencioso: el mapa muestra vacío */ }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const activeCount = positions.length;

  // Map LivePosition → MapMerchandiser shape expected by the marker layer
  // (sólo activos: son los que tienen posición real para dibujar un marcador).
  const merchandisers = useMemo<MapMerchandiser[]>(
    () => positions.map((p) => ({
      id: p.user_id,
      name: p.full_name,
      status: "active" as const,
      lat: p.lat,
      lng: p.lng,
      lastSeen: p.last_seen,
    })),
    [positions],
  );

  // Lista del FILTRO: roster completo (los 5), marcando activo/inactivo según
  // quién tiene posición en vivo. Si por algo falla el roster, cae a los activos.
  const filterMerchandisers = useMemo<MapMerchandiser[]>(() => {
    const livePos = new Map(positions.map((p) => [p.user_id, p]));
    const base = (roster ?? []).map((m) => {
      const live = livePos.get(m.user_id);
      return {
        id: m.user_id,
        name: m.full_name,
        status: (live ? "active" : "offline") as "active" | "offline",
        lat: live?.lat ?? 0,
        lng: live?.lng ?? 0,
        lastSeen: live?.last_seen,
      };
    });
    // Mercaderistas activos que no estén en el roster (defensa) se agregan igual.
    for (const p of positions) {
      if (!base.some((b) => b.id === p.user_id)) {
        base.push({ id: p.user_id, name: p.full_name, status: "active", lat: p.lat, lng: p.lng, lastSeen: p.last_seen });
      }
    }
    return base.length > 0 ? base : merchandisers;
  }, [roster, positions, merchandisers]);

  const safeStores = stores ?? [];

  const sidebar = (inSheet: boolean) => (
    <MapFilterSidebar
      value={filters}
      onChange={setFilters}
      grupos={grupos}
      merchandisers={filterMerchandisers}
      vendedores={vendedores}
      onVendedor={(u) => setFilters(elegirVendedor(filters, u, tiendasMapa, assignees))}
      inSheet={inSheet}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: "12px" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Mapa</h1>
        <p className="text-muted text-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}><Activity size={13} /> {activeCount} mercaderistas activos</p>
      </div>

      <div style={{ display: "flex", gap: "14px", flex: 1, minHeight: 0 }}>
        {/* Escritorio: columna fija de filtros. En teléfono (< 768px) la oculta el CSS. */}
        <div className="map-filters-desktop" style={{ display: "flex", minHeight: 0 }}>
          {storesLoaded ? sidebar(false) : (
            <SkeletonCard style={{ width: 250, flexShrink: 0 }}>
              <Skeleton h={12} w={100} pill />
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={34} style={{ borderRadius: "var(--radius-sm)" }} />)}
              <SkeletonList rows={4} />
            </SkeletonCard>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Teléfono: los filtros se abren en un bottom sheet; el mapa usa todo el ancho. */}
          <button type="button" className="map-filters-btn" disabled={!storesLoaded}
            aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={15} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {storesLoaded ? `Filtros (${resumenMapa(filters, grupos, filterMerchandisers.length)})` : "Cargando filtros…"}
            </span>
          </button>

          <Segmented<Tab>
            ariaLabel="Vista del mapa"
            value={tab}
            onChange={setTab}
            style={{ width: "fit-content" }}
            options={[
              { value: "live", label: <><Radio size={14} /> En vivo</> },
              { value: "history", label: <><History size={14} /> Histórico</> },
            ]}
          />

          <div style={{ flex: 1, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", background: "#f8fafc", position: "relative" }}>
            <AnimatePresence mode="wait">
              <motion.div key={tab}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                style={{ width: "100%", height: "100%" }}>
                {tab === "live"
                  ? <MapLiveView filters={filters} stores={safeStores} merchandisers={merchandisers} />
                  : <MapHistoryView filters={filters} stores={safeStores} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FilterSheet open={filtersOpen && storesLoaded} onClose={() => setFiltersOpen(false)}>
        {sidebar(true)}
      </FilterSheet>
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense fallback={<MapaSkeleton />}>
      <MapaInner />
    </Suspense>
  );
}
