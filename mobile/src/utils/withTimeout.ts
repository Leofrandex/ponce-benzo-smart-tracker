/**
 * Corre `promise` con un límite de tiempo. Si no resuelve en `ms`, o si rechaza,
 * devuelve `fallback` (nunca lanza). Útil para que un await opcional (ej. un fix
 * de GPS) no bloquee el flujo: se sigue con el fallback y el resto se completa después.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish(fallback), ms);
    promise.then((v) => finish(v), () => finish(fallback));
  });
}
