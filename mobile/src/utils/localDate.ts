// Fecha del calendario local del teléfono. toISOString() da la fecha UTC:
// en Caracas (UTC-4), después de las 20:00 ya es "mañana" y el servidor la
// descarta por futura.
export function fechaLocalISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Mediodía local: new Date("YYYY-MM-DD") es medianoche UTC, que en Caracas
// es el día anterior.
export function fechaDesdeISO(s: string): Date {
  return new Date(`${s}T12:00:00`);
}
