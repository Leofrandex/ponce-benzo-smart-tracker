---
title: "ADR-017: Rutas fijas versionadas y materializadas en routes"
date: 2026-10-29
status: aceptado
tags:
  - adr
  - decisiones
  - rutas
  - mercaderistas
---

# ADR-017: Rutas fijas versionadas y materializadas en `routes`

* **Estado**: `aceptado`
* **Fecha**: 2026-10-29
* **Autores**: Agente de IA & Usuario

---

## Contexto
Las rutas se cargaban por CSV (`tools/cargar-rutas-csv.ts`), que materializaba una fila de `routes` por mercaderista y día hasta el 31-12-2026. Cualquier cambio obligaba a regenerar todo.

Análisis de la base (2026-10-29): las rutas de los mercaderistas veteranos varían según la semana del mes (`ceil(día/7)`, tratando la semana 5 como la 1). De 312 combinaciones tienda-día, 207 son semanales, 93 cada 2 semanas, 9 de una sola semana y 3 en las semanas {2,3,4}. La regla "semana 5 = semana 1" hace que dos semanas seguidas compartan ruta en el cambio de mes, así que una tienda quincenal queda con huecos de 1 o 3 semanas.

## Decisión
- Una **ruta fija por mercaderista, lunes a viernes, versionada** (`route_plans` + `route_plan_stops`). Cada parada tiene frecuencia de 1 a 4 semanas, contada en semanas corridas desde un lunes ancla.
- Los cambios aplican **desde una fecha elegida** (mínimo mañana).
- Se **materializa en la tabla `routes` existente** (hoy + 8 semanas) con `fn_materializar_rutas`; se guarda con la RPC `fn_guardar_ruta` (solo `admin`, con control de conflicto de versión). El job de pg_cron `rutas_fijas_extender` (`0 5 * * *`, 01:00 Caracas) la extiende cada noche.
- La app móvil, los dashboards y la vista semanal del hub **siguen leyendo `routes` sin cambios**.
- Editor en el hub: `/panel/mercaderistas/[id]/ruta` (tablero con arrastrar y soltar), botón "Editar ruta" en el perfil y etiqueta "Sin ruta fija" en la lista. Solo el rol `admin` edita (hoy Diego Mori, Rosli Aponte y Jollalvis).
- **Sin migración automática** (decisión del usuario): las filas del CSV siguen mandando hasta el primer guardado de cada mercaderista; el editor arranca vacío.
- Migraciones: `tools/migraciones/2026-10-29-rutas-fijas-01-modelo.sql` y `…-02-guardar-cron.sql`; verificación en `tools/check_rutas_fijas.sql`.

## Consecuencias
### Positivas 👍
- Cambiar una ruta ya no obliga a regenerar nada; la frecuencia quincenal queda pareja (sin huecos de 1 o 3 semanas).
- Móvil y dashboards no se tocan: `routes` sigue siendo la fuente de lectura.

### Negativas / Riesgos 👎
- **Fecha límite 31-12-2026**: todo mercaderista activo necesita su ruta fija antes de esa fecha o no tendrá ruta desde el 01-01-2027.
- Jonathan Fernández ya no hace rutas, no entra en el alcance.
- `tools/cargar-rutas-csv.ts` y `revisar-rutas-*.ts` quedan por retirar cuando todos tengan ruta fija.
- Verificación en navegador del editor como admin pendiente (no hubo credenciales de admin en la sesión).

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[pendientes/Pendientes|Pendientes]]
- [[logs/Log-2026-10-30|Log 2026-10-30]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
