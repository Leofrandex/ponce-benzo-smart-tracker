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

/**
 * Como withTimeout pero RECHAZA al vencer el plazo (y propaga el rechazo original).
 * Para operaciones donde el fallo debe contarse (ej. sync: un request colgado por
 * mala señal no puede congelar la cola entera — se marca fallido y se reintenta luego).
 */
export function withDeadline<T>(promise: PromiseLike<T>, ms: number, label = 'operación'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error(`timeout ${ms}ms: ${label}`)); }
    }, ms);
    promise.then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
      (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } },
    );
  });
}
