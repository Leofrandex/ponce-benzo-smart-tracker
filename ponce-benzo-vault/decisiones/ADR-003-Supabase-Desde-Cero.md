---
title: "ADR-003: Recrear el proyecto Supabase desde cero con Schema v2.0 consolidado"
date: 2026-06-07
status: aceptado
tags:
  - adr
  - decisiones
  - supabase
  - schema
---

# ADR-003: Recrear el proyecto Supabase desde cero con Schema v2.0 consolidado

* **Estado**: `aceptado`
* **Fecha**: 2026-06-07
* **Autores**: Agente de IA & Usuario

---

## Contexto
El UI de hub y mobile se completó y validó mock-first (sesiones 2026-06-02 y 2026-06-06), divergiendo del schema Supabase v1.0: `tasks` usaba `pending/in_progress/done` mientras el UI maneja `open/resolved`; la competencia quedó ligada al check-in sin columna `visit_id`; `location_pings` existía en SQLite pero no en Supabase; y el archivo `tools/supabase_schema.sql` acumulaba capas de `ALTER` históricas (ADR-002). El proyecto Supabase de Fase 2 quedó descartado por el usuario.

## Decisión
1. **Crear el proyecto Supabase desde cero** (`poncebenzo`, ref `eknfqxetigmrteouaqnv`, us-east-1) en lugar de migrar el existente.
2. **Reescribir `tools/supabase_schema.sql` como v2.0 consolidado**: una sola capa idempotente con todas las columnas inline, que hace match 1:1 con el UI. Incluye `location_pings`, `tasks` con `description` y `open/resolved`, `competition_reports.visit_id`, garantía de encargado único, RLS completa y Storage (`visit-photos`) con políticas por carpeta de usuario.
3. **Hardening de seguridad** (derivado del code review): trigger anomalía→tarea como `SECURITY DEFINER`; los clientes no pueden INSERTar en `tasks` (solo el trigger); supervisor con solo-lectura sobre reportes de competencia ajenos; `REVOKE EXECUTE` de funciones internas para `anon`/`authenticated`.
4. **`priority` eliminado del producto**: la tabla `tasks` no la tiene y el UI del hub dejó de mostrarla; el detalle vive en `description` (el trigger copia las observaciones del check-in).

## Consecuencias
### Positivas 👍
- Schema sin deuda histórica: un archivo legible, idempotente y re-aplicable que es la fuente de verdad.
- Sin migración de datos: la BD nace en su forma final (no había datos productivos).
- Los tres mundos (Supabase, SQLite local, tipos TS del hub) quedan alineados antes de cablear, eliminando retrabajo.
- RLS endurecida desde el día cero, validada con advisors de Supabase.

### Negativas / Riesgos 👎
- Credenciales nuevas: cualquier referencia al proyecto anterior queda inválida (mitigado: no había consumidores reales).
- Residuales del linter no accionables: `spatial_ref_sys` (PostGIS) sin RLS y extensión `postgis` en `public` — aceptados y documentados.
- `routes.store_ids UUID[]` sigue sin FK real por elemento (diseño v1.0 conservado); revisar si la integridad se vuelve problema en la ingesta.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[arquitectura/Spec - Supabase Schema v2|Spec — Supabase Schema v2.0]]
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]]
- [[logs/Log-2026-06-07|Log-2026-06-07]]
