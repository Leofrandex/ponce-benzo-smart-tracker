import type { CSSProperties, ReactNode } from "react";

// Piezas de carga tipo skeleton. Reservan la forma del contenido real para que
// la sección aparezca al instante y el layout no salte cuando llegan los datos.
// Sin estado ni efectos: sirven igual en loading.tsx (servidor) que en cliente.

type Size = number | string;

export function Skeleton({ w = "100%", h = 12, pill, circle, style }: {
  w?: Size; h?: Size; pill?: boolean; circle?: boolean; style?: CSSProperties;
}) {
  const cls = `skeleton${pill ? " skeleton-pill" : ""}${circle ? " skeleton-circle" : ""}`;
  return <span aria-hidden="true" className={cls} style={{ width: w, height: circle ? w : h, ...style }} />;
}

// Contenedor de una pantalla en carga: lo anuncia una sola vez al lector de pantalla.
export function SkeletonScreen({ label = "Cargando…", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="skeleton-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="skeleton-card" aria-hidden="true" style={style}>{children}</div>;
}

export function SkeletonDivider() {
  return <div className="skeleton-divider" aria-hidden="true" />;
}

// Párrafo: la última línea más corta, como un texto real.
export function SkeletonLines({ lines = 3, h = 10, gap = 8 }: { lines?: number; h?: number; gap?: number }) {
  const widths = ["92%", "70%", "84%", "58%", "76%"];
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={h} pill w={i === lines - 1 && lines > 1 ? "45%" : widths[i % widths.length]} />
      ))}
    </div>
  );
}

// Lista: nombre + detalle a la izquierda, cifra a la derecha, hairline entre filas.
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                              padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <Skeleton h={10} pill w={`${55 + ((i * 17) % 30)}%`} />
            <Skeleton h={8} pill w={`${25 + ((i * 11) % 20)}%`} />
          </div>
          <Skeleton h={10} w={44} pill />
        </div>
      ))}
    </div>
  );
}

// Tabla dentro de card: cabecera tenue + filas con la primera columna ancha.
export function SkeletonTable({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  const grid = `2fr repeat(${cols - 1}, 1fr)`;
  return (
    <div className="card" aria-hidden="true" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        {Array.from({ length: cols }, (_, c) => <Skeleton key={c} h={8} pill w={c === 0 ? "40%" : "60%"} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: grid, gap: 16, alignItems: "center", padding: "14px 16px",
                              borderTop: r === 0 ? "none" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton h={10} pill w={`${50 + ((r * 13) % 35)}%`} />
            <Skeleton h={8} pill w={`${25 + ((r * 7) % 20)}%`} />
          </div>
          {Array.from({ length: cols - 1 }, (_, c) => <Skeleton key={c} h={10} pill w={`${40 + (((r + c) * 9) % 35)}%`} />)}
        </div>
      ))}
    </div>
  );
}

// Encabezado de sección: el título es conocido de antemano y se pinta real;
// solo el subtítulo (que depende de datos) va en skeleton.
export function SkeletonHeader({ title, action }: { title?: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {title
          ? <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "var(--tracking-tight)" }}>{title}</h1>
          : <Skeleton h={28} w={200} />}
        <Skeleton h={10} w={220} pill />
      </div>
      {action}
    </div>
  );
}

// Selector de periodo (Hoy / 7 días / 30 días / rango).
export function SkeletonPeriod() {
  return (
    <div aria-hidden="true" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[52, 64, 70, 96].map((w, i) => <Skeleton key={i} h={32} w={w} pill />)}
    </div>
  );
}

function SkeletonCardTitle({ w = 140 }: { w?: number }) {
  return <Skeleton h={12} w={w} pill style={{ marginBottom: 4 }} />;
}

/* ─────────────────────────── Pantallas completas ─────────────────────────── */

// Genérica: encabezado + un par de tarjetas. Solo de respaldo.
export function PanelSkeleton() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonCard><SkeletonCardTitle w={180} /><SkeletonLines lines={3} /></SkeletonCard>
      <SkeletonCard><SkeletonCardTitle /><SkeletonList rows={5} /></SkeletonCard>
    </SkeletonScreen>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonScreen label="Cargando el panel…">
      <SkeletonHeader title="Panel" />
      <SkeletonPeriod />
      <div className="kpi-grid" aria-hidden="true">
        <div className="kpi-card kpi-primaria">
          <Skeleton h={10} w={110} pill />
          <Skeleton h={40} w={140} />
          <Skeleton h={10} w="60%" pill />
          <Skeleton h={8} pill />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="kpi-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton h={10} w={90} pill />
            <Skeleton h={22} w={64} />
          </div>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonCardTitle w={180} />
        <Skeleton h={220} />
      </SkeletonCard>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <SkeletonCard><SkeletonCardTitle /><Skeleton h={180} /></SkeletonCard>
        <SkeletonCard><SkeletonCardTitle /><SkeletonList rows={4} /></SkeletonCard>
      </div>
      <SkeletonCard><SkeletonCardTitle w={200} /><SkeletonList rows={5} /></SkeletonCard>
    </SkeletonScreen>
  );
}

// Tiendas: buscador + filtros + tabla.
export function TiendasSkeleton() {
  return (
    <SkeletonScreen label="Cargando tiendas…">
      <SkeletonHeader title="Tiendas" action={<Skeleton h={30} w={140} pill />} />
      <Skeleton h={40} style={{ borderRadius: "var(--radius-sm)" }} />
      <SkeletonFilters count={4} />
      <SkeletonTable rows={9} cols={5} />
    </SkeletonScreen>
  );
}

