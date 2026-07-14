# `datos/` — Data cruda del proyecto

Único lugar donde vive la data cruda de negocio (RUTAS, coordenadas, MAESTRO, etc.).
Los archivos de datos (`.xlsx`, `.xls`, `.csv`) **no se versionan en git** (solo local);
sí se versionan este README y la estructura de carpetas (`.gitkeep`).

## Flujo: `inbox` → `fuentes` → `procesados`

```
datos/
├── inbox/         📥 Deja aquí cualquier archivo crudo nuevo, tal cual llega.
├── fuentes/       ✅ Fuentes ACTIVAS que lee la ingesta (nombres canónicos estables).
└── procesados/    🗄️  Histórico local de archivos ya ingeridos (renombrados con fecha).
```

1. **Dejas** el archivo nuevo en `inbox/` (no importa el nombre con el que venga).
2. El agente lo revisa/normaliza y lo **promueve** a `fuentes/` con su nombre canónico
   (reemplazando el contenido anterior).
3. Se corre la **ingesta** (`tools/ingesta/`).
4. La versión reemplazada se **archiva** en `procesados/` con sufijo de fecha.

## Nombres canónicos en `fuentes/`

La ingesta apunta a estos nombres estables (no a nombres con fecha):

| Archivo canónico                       | Qué es                          | Lo lee                                |
|----------------------------------------|---------------------------------|---------------------------------------|
| `fuentes/rutas.xlsx`                   | Rutas/sucursales del piloto     | `stageStores.ts`, `stageRoutes.ts`    |
| `fuentes/coordenadas-farmatodo.xlsx`   | Coordenadas de tiendas Farmatodo| `stageFarmatodoStores.ts`, `stageFarmatodoRoutes.ts` |
| `fuentes/maestro.xlsx`                 | Maestro de negocio (referencia) | — (referencia, no ingerido hoy)       |

> Al reemplazar contenido en `fuentes/`, **conserva el nombre canónico**. Así el pipeline
> no se rompe cuando llega un archivo con fecha distinta en el nombre.
