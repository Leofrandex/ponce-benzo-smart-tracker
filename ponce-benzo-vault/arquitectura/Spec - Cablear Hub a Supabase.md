---
title: "Spec — Cablear Hub a Supabase (Fundación + Lectura)"
date: 2026-06-08
tags:
  - arquitectura
  - spec
  - supabase
  - hub
  - auth
---

# Spec — Cablear Hub a Supabase (Fundación + Lectura)

> [!SUCCESS]
> **Estado:** ✅ **Implementado (fase lectura)** el 2026-06-08. 10 tareas subagent-driven; `tsc`/`lint`/`build` limpios; auth y RLS verificados E2E vía JWT real. Ver [[logs/Log-2026-06-08-hub|Log-2026-06-08 (Hub)]]. La escritura (CRUD) queda para el siguiente sub-proyecto.
> **Contexto:** Sub-proyecto 3 de la migración a Supabase. La BD `poncebenzo` ya tiene schema v2.0 + RLS y datos del piloto (6 usuarios, 192 tiendas, 20 rutas). El hub (`hub/`, Next.js App Router) sigue 100% mock: login demo por `localStorage`, páginas client component que importan `mock-data` directo. Este sub-proyecto reemplaza la **fundación** (cliente Supabase + auth real + protección de rutas) y la **lectura** de las 5 superficies. **Toda escritura queda fuera** (sub-proyecto siguiente).

---

## Objetivo

Que un supervisor entre al hub con su **cuenta real de Supabase Auth** y vea **datos reales** (tiendas, rutas, tareas, contactos, mapa) filtrados por **RLS**, reemplazando el mock-data en modo solo lectura. Dejar el cableado de fundación (clientes, sesión, middleware, capa de datos) listo para que el CRM de escritura se monte encima después.

## Decisiones tomadas durante el diseño

| Decisión | Resolución |
|---|---|
| Alcance | **Fundación + solo lectura**. La escritura (CRUD contactos/sucursales/engagements, resolver tareas) es un sub-proyecto aparte. |
| Sesión/Auth | **`@supabase/ssr`** + cookies httpOnly + **middleware** que refresca sesión y protege `/supervisor/*`. Las páginas siguen siendo client components. |
| Capa de datos | **Módulo de queries** (`app/lib/queries/*.ts`) + **hook propio** (`useSupabaseQuery`) con `{ data, loading, error }`. Sin dependencias nuevas de data-fetching. |
| KPIs / agregados | **Cliente-side** (agregar en JS dentro de la capa de queries). Sin vistas/RPC nuevas por ahora. |
| Mapa "En vivo" | El hub lee **el último ping por sesión abierta**, refrescado por **polling cada 30s**. Sin Realtime. Los pings se **insertan** (no se sobreescriben) para conservar el histórico. |
| Tipos TS | **Reutilizar `app/lib/types.ts`** (ya alineado a v2.0). No se generan tipos desde Supabase. |

## Arquitectura

Tres capas nuevas, sin tocar el diseño visual existente:

1. **Clientes Supabase** (`@supabase/ssr`): `browserClient` (componentes cliente) + cliente de servidor para el middleware. Anon key desde `hub/.env.local`. Sesión en cookies httpOnly.
2. **Middleware** (`hub/middleware.ts`): refresca la sesión en cada request y protege `/supervisor/*` (sin sesión válida → redirige a `/`).
3. **Capa de datos** (`app/lib/queries/*.ts` + `app/lib/hooks/useSupabaseQuery.ts`): funciones tipadas por superficie + hook de estados. Las páginas cambian su fuente: `mock-data` → hooks.

## Archivos

### Nuevos
- `app/lib/supabase/client.ts` — `createBrowserClient` (anon key).
- `app/lib/supabase/server.ts` — cliente para el middleware (manejo de cookies de request/response).
- `hub/middleware.ts` — refresh de sesión + guard de rutas `/supervisor/*`.
- `app/lib/hooks/useSupabaseQuery.ts` — hook genérico `{ data, loading, error, refetch }`.
- `app/lib/queries/stores.ts` — tiendas + filtros; lista con derivados (última visita, estado, tareas pendientes) agregados en JS.
- `app/lib/queries/routes.ts` — rutas del día/usuario.
- `app/lib/queries/tasks.ts` — tareas (lectura) por asignado/supervisor.
- `app/lib/queries/contacts.ts` — contactos + engagements de una tienda (lectura).
- `app/lib/queries/sessions.ts` — sesiones abiertas + último ping por sesión (mapa en vivo) e histórico de pings.
- `app/lib/queries/dashboard.ts` — agregados del dashboard (anomalías por cliente, tiendas por mercaderista, progreso de tareas).

