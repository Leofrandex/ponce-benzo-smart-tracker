"use client";

import { useMemo } from "react";
import { Select } from "@/app/components/ui/Select";
import { deriveGeoOptions, type GeoFilterValue, type GeoItem } from "./geoOptions";

export function GeoFilters({
  items, value, onChange,
}: {
  items: GeoItem[];
  value: GeoFilterValue;
  onChange: (v: GeoFilterValue) => void;
}) {
  const { estados, municipios, urbanizaciones } = useMemo(
    () => deriveGeoOptions(items, value),
    [items, value],
  );

  return (
    <>
      <Select label="Estado" value={value.estado}
        options={estados.map((o) => ({ value: o, label: o }))}
        onChange={(v) => onChange({ estado: v, municipio: "", urbanizacion: "" })} />
      <Select label="Municipio" value={value.municipio} disabled={!value.estado}
        options={municipios.map((o) => ({ value: o, label: o }))}
        onChange={(v) => onChange({ ...value, municipio: v, urbanizacion: "" })} />
      <Select label="Urbanización" value={value.urbanizacion} disabled={!value.municipio}
        options={urbanizaciones.map((o) => ({ value: o, label: o }))}
        onChange={(v) => onChange({ ...value, urbanizacion: v })} />
    </>
  );
}
