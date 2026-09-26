// Shared light-mode tile config (CARTO Positron).
// Desde el 23-sep-2026 CARTO exige ?key= en cada tile; sin ella sirve una marca de agua "API KEY REQUIRED".
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY;
export const LIGHT_TILE_URL = `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY ? `?key=${CARTO_KEY}` : ""}`;
export const LIGHT_TILE_ATTRIBUTION = "&copy; <a href='https://carto.com/'>CARTO</a> | &copy; OpenStreetMap";
export const CARACAS_CENTER: [number, number] = [10.4880, -66.8520];
