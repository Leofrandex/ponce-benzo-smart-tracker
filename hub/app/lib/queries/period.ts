// Periodo compartido por las pantallas de mercaderistas (y el dashboard en el
// Bloque 2): vive en la URL como ?desde=&hasta= ('YYYY-MM-DD').
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function valid(s: string | null): s is string {
  if (!s || !YMD.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parsePeriodo(p: URLSearchParams, def: [string, string]): { desde: string; hasta: string } {
  const desde = p.get("desde");
  const hasta = p.get("hasta");
  if (valid(desde) && valid(hasta) && desde <= hasta) return { desde, hasta };
  return { desde: def[0], hasta: def[1] };
}

export function serializePeriodo(desde: string, hasta: string): string {
  return new URLSearchParams({ desde, hasta }).toString();
}