### Modificados
- `app/lib/auth-context.tsx` — reemplazar el demo por Supabase Auth real: `signInWithPassword`, `onAuthStateChange`, `signOut`; `profile` cargado de la tabla `users` (rol, supervisor_id).
- `app/page.tsx` — formulario de login real (email + password) contra Auth, con manejo de error de credenciales.
- `app/(supervisor)/supervisor/clientes/page.tsx` — lista desde `queries/stores`.
- `app/(supervisor)/supervisor/clientes/[storeId]/page.tsx` — ficha desde `queries/stores` + `queries/contacts` + `queries/tasks` (lectura).
- `app/(supervisor)/supervisor/mapa/page.tsx` — sucursales + sesiones/pings desde `queries/sessions` con polling 30s.
- `app/(supervisor)/supervisor/tareas/page.tsx` — tareas desde `queries/tasks` (lectura; el botón "Marcar como completada" queda **deshabilitado** con nota de "próximamente" hasta el sub-proyecto de escritura).
- `app/(supervisor)/supervisor/page.tsx` — dashboard desde `queries/dashboard`.

### Se conservan
- `app/lib/types.ts` — reutilizado tal cual.
- `app/lib/mock-data.ts` — se mantiene por ahora para las partes aún no cableadas / placeholders; se irá vaciando. No se borra en este sub-proyecto.

## Flujo de datos y RLS

- Login con correo real → Supabase Auth setea cookie → middleware la valida en cada request.
- Cada query usa el `browserClient` autenticado; **el RLS hace el filtrado** (no se filtra por usuario en el cliente). Rosli (admin) ve todo; Milagros (supervisor) ve su equipo; cada mercaderista lo suyo — ya validado en BD.
- `profile` se obtiene de `users` para que el UI sepa rol y jerarquía.
- KPIs/derivados: las queries traen filas crudas y agregan en JS.
- Mapa "En vivo": sesiones con `session_end IS NULL` + último ping por sesión, polling 30s.

## Manejo de carga / error / vacío

- Cada hook expone `loading` (spinner/skeleton), `error` (mensaje + retry vía `refetch`), `data`.
- **Estados vacíos esperados:** aún no hay visitas/tareas/sesiones reales → pantallas con vacíos legibles ("Sin visitas registradas", mapa sin marcadores de mercaderista). Las 192 tiendas y 20 rutas sí aparecen.

## Criterios de aceptación

1. `tsc` + `lint` + `build` del hub limpios.
2. Login real: una cuenta ingestada (ej. `mfernandez@ponce-benzo.com`) entra y es redirigida a `/supervisor`; credenciales inválidas muestran error; logout limpia la sesión.
3. Middleware: acceder a `/supervisor/*` sin sesión redirige a `/`.
4. Las 192 tiendas reales aparecen en Clientes (con sus filtros de zona/canal/clasificación operando sobre datos reales) y las 20 rutas en su superficie.
5. RLS desde el UI: con la sesión de Milagros se ven solo sus vendedores/datos; con Rosli se ve todo. (Mercaderista opcional.)
6. El mapa carga sucursales reales por coordenadas; "En vivo" hace polling 30s y muestra vacío de mercaderistas (sin datos aún) sin romperse.
7. No hay regresión visual: el diseño/estilos de las pantallas se mantienen.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `@supabase/ssr` mal configurado rompe la sesión en App Router | Seguir el patrón oficial de Supabase para Next.js (browser client + middleware con manejo correcto de cookies). Probar login/refresh/logout E2E (criterio 2-3). |
| Las páginas client component no pueden leer cookies httpOnly directamente | No las necesitan: el `browserClient` adjunta la sesión automáticamente; el RLS filtra del lado servidor de Supabase. |
| Agregación cliente-side se vuelve N+1 (ej. última visita por 192 tiendas) | Traer las visitas en una sola query y agregar en memoria; si pesa, migrar esa agregación puntual a una vista (fuera de alcance, anotado). |
| Estados vacíos se ven como "error" | Diseñar vacíos explícitos y diferenciados del estado de error. |

## Fuera de alcance (sub-proyectos siguientes)

- **Toda escritura**: CRUD de contactos, sucursales, engagements; resolver tareas; crear tareas manuales.
- Supabase Realtime para el mapa.
- Vistas/RPC de agregados (si el volumen lo exige).
- Cableado del mobile (login real, carga de rutas, motor de sync, subida de fotos) — sub-proyecto 4.
- Enriquecimiento de datos de sucursales (depende de P&B).

## Enlaces Relacionados
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — tablas y RLS que el hub consume.
- [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]] — schema v2.0.
- [[arquitectura/Ingesta - Mapeo de Datos|Mapeo de Datos]] — origen de los datos que se mostrarán.
- [[pendientes/Pendientes|Pendientes]] — pendientes de escritura del CRM que dependen de esta fundación.
