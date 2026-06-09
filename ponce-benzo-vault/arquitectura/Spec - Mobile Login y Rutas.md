---
title: "Spec — Mobile: Login + Rutas reales"
date: 2026-06-08
tags:
  - arquitectura
  - spec
  - supabase
  - mobile
  - auth
---

# Spec — Mobile: Login + Rutas reales (sin sync/fotos/GPS)

> [!NOTE]
> **Estado:** Aprobado en diseño (pendiente revisión final del spec).
> **Contexto:** Sub-proyecto 5 de la migración. Primer corte del cableado de la app móvil (React Native Expo) a Supabase: cliente Supabase + **login real** + **carga de la ruta del día desde Supabase**. El motor de sincronización offline, la subida de fotos a Storage y el envío de GPS quedan para el sub-proyecto siguiente. La BD `poncebenzo` ya tiene los 6 usuarios, 192 tiendas y 20 rutas; el hub ya consume y escribe datos reales.

---

## Objetivo

Que un mercaderista entre a la app con su **cuenta real de Supabase Auth** (sesión persistida en el dispositivo) y vea su **ruta del día con tiendas reales** cargadas desde Supabase, reemplazando las credenciales demo y el mock de rutas. Todo el resto del flujo (jornada, GPS, check-in a SQLite, sync) permanece local/mock sin cambios.

## Decisiones tomadas durante el diseño

| Decisión | Resolución |
|---|---|
| Alcance | **Solo login + carga de rutas/tiendas**. Sync, fotos, GPS-30s, cacheo offline y competencia real quedan fuera (sub-proyecto siguiente). |
| Persistencia de sesión | **AsyncStorage** (patrón oficial Supabase + Expo; ya instalado). Sesión persistida → auto-login al reabrir. |
| Ruta a cargar | **Ruta de hoy** (`route_date = hoy`); si no hay, **fallback a la más reciente** del usuario. Se muestra la fecha de la ruta cargada. |
| Sin red | **Requiere red** para login y carga; si falla → pantalla de error + "Reintentar". Cacheo offline = sub-proyecto de sync. |
| Límite read/write | Solo el **origen de rutas/tiendas** pasa a Supabase. Sesión/visita/GPS/sync/competencia siguen en SQLite/mock. |

## Arquitectura

Tres cambios, sin tocar el flujo de check-in/GPS/sync (que sigue local):