export function ClientesSkeleton() {
  return (
    <SkeletonScreen label="Cargando clientes…">
      <SkeletonHeader title="Clientes" />
      <SkeletonFilters count={3} />
      <div className="card" aria-hidden="true" style={{ padding: "4px 16px" }}>
        <SkeletonList rows={8} />
      </div>
    </SkeletonScreen>
  );
}

// Fila de selects dentro de card (Estado / Municipio / Vendedor…).
export function SkeletonFilters({ count = 3 }: { count?: number }) {
  return (
    <div className="card" aria-hidden="true" style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 140px", maxWidth: 220 }}>
          <Skeleton h={8} w={60} pill />
          <Skeleton h={34} style={{ borderRadius: "var(--radius-sm)" }} />
        </div>
      ))}
    </div>
  );
}

// Tarjetas de tarea: título + meta a la izquierda, estado a la derecha.
export function SkeletonTaskList({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Skeleton circle w={32} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton h={12} pill w={`${45 + ((i * 19) % 35)}%`} />
            <Skeleton h={9} pill w={`${30 + ((i * 7) % 25)}%`} />
          </div>
          <Skeleton h={22} w={78} pill />
        </div>
      ))}
    </div>
  );
}

export function TareasSkeleton() {
  return (
    <SkeletonScreen label="Cargando tareas…">
      <SkeletonHeader title="Tareas" />
      <SkeletonCard>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton h={9} w="60%" pill />
              <Skeleton h={22} w={48} />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <div aria-hidden="true" style={{ display: "flex", gap: 8 }}>
        {[60, 76, 96].map((w, i) => <Skeleton key={i} h={32} w={w} pill />)}
      </div>
      <SkeletonFilters count={4} />
      <SkeletonTaskList />
    </SkeletonScreen>
  );
}

export function MercaderistasSkeleton() {
  return (
    <SkeletonScreen label="Cargando mercaderistas…">
      <SkeletonHeader title="Mercaderistas" action={<SkeletonPeriod />} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonScreen>
  );
}

// Ficha de detalle (tienda o mercaderista): cabecera con avatar, bloque
// principal y columna lateral, como en la referencia de diseño.
export function DetailSkeleton({ back, label = "Cargando…" }: { back?: string; label?: string }) {
  return (
    <SkeletonScreen label={label}>
      {back ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 500 }}>← {back}</span> : <Skeleton h={10} w={90} pill />}
      <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Skeleton circle w={52} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Skeleton h={22} w="40%" />
          <Skeleton h={10} w="25%" pill />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <SkeletonCard>
          <Skeleton h={140} style={{ borderRadius: "var(--radius-sm)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <Skeleton h={10} w="45%" pill />
              <Skeleton h={10} w="60%" pill />
            </div>
            <Skeleton h={34} w="42%" pill />
          </div>
          <SkeletonDivider />
          <SkeletonLines lines={4} />
          <SkeletonDivider />
          <Skeleton h={30} pill />
        </SkeletonCard>
        <SkeletonCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <Skeleton h={10} w="70%" pill />
              <Skeleton h={10} w="45%" pill />
            </div>
            <Skeleton circle w={40} />
          </div>
          <SkeletonDivider />
          <Skeleton h={230} style={{ borderRadius: "var(--radius-sm)" }} />
        </SkeletonCard>
      </div>
    </SkeletonScreen>
  );
}

export function MapaSkeleton() {
  return (
    <SkeletonScreen label="Cargando mapa…">
      <SkeletonHeader title="Mapa" action={<Skeleton h={36} w={200} pill />} />
      <div aria-hidden="true" style={{ flex: 1, minHeight: 420, display: "flex", gap: 16 }}>
        {/* En teléfono el CSS oculta la columna de filtros, igual que en el mapa real. */}
        <div className="map-filters-desktop" style={{ display: "flex" }}>
          <SkeletonCard style={{ width: 250, flexShrink: 0 }}>
            <SkeletonCardTitle w={100} />
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={34} style={{ borderRadius: "var(--radius-sm)" }} />)}
            <SkeletonDivider />
            <SkeletonList rows={4} />
          </SkeletonCard>
        </div>
        <Skeleton h="auto" style={{ flex: 1, minHeight: 420, borderRadius: "var(--radius-lg)" }} />
      </div>
    </SkeletonScreen>
  );
}

// Tabla de configuración (vendedores / productos), sin cabecera: la pone el layout.
export function ConfigTableSkeleton({ label = "Cargando…" }: { label?: string }) {
  return (
    <SkeletonScreen label={label}>
      <div aria-hidden="true" style={{ display: "flex", gap: 8 }}>
        <Skeleton h={36} w={300} style={{ borderRadius: "var(--radius-sm)" }} />
        <Skeleton h={32} w={110} pill />
      </div>
      <SkeletonTable rows={8} cols={4} />
    </SkeletonScreen>
  );
}

export function ConfigSkeleton() {
  return (
    <SkeletonScreen label="Cargando configuración…">
      <SkeletonHeader title="Configuración" />
      <div aria-hidden="true" style={{ display: "flex", gap: 20, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
        <Skeleton h={12} w={80} pill />
        <Skeleton h={12} w={80} pill />
      </div>
      <SkeletonTable rows={8} cols={4} />
    </SkeletonScreen>
  );
}
