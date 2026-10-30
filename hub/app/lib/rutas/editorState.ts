import { diffPlan, normalizarAncla, opcionesSemana, primerLunesDesde, type Frecuencia, type Parada, type Weekday } from "./plan";

export type EditorState = { effectiveFrom: string; base: Parada[]; stops: Parada[] };
export type Accion =
  | { tipo: "agregar"; weekday: Weekday; store_id: string }
  | { tipo: "quitar"; weekday: Weekday; store_id: string }
  | { tipo: "mover"; store_id: string; desde: Weekday; hacia: Weekday; indice: number }
  | { tipo: "frecuencia"; weekday: Weekday; store_id: string; n: Frecuencia }
  | { tipo: "semana"; weekday: Weekday; store_id: string; anchor_monday: string }
  | { tipo: "fecha"; effectiveFrom: string }
  | { tipo: "descartar" };

const DIAS: Weekday[] = [1, 2, 3, 4, 5];

// Ordena por día y posición, y deja las posiciones consecutivas desde 1.
function compactar(stops: Parada[]): Parada[] {
  return DIAS.flatMap((w) =>
    stops.filter((s) => s.weekday === w).sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, position: i + 1 })),
  );
}

// Las semanas elegibles empiezan en la primera semana laboral desde la fecha (sábado/domingo → el lunes siguiente).
const semanas = (effectiveFrom: string, n: Frecuencia) => opcionesSemana(primerLunesDesde(effectiveFrom), n);
const ancla = (anchor: string, effectiveFrom: string, n: Frecuencia) => normalizarAncla(anchor, primerLunesDesde(effectiveFrom), n);

const reanclar = (stops: Parada[], effectiveFrom: string) =>
  stops.map((s) => ({ ...s, anchor_monday: ancla(s.anchor_monday, effectiveFrom, s.every_n_weeks) }));

export function iniciarEditor(base: Parada[], effectiveFrom: string): EditorState {
  const b = compactar(reanclar(base, effectiveFrom));
  return { effectiveFrom, base: b, stops: b };
}

export function stopsDelDia(s: EditorState, weekday: Weekday): Parada[] {
  return s.stops.filter((x) => x.weekday === weekday).sort((a, b) => a.position - b.position);
}

const actualiza = (s: EditorState, weekday: Weekday, store_id: string, f: (p: Parada) => Parada): EditorState => ({
  ...s,
  stops: s.stops.map((p) => (p.weekday === weekday && p.store_id === store_id ? f(p) : p)),
});

export function reducir(s: EditorState, a: Accion): EditorState {
  switch (a.tipo) {
    case "agregar": {
      if (s.stops.some((p) => p.weekday === a.weekday && p.store_id === a.store_id)) return s;
      const nueva: Parada = {
        weekday: a.weekday, position: stopsDelDia(s, a.weekday).length + 1, store_id: a.store_id,
        every_n_weeks: 1, anchor_monday: primerLunesDesde(s.effectiveFrom),
      };
      return { ...s, stops: compactar([...s.stops, nueva]) };
    }
    case "quitar":
      return { ...s, stops: compactar(s.stops.filter((p) => !(p.weekday === a.weekday && p.store_id === a.store_id))) };
    case "mover": {
      const p = s.stops.find((x) => x.weekday === a.desde && x.store_id === a.store_id);
      if (!p) return s;
      if (a.desde !== a.hacia && s.stops.some((x) => x.weekday === a.hacia && x.store_id === a.store_id)) return s;
      const resto = s.stops.filter((x) => x !== p);
      const destino = compactar(resto).filter((x) => x.weekday === a.hacia);
      const i = Math.max(0, Math.min(a.indice, destino.length));
      destino.splice(i, 0, { ...p, weekday: a.hacia });
      const otros = resto.filter((x) => x.weekday !== a.hacia);
      return { ...s, stops: compactar([...otros, ...destino.map((x, k) => ({ ...x, position: k + 1 }))]) };
    }
    case "frecuencia":
      return actualiza(s, a.weekday, a.store_id, (p) => ({
        ...p,
        every_n_weeks: a.n,
        anchor_monday: p.every_n_weeks > 1 ? ancla(p.anchor_monday, s.effectiveFrom, a.n) : semanas(s.effectiveFrom, a.n)[0],
      }));
    case "semana":
      return actualiza(s, a.weekday, a.store_id, (p) =>
        semanas(s.effectiveFrom, p.every_n_weeks).includes(a.anchor_monday) ? { ...p, anchor_monday: a.anchor_monday } : p);
    case "fecha":
      // base y stops se reanclan igual: cambiar la fecha no es una edición.
      return { effectiveFrom: a.effectiveFrom, base: reanclar(s.base, a.effectiveFrom), stops: reanclar(s.stops, a.effectiveFrom) };
    case "descartar":
      return { ...s, stops: s.base };
  }
}

export function contarCambios(s: EditorState): number {
  const d = diffPlan(s.base, s.stops);
  // Un día cuenta como "orden distinto" solo si las tiendas que siguen en él cambiaron de orden entre sí;
  // las altas y bajas ya se cuentan aparte.
  const reordenados = DIAS.filter((w) => {
    if (!d.orden[w]) return false;
    const antes = s.base.filter((p) => p.weekday === w).map((p) => p.store_id);
    const despues = d.orden[w]!;
    const comunes = new Set(antes.filter((id) => despues.includes(id)));
    return antes.filter((id) => comunes.has(id)).join("|") !== despues.filter((id) => comunes.has(id)).join("|");
  });
  return d.altas.length + d.bajas.length + d.cambios.length + reordenados.length;
}