1. **Cliente Supabase** (`mobile/src/services/supabase.ts`): `@supabase/supabase-js` + `react-native-url-polyfill` (a instalar) + `storage: AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. Anon key/URL desde la config de Expo (`expo-constants` / `app.json` `extra`).
2. **AuthContext real**: reemplaza `DEMO_CREDENTIALS`/`mockMerchandisers` por `signInWithPassword`; al iniciar, restaura la sesión persistida y carga el perfil de la tabla `users`; `onAuthStateChange` para reflejar login/logout; `signOut` real.
3. **RouteContext carga rutas de Supabase**: reemplaza `getMockRouteItems` (síncrono) por una carga **async** — `fetchTodayRoute(userId)` → `store_ids` → `fetchStoresByIds` → `RouteStoreItem[]`. Estados `loading`/`error` + `reloadRoute()` para reintentar. El resto del provider (sesión/visita/GPS/sync) queda igual.

## Archivos

### Nuevos
- `mobile/src/services/supabase.ts` — cliente Supabase (AsyncStorage, autoRefresh, persistSession).
- `mobile/src/services/routesApi.ts` — `fetchTodayRoute(userId)` (con fallback a la ruta más reciente) y `fetchStoresByIds(ids)`; mapeo de filas de Supabase al tipo `Store` del mobile.

### Modificados
- `mobile/src/context/AuthContext.tsx` — auth real (signInWithPassword, sesión persistida, perfil de `users`, onAuthStateChange).
- `mobile/src/context/RouteContext.tsx` — carga la ruta real con estados loading/error/reload; conserva intacta la lógica de sesión/visita/GPS/sync.
- `mobile/src/screens/LoginScreen.tsx` — usa el `signIn` real (la pantalla y el form ya existen; solo cambia el back-end del submit y el manejo de error).
- `mobile/src/screens/RouteScreen.tsx` — manejar loading/empty ("Sin ruta asignada")/error (+Reintentar) de la ruta; mostrar la fecha de la ruta cargada.
- `mobile/src/screens/ProfileScreen.tsx` — mostrar el usuario real (nombre/correo/rol del perfil).
- `mobile/app.json` (o `app.config.*`) — exponer `SUPABASE_URL` y `SUPABASE_ANON_KEY` vía `expo.extra`, leídos con `expo-constants`.

### Sin cambios (límite del sub-proyecto)
- `RouteContext` (sesión/visita/GPS/sync), `CheckInScreen`, `CompetitionPanel`, `SyncBanner`, `db.ts`, `locationTask.ts`, `competitor_brands` (mock). Las rutas especiales / agregar tienda siguen manipulando estado local.

## Flujo de datos

1. Login con correo real → `signInWithPassword` → token persistido en AsyncStorage.
2. Al abrir la app, la sesión se restaura; se carga el perfil de `users` (id, full_name, role).
3. `fetchTodayRoute(userId)`: `routes` del usuario con `route_date = hoy`; si vacío, la de `route_date` más reciente. Devuelve `{ route, isFallback }`.
4. `fetchStoresByIds(route.store_ids)` → tiendas reales → se arman los `RouteStoreItem`.
5. El RLS garantiza que el mercaderista solo lee sus rutas/tiendas (las tiendas son lectura global autenticada; las rutas son propias).

## Manejo de carga / error / vacío

- **Cargando:** spinner/placeholder en la pantalla de ruta.
- **Sin ruta:** mensaje "No tenés ruta asignada" (cuando ni hoy ni fallback devuelven nada).
- **Error de red:** mensaje + botón "Reintentar" que vuelve a llamar `reloadRoute()`.
- **Fecha visible:** se muestra la `route_date` cargada (para distinguir hoy de un fallback).

## Criterios de aceptación

1. `npx tsc --noEmit` del mobile sin errores.
2. **Auth real:** un mercaderista (`czurita@`) entra con su contraseña; la sesión persiste tras cerrar/reabrir la app (no re-login); `signOut` limpia la sesión.
3. **Ruta real:** tras login se carga la ruta del día (o fallback) con **tiendas reales** de Supabase; se muestra la fecha de la ruta.
4. **RLS:** `fetchTodayRoute` de un usuario solo devuelve sus propias rutas (verificado vía JWT real).
5. **Errores:** sin red, la pantalla de ruta muestra error + "Reintentar" sin crashear; sin ruta, muestra el vacío legible.
6. **Sin regresión:** el flujo local (empezar jornada, GPS, check-in a SQLite, competencia, banner de sync) sigue funcionando igual que antes sobre la ruta ahora real.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `supabase-js` no funciona en RN sin polyfills | Instalar `react-native-url-polyfill` e importar `'react-native-url-polyfill/auto'` en el entrypoint; usar AsyncStorage como `storage`. Patrón oficial documentado. |
| La carga async de ruta rompe el render síncrono actual de `RouteContext` | Introducir estados `loading`/`error` y que `RouteScreen` los maneje; no asumir `routeItems` poblado al primer render. |
| El tipo `Store` del mobile difiere del de Supabase | `fetchStoresByIds` mapea explícitamente las columnas reales al tipo `Store` del mobile; campos ausentes → null/default. |
| Credenciales embebidas en el bundle | Solo la **anon key** (pública por diseño, protegida por RLS) va en `expo.extra`; nunca la service role. |
| Reloj del dispositivo mal → "hoy" incorrecto | El fallback a la ruta más reciente mitiga el caso; aceptable para el piloto. |

## Fuera de alcance (sub-proyecto siguiente)

- Motor de sincronización offline (cola SQLite → Supabase: visits, location_pings, competition_reports).
- Subida de fotos a Storage (`visit-photos/`).
- Envío de `location_pings` cada 30s.
- Cacheo offline de rutas/tiendas.
- Competencia real (`competitor_brands` desde Supabase) y `SyncBanner` con datos reales.

## Enlaces Relacionados
- [[arquitectura/Spec - Cablear Hub a Supabase|Spec — Hub Lectura]] — patrón de auth/queries reutilizado.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — tablas `routes`/`stores`/`users` y RLS.
- [[arquitectura/Ingesta - Mapeo de Datos|Mapeo de Datos]] — origen de las rutas que se cargarán.
- [[roadmap/Roadmap|Roadmap]] — el motor de sync es el siguiente hito.
