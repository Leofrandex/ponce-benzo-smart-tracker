// PostgREST corta cada respuesta en 1.000 filas. Pide páginas [from, to]
// (ambos inclusivos, como .range()) hasta que una venga incompleta.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}
