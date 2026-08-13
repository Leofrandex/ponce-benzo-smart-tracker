"use client";

interface TimePeriodSelectorProps {
  desde: string; // 'YYYY-MM-DD'
  hasta: string; // 'YYYY-MM-DD'
  onChange: (desde: string, hasta: string) => void;
}

const PRESETS = [
  { label: "7 días", dias: 7 },
  { label: "14 días", dias: 14 },
  { label: "30 días", dias: 30 },
  { label: "90 días", dias: 90 },
];

export function iso(d: Date): string {
  // Fecha local del navegador, no UTC: toISOString() desplazaria el dia para
  // quien esta en UTC-4, que es todo el equipo.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Rango de `dias` en total, ambos extremos inclusivos: "7 días" son 7, no 8.
export function rangoDeDias(dias: number): [string, string] {
  const hoy = new Date();
  const ini = new Date(hoy);
  ini.setDate(ini.getDate() - (dias - 1));
  return [iso(ini), iso(hoy)];
}

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde + "T00:00:00");
  const b = new Date(hasta + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export default function TimePeriodSelector({ desde, hasta, onChange }: TimePeriodSelectorProps) {
  const hoy = iso(new Date());
  // Un preset se marca activo solo si el rango coincide exactamente con el suyo
  // y termina hoy; si el usuario mueve una fecha, deja de estar activo.
  const activo = hasta === hoy ? diasEntre(desde, hasta) : -1;

  function cambiarDesde(v: string) {
    if (!v) return;
    // Un desde posterior al hasta daria un rango vacio sin avisar: se arrastra.
    onChange(v, v > hasta ? v : hasta);
  }

  function cambiarHasta(v: string) {
    if (!v) return;
    onChange(v < desde ? v : desde, v);
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {PRESETS.map((p) => (
        <button
          key={p.dias}
          onClick={() => onChange(...rangoDeDias(p.dias))}
          className={`filter-chip${activo === p.dias ? " active" : ""}`}
        >
          {p.label}
        </button>
      ))}

      <span className="text-muted" style={{ fontSize: 12, marginLeft: 4 }}>o</span>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span className="text-muted">Desde</span>
        <input
          type="date"
          value={desde}
          max={hoy}
          onChange={(e) => cambiarDesde(e.target.value)}
          style={{
            fontSize: 12, padding: "4px 8px", borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span className="text-muted">hasta</span>
        <input
          type="date"
          value={hasta}
          max={hoy}
          onChange={(e) => cambiarHasta(e.target.value)}
          style={{
            fontSize: 12, padding: "4px 8px", borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      <span className="text-muted" style={{ fontSize: 11 }}>
        {diasEntre(desde, hasta)} día{diasEntre(desde, hasta) === 1 ? "" : "s"}
      </span>
    </div>
  );
}
