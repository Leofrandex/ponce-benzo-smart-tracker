export type GeoItem = {
  estado: string | null;
  municipio: string | null;
  urbanizacion: string | null;
};

export type GeoFilterValue = {
  estado: string;
  municipio: string;
  urbanizacion: string;
};

export const EMPTY_GEO: GeoFilterValue = { estado: "", municipio: "", urbanizacion: "" };

function uniqSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

export function deriveGeoOptions(items: GeoItem[], value: GeoFilterValue) {
  const estados = uniqSorted(items.map((s) => s.estado));
  const municipios = uniqSorted(
    items.filter((s) => !value.estado || s.estado === value.estado).map((s) => s.municipio),
  );
  const urbanizaciones = uniqSorted(
    items
      .filter(
        (s) =>
          (!value.estado || s.estado === value.estado) &&
          (!value.municipio || s.municipio === value.municipio),
      )
      .map((s) => s.urbanizacion),
  );
  return { estados, municipios, urbanizaciones };
}
