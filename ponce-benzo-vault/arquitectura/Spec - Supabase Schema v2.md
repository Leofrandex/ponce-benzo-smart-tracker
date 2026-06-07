---
title: "Spec — Supabase desde cero: Schema v2.0 alineado con el UI"
date: 2026-06-07
tags:
  - arquitectura
  - spec
  - supabase
  - schema
---

# Spec — Supabase desde cero: Schema v2.0 alineado con el UI

> [!NOTE]
> **Estado:** ✅ **Implementado** (2026-06-07) — schema aplicado al proyecto `poncebenzo` (`eknfqxetigmrteouaqnv`), 6/6 criterios de aceptación verificados. Ver [[logs/Log-2026-06-07|Log-2026-06-07]] y [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]]. Ajustes post-review incorporados: trigger `SECURITY DEFINER`, clientes sin INSERT en `tasks`, índices GiST, supervisor solo-lectura en competencia, `REVOKE EXECUTE` de funciones internas.
> **Contexto:** Sub-proyecto 1 de la migración a Supabase ("Fundación"). El UI de hub y mobile está completo y validado sobre mock-data/SQLite; el proyecto Supabase anterior se descarta y se crea **desde cero**. Este spec define el schema consolidado que hace match 1:1 con lo que el UI ya renderiza.

---

## Objetivo

Crear un proyecto Supabase nuevo con un schema v2.0 **limpio y consolidado** (sin capas de `ALTER` históricas) que refleje fielmente el estado del UI a 2026-06-06, dejando hub, mobile (SQLite) y Supabase alineados a nivel de tipos y políticas. La ingesta de datos (Excel + usuarios Auth) es el sub-proyecto siguiente y queda **fuera de este spec**.

## Decisiones tomadas durante el diseño

| Decisión | Resolución |
|---|---|
| ¿Tareas con `priority`? | **No.** Solo se agrega `description`. `priority` se elimina del UI mock del hub. |
| ¿`description` en `tasks`? | **Sí.** El trigger de anomalías copia `visits.observations`; las tareas manuales futuras la usan como detalle libre. |
| ¿Check-out / `duration_minutes`? | **Fuera.** El mobile no captura salida de tienda. `duration_minutes` queda como mock-only a extinguir al cablear. |
| ¿Proyecto Supabase? | **Desde cero.** Sin migración de datos; el schema nace directo en su forma final. |
| Coordenadas GPS de tiendas | Provisionales (centro de Caracas) en la ingesta futura; el schema no cambia por esto. |

## Alcance

### 1. Proyecto Supabase nuevo
- Crear proyecto (dashboard del usuario o MCP de Supabase con confirmación de costo).
- Extensiones: `postgis`, `uuid-ossp`.
- Bucket de Storage **`visit-photos`** (privado) con políticas:
  - INSERT: usuario autenticado solo bajo su carpeta `{auth.uid()}/...` (estructura `{user_id}/{visit_id}/{timestamp}.jpg` según [[resumen/Constitucion|Constitución]]).
  - SELECT: el dueño y el supervisor del dueño.

### 2. Schema v2.0 — `tools/supabase_schema.sql` reescrito

Reescritura completa del archivo (idempotente, una sola capa, sin secciones `ALTER` históricas). Tablas y cambios respecto a v1.0:

**Sin cambios estructurales** (se consolidan inline las columnas que v1.0 agregaba por `ALTER`):
- `stores` (con segmentación CRM: `estado`, `municipio`, `urbanizacion`, `business_channel`, `classification`)
- `users` (con `supervisor_id`)
- `routes` (con `is_special`)
- `sessions`
- `visits` (con `anomaly_type`, `skip_reason`, `last_restock_date`)
- `contact_engagements`
- `competitor_brands` (+ seed `Genérico / Sin marca`)

**Cambios y novedades:**

| Tabla | Cambio |
|---|---|
| `location_pings` | **Tabla nueva** (gap conocido del vault). `ping_id UUID PK`, `session_id → sessions`, `user_id → users`, `timestamp TIMESTAMPTZ`, `lat`/`lng DOUBLE PRECISION`, columna `location GEOGRAPHY(POINT,4326)` generada (PostGIS, mapa de calor histórico). Índices: `(session_id)`, `(user_id, timestamp)`. |
| `tasks` | `description TEXT` nueva. `status` nace con `CHECK (status IN ('open','resolved'))`, default `'open'`. Sin `priority`. |
| `tasks` (trigger) | `fn_create_task_from_anomaly` inserta `status = 'open'` y copia `NEW.observations` a `description`. |
| `competition_reports` | Columna nueva `visit_id UUID REFERENCES visits(visit_id) ON DELETE SET NULL` — la competencia se reporta ligada al check-in (UI 2026-06-06). Índice `(visit_id)`. |
| `contacts` | Índice único parcial: `CREATE UNIQUE INDEX ... ON contacts(store_id) WHERE is_primary AND active` — garantiza encargado único por tienda a nivel BD. |

