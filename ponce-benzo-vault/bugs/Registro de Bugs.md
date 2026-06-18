---
title: Registro de Bugs
date: 2026-05-22
tags:
  - bugs
  - errores
  - indice
---

# Registro de Bugs — Ponzivenzo Smart Tracker

Este documento centraliza el control de errores, fallos técnicos y bugs significativos que han sido detectados y solucionados durante el desarrollo del proyecto. El propósito es documentar las causas raíz y soluciones para evitar la reintroducción de fallos similares en futuras iteraciones.

## 🐛 Historial de Bugs Solucionados

| ID | Fecha | Bug / Descripción | Causa Raíz | Solución |
| :--- | :--- | :--- | :--- | :--- |
| `BUG-008` | 2026-06-18 | En la página de **Tareas** del hub el título mostraba guion bajo ("Anomalía: sin_stock") y debajo salía el **UUID** de la tienda en vez de info útil. | El render usaba `task.title` crudo y `task.store_id` (UUID). No se traía el nombre de tienda ni del creador. | `fetchFullTasks` ahora embebe `stores(name)` y `creator:users!tasks_created_by_user_id_fkey(full_name)`; la UI muestra "tienda · mercaderista" y aplica `.replace(/_/g," ")` al título. |
| `BUG-007` | 2026-06-18 | Las **fotos de los reportes salían rotas** en el hub (ícono roto + alt "Foto 1"). | `visits.photo_urls` guarda **rutas de storage** (no URLs) y el bucket `visit-photos` es **privado**; el `<img src>` recibía una ruta relativa inválida. | En `fetchStoreReports` firmar las rutas con `supabase.storage.from('visit-photos').createSignedUrls(paths, 3600)`. Requiere sesión del supervisor del mercaderista (policy `visit_photos_select_own_or_supervisor`). |
| `BUG-006` | 2026-06-18 | En el panel de supervisor, el **detalle de tienda nunca mostraba reportes** (pestaña "Reportes" siempre "Sin reportes"), aunque hubiera visitas en la BD. | En `tiendas/[storeId]/page.tsx` el arreglo `reports` estaba **hardcodeado a `[]`** y no existía query de reportes en `app/lib/queries/`. El `ActivityFeed` recibía siempre vacío. | Crear `fetchStoreReports(storeId)` (`hub/app/lib/queries/reports.ts`): trae las `visits` de la tienda con embed a `users`/`stores`, calcula `location_verified` por haversine vs. coords maestras, y mapea a `SupervisorReport`. Cablear con `useSupabaseQuery(() => fetchStoreReports(storeId))`. |
| `BUG-005` | 2026-06-18 | Los **reportes de competencia nunca llegaban a Supabase** (`competition_reports` = 0) aunque se llenaran en el móvil. Fallo silencioso. | El `CompetitionPanel` poblaba el selector de marcas desde `mockCompetitorBrands` con ids tipo `'brand-001'`, que **no son UUID** y no existen en `competitor_brands`. La columna `competition_reports.brand_id` es `uuid` con **FK** → el upsert fallaba en el cast/FK y el error solo se logueaba (`console.warn` en `syncClient`). | Sembrar marcas reales en `competitor_brands` (UUID fijos), alinear `mockCompetitorBrands` a esos UUID (respaldo offline válido) y agregar `fetchCompetitorBrands()` para que el panel traiga las marcas reales. |
| `BUG-004` | 2026-06-18 | Al reabrir la app, **"Empezar Ruta" reaparecía** aunque hubiera una jornada en curso, permitiendo **sesiones duplicadas** (varios `session_end` NULL). | `RouteContext` guardaba el estado de sesión solo en memoria (`useState`/`useRef`); el `useEffect` de montaje solo cargaba la ruta, **nunca rehidrataba la sesión abierta** desde SQLite. | Agregar `getOpenSession(db, userId)` + helper puro `pickResumableSession` (con test) y un `useEffect` que al montar reanuda la sesión abierta (restaura `sessionId`/`sessionActive` y reanuda el GPS vía `beginTracking()` extraído de `startSession`). |
| `BUG-003` | 2026-06-09 | Las rutas ingestadas estaban **infladas y con tiendas duplicadas** (ej. Elvis martes: 32 paradas, varias repetidas, en vez de 8). Detectado en el APK durante el primer login real. | Cada hoja del Excel `RUTAS` apila **varios bloques de rutas** verticalmente (Elvis: Ruta 1-5 + 6-10, repetidos; otros: Ruta 1-5 ×4). El parser asumía **un solo bloque** y leía la columna de corrido hasta el fin de la hoja, **concatenando todos los bloques** en una sola ruta. | Reescribir `parseRutas` para detectar bloques por encabezado `Ruta N`, tomar el **primer bloque como autoritativo** (los demás son copias), **dedup dentro de cada ruta**, y fechar con `dateForRuta` (Ruta 1-5 = semana actual, 6-10 = siguiente). Re-ingesta: Elvis 10 rutas, demás 5; 7-13 paradas reales c/u; 190 tiendas. Ver [[arquitectura/Ingesta - Mapeo de Datos\|Mapeo de Datos]]. |
| `BUG-002` | 2026-06-02 | `recordVisit` (móvil) escribía siempre `anomaly_type`/`skip_reason`/`last_restock_date` como `null` al insertar la visita, descartando los datos del formulario y rompiendo la invariante anomalía→tarea de ADR-002. | El `insertVisit` tenía esos tres campos hardcodeados a `null` (placeholder del scaffolding inicial). | Pasar los valores reales del `VisitRecord` en el mismo INSERT: `anomaly_type` cuando `status='anomaly'`, `skip_reason` cuando `'skipped'`, y `last_restock_date` siempre. Ver [[logs/Log-2026-06-02-bloque-mobile\|Log Bloque Mobile]]. |
| `BUG-001` | 2026-05-22 | Error `UnicodeEncodeError` en script de verificación de Supabase en Windows. | Uso de emojis de alta densidad (`❌`, `✅`, `⚠️`) en la consola `cmd` / `powershell` que no soporta utf-8 por defecto. | Reemplazar emojis unicode por etiquetas ASCII descriptivas (ej: `[OK]`, `[ERROR]`, `[WARN]`). |

---

## 🛠️ Cómo registrar un nuevo Bug
1. Si descubres o corriges un bug crítico o recurrente, documenta su solución.
2. Agrega una nueva fila al inicio de la tabla en esta página.
3. Si el bug requiere una explicación compleja, crea una nota individual en esta carpeta con el nombre `Bug-Nombre-Bug.md` utilizando la plantilla [[templates/Template - Bug|Template - Bug]] y enlázala en la tabla.
