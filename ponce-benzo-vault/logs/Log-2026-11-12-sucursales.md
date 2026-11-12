---
title: "Sesión: Log-2026-11-12 (sucursales nuevas publicadas y editor de rutas)"
date: 2026-11-12
tags:
  - log
  - sesion
  - sucursales
  - mobile
  - rutas
---

# Log de Sesión: 2026-11-12 — Sucursales nuevas y editor semana a semana

## 📝 Resumen de la Sesión
Se cerraron dos ramas pendientes. El editor de rutas semana a semana ([[decisiones/ADR-019-Editor-Semana-A-Semana|ADR-019]]) se commiteó, se unió a `master` y se publicó. Sucursales nuevas desde la app ([[decisiones/ADR-014-Sucursales-Propuestas|ADR-014]]), parada desde el 15-oct, se unió con `master`, se aplicó su migración y salió en hub y OTA.

## 🛠️ Cambios Realizados
- **Editor semana a semana**: commit `4015130` (rescata ADR-018, ADR-019 y logs 11-04 a 11-08 que solo vivían sin commitear). Publicado con `355b2dc`.
- **Sucursales nuevas, merge con `master`** (`d78ed39`): la sincronización de `store_proposals` pasa al motor nuevo (fase de fotos con presupuesto, reintentos `photo_next_try` y filtro por dueño). `store_proposals` local suma `photo_attempts`, `photo_next_try` y `photos_done` (también por migración local, por si algún teléfono tiene la 1.4.0 vieja de esta rama). Perfil nuevo con la fila "Sucursales nuevas". `CLAUDE.md`/`AGENTS.md` quedan como en `master`.
- `d134302`: la búsqueda de duplicados cercanos ignora sucursales sin GPS ([[decisiones/ADR-016-Sucursales-Sin-GPS|ADR-016]]).
- `cb72052` y `457ea77`: en el check-in, **Capturar GPS** pasa de enlace debajo de las coordenadas a botón píldora a su derecha, y su confirmación usa el diálogo de la app (`ConfirmDialog`, sacado de `ConfirmEndRouteDialog`). Rojo si reemplaza un GPS existente, azul si no.
- **Base (producción)**: migración `2026-10-14-sucursales-nuevas.sql` aplicada con OK de Sebastián. FK `store_proposals_user_id_fkey` OK. 7/7 verificaciones de `tools/check_store_proposals.sql` con rollback; sin datos de prueba.
- **Publicado**: hub en Vercel (`457ea77`, READY). OTA canal `preview`, runtime 1.4.0, Android update ID `01a1d166-b071-7ba6-b4a7-a204088a702e` (grupo `60bb7d41-b0a7-46e4-aa05-0c9b96c5b232`).
- **Verificación**: móvil 295/295 y `tsc` limpio; hub 221/221, `tsc` y lint limpios.
- **Ramas borradas**: `feat/rutas-semana-a-semana` y `feat/sucursales-nuevas`, con sus worktrees.

> [!NOTE]
> El concurso de puntos de venta (spec del 11-nov, `docs/superpowers/specs/2026-11-11-concurso-puntos-de-venta-design.md`) es otra cosa: página web para participantes, arranca el 15-nov. Al 12-nov no hay código.

## 🚀 Próximos Pasos
- [ ] Ver en un teléfono el botón y el aviso de Capturar GPS, y registrar una sucursal de prueba.
- [ ] Avisar a los mercaderistas del botón "Registrar sucursal nueva" y a Diego de la bandeja.
- [ ] Concurso de puntos de venta: confirmar si sigue para el 15-nov.

## 🔗 Enlaces Relacionados
- [[pendientes/Pendientes|Pendientes]]
- [[logs/Session Logs|Session Logs]]