### 3. RLS v2.0

Se conservan las políticas v1.0 (propiedad por `auth.uid()` + visibilidad de supervisor sobre sus vendedores) y se agregan/endurecen:

| Tabla | Política |
|---|---|
| `stores` | Nueva política de escritura `INSERT`/`UPDATE` para roles `supervisor`/`admin` (habilita el CRUD de sucursales del hub). **Sin DELETE**: el UI desactiva (`active = false`). |
| `sessions` | Lectura de supervisor sobre sesiones de sus vendedores (mapa en vivo). |
| `location_pings` | El dueño inserta/lee lo suyo; supervisor lee los pings de sus vendedores. |
| `tasks` | Reemplazar `WITH CHECK (true)` por chequeo real: solo asignado, creador, o supervisor del creador pueden escribir. |

### 4. Tipos del hub — `hub/app/lib/types.ts` (+ mock-data + página de tareas)

- `Task.status` → `"open" | "resolved"`; agregar `Task.description: string | null`.
- `CompetitionReport.visit_id: string | null`.
- **Eliminar `TaskPriority` y `SupervisorTask.priority`**; quitar `priority` de `mock-data.ts` y los chips/filtros de prioridad del render de `app/(supervisor)/supervisor/tareas/page.tsx`. La tarjeta queda: título + descripción + tienda + mercaderista + fecha + estado (abierta/completada).
- Marcar `SupervisorReport.duration_minutes` y `location_verified` con comentario `// mock-only — sin respaldo en BD, a extinguir al cablear`.

### 5. SQLite mobile — `mobile/src/services/db.ts`

Migraciones idempotentes de columna (patrón existente del archivo):
- `competition_reports.visit_id TEXT` (vínculo local al check-in).
- `location_pings.user_id TEXT` — hoy el ping local no registra quién lo emitió; guardarlo directo evita inferirlo de la sesión al sincronizar. `insertLocationPingSync` recibe y persiste el `user_id`.

### 6. Verificación

- `tools/verify_supabase_connection.py` corre con las credenciales nuevas y confirma handshake.
- El schema aplicado en remoto se valida con los advisors de Supabase (seguridad/perf) — 0 errores de RLS faltante.
- `tsc` sin errores en hub y mobile; lint limpio; build del hub exitoso.

## Fuera de alcance (sub-proyectos siguientes)

- Ingesta de Excel (`MAESTRO.xlsx`, `RUTAS`) y creación de usuarios Auth con contraseña temporal — siguiente sub-proyecto ("Ingesta"), ya pre-diseñado: pipeline idempotente en `tools/import-data.ts` + `tools/vendedores.json` con el mapeo nombre→correo real.
- Cablear hub y mobile a Supabase (consumo real de datos).
- Normalización de zonas geográficas (`estado`/`municipio`/`urbanizacion`) a tablas lookup — pendiente "a futuro" del vault.
- Vistas/RPCs de agregados para el hub (`StoreKPIs`, `ContactListItem`) — se diseñan al cablear el hub.
- Compresión de imágenes en mobile.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El schema v2.0 reescrito pierde algo que v1.0 sí tenía | El archivo nuevo se construye por consolidación línea a línea del v1.0 + diff aprobado; revisión cruzada contra `types.ts` y `db.ts` antes de aplicar. |
| Las políticas de Storage por carpeta fallan con rutas mal formadas desde mobile | El path se valida en la política (`storage.foldername(name)[1] = auth.uid()::text`) y el sync del mobile construye la ruta desde el `user_id` de la sesión Auth. |
| `WITH CHECK` endurecido de `tasks` bloquea el trigger | El trigger inserta con `created_by_user_id = NEW.user_id`, que es el `auth.uid()` del mercaderista que registra la visita → pasa el chequeo "creador". Se valida con un INSERT de visita anómala como usuario autenticado en la verificación (criterio 3). |

## Criterios de aceptación

1. Proyecto Supabase nuevo creado, con extensiones y bucket `visit-photos` configurados.
2. `tools/supabase_schema.sql` v2.0 aplicado en remoto sin errores y re-ejecutable (idempotente).
3. Un INSERT de visita con `status='anomaly'` + `observations` genera una tarea `open` con `description` poblada.
4. Hub: `tsc` + lint + build OK con los tipos nuevos y sin rastro de `priority`.
5. Mobile: `tsc` OK; SQLite migra en frío sin romper datos locales existentes.
6. `verify_supabase_connection.py` responde OK contra el proyecto nuevo.

## Enlaces Relacionados

- [[resumen/Constitucion|Constitución]] — invariantes que el schema debe respetar.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — nota a actualizar cuando v2.0 se aplique.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo CRM]] — base del schema que aquí se consolida.
- [[pendientes/Pendientes|Pendientes]] — gaps que este spec resuelve (`location_pings`, CHECK de `tasks`, encargado único, RLS).
