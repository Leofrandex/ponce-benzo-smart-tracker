---
title: "ADR-019: Editor de rutas semana a semana"
date: 2026-11-08
status: aceptado
tags:
  - adr
  - decisiones
  - rutas
  - mercaderistas
---

# ADR-019: Editor de rutas semana a semana

* **Estado**: `aceptado`
* **Fecha**: 2026-11-08
* **Autores**: Agente de IA & Usuario
* **Modifica**: [[decisiones/ADR-017-Rutas-Fijas-Versionadas|ADR-017]] (solo el editor; el modelo de datos sigue igual)

---

## Contexto
El editor de [[decisiones/ADR-017-Rutas-Fijas-Versionadas|ADR-017]] pedía frecuencia por parada (1 a 4 semanas), semana ancla y fecha "aplica desde". Para el equipo de Ponce & Benzo eso complica el uso. Al 08-11-2026 las rutas fijas de los 7 mercaderistas son casi todas semanales (solo 1 parada de Carlos Faria no lo es) y no hay versiones programadas después del 09-11.

## Decisión
- El editor trabaja **semana a semana**: siempre edita **la semana que viene** (el lunes siguiente a hoy). La rutina es que alguien del equipo la ajuste cada viernes.
- Al entrar, el tablero muestra **lo que el mercaderista haría esa semana con la ruta vigente** (`semanaComoPlantilla`), no la plantilla con frecuencias.
- Al guardar, esa semana queda como ruta **semanal** desde ese lunes y se repite todas las semanas hasta el próximo cambio. También reemplaza cualquier versión programada después de ese lunes (`versionesAGuardar`).
- Desaparecen del editor: frecuencia, semana ancla, fecha "aplica desde", navegador de semanas y el diálogo de versiones futuras (`ConfirmarFuturas.tsx` eliminado).
- **Sin cambios en la base**: `route_plans`, `fn_guardar_ruta`, `fn_materializar_rutas` y el cron siguen igual; las paradas se guardan con `every_n_weeks = 1`.

## Consecuencias
### Positivas 👍
- Menos decisiones por parada: arrastrar, agregar y quitar.
- La ruta de la semana que viene se ve tal cual la hará el mercaderista.

### Negativas / Riesgos 👎
- Una parada cada 2 o más semanas (cargada por CSV) pasa a semanal o desaparece, según si toca la semana editada, la primera vez que se guarda esa ruta.
- No se puede editar la semana en curso desde el editor. Si se necesita un cambio para hoy, se usa una ruta especial.
- Si nadie edita, la última ruta guardada se sigue repitiendo (no hay recordatorio de los viernes).

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[logs/Log-2026-11-08|Log 2026-11-08]]
- [[pendientes/Pendientes|Pendientes]]
