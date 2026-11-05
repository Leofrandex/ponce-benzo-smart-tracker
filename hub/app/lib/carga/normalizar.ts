// Debe coincidir con public.fn_norm_texto (tools/migraciones/2026-11-04-ronda-datos.sql).
// Tabla explicita, no NFD: otros acentos no se tocan, igual que en la base.
const DE = "áéíóúüñÁÉÍÓÚÜÑ ";
const A = "aeiouunaeiouun ";

export function normTexto(s: string): string {
  let r = "";
  for (const ch of s ?? "") {
    const i = DE.indexOf(ch);
    r += i >= 0 ? A[i] : ch;
  }
  return r.toLowerCase().replace(/\s+/g, " ").trim();
}

// Debe coincidir con public.fn_norm_rif: solo A-Z a-z 0-9, en mayuscula; "" si queda vacio.
export function normRif(s: string): string {
  return (s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
