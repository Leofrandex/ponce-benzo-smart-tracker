---
title: "Sesión: Log-2026-06-08 (Mobile login + rutas reales)"
date: 2026-06-08
tags:
  - log
  - sesion
  - mobile
  - supabase
  - auth
---

# Log de Sesión: 2026-06-08 — Mobile: Login + Rutas reales

## 📝 Resumen de la Sesión
Sub-proyecto 5 de la migración: primer corte del cableado de la **app móvil (Expo)** a Supabase — cliente Supabase + **login real con sesión persistida** + **carga de la ruta del día desde Supabase** (con fallback a la más reciente). El flujo local (jornada/GPS/check-in/sync) quedó intacto. Ejecución subagent-driven (6 tareas) sobre `feature/mobile-login-rutas`. Datos y RLS verificados E2E con JWT real.

## 🛠️ Cambios Realizados
- **Cliente Supabase** (`mobile/src/services/supabase.ts`): `supabase-js` + `react-native-url-polyfill` + storage en **AsyncStorage** (sesión persistida, autoRefresh). Credenciales vía `EXPO_PUBLIC_*` en `mobile/.env` (gitignored; solo anon key).
- **`pickRoute`** (puro, con test `node:test`): elige la ruta de hoy o cae a la más reciente. **`routesApi`**: `fetchTodayRoute(userId)` (RLS filtra a las propias) + `fetchStoresByIds` (preserva el orden de la ruta).
- **AuthContext real**: `signInWithPassword`, sesión restaurada al abrir, perfil desde `users`, `onAuthStateChange`, `signOut`.
- **RouteContext**: carga la ruta real (`loadRoute`) con estados `routeLoading`/`routeError`/`routeDate`/`reloadRoute`; `setRouteMode('normal')` recarga la ruta real. Sesión/GPS/visita/sync sin cambios. `addStoreToRoute` (rutas especiales) sigue usando el catálogo mock por ahora.
- **Pantallas**: `AppNavigator` muestra splash mientras restaura sesión; `RouteScreen` maneja cargando/sin-ruta/error+Reintentar y muestra la fecha de la ruta; `ProfileScreen` muestra el rol real; `LoginScreen` usa el `signIn` real.

## ✅ Verificación
- `npx tsc --noEmit` (mobile) limpio; `pickRoute` 3/3.
- **E2E con JWT real (Carlos `czurita@`):** ve **5 rutas, todas suyas** (RLS — `user_ids` distintos = 1); la ruta del **lunes 2026-06-08 tiene 32 tiendas**; los `store_ids` resuelven a tiendas reales (`FTD LOS MONJES`, `GAMA STA MONICA`…). El camino `fetchTodayRoute → pickRoute → fetchStoresByIds` queda probado.
- **E2E visual en Expo:** pendiente de correr por el usuario (emulador/dispositivo) — login real → ver la ruta del día.

## 🤝 Decisiones Tomadas
- **Solo login + rutas** esta fase; sync/fotos/GPS-30s/cacheo offline/competencia real = sub-proyecto siguiente.
- **AsyncStorage** para la sesión; **ruta de hoy con fallback** a la más reciente; **requiere red** + Reintentar (sin cacheo offline aún).
- Credenciales vía `EXPO_PUBLIC_*` (refinamiento sobre `expo.extra` del spec; misma anon key pública, sin commitear). Ver [[arquitectura/Spec - Mobile Login y Rutas|Spec]].

## 🚧 Pendiente (sub-proyecto Mobile siguiente)
- **Motor de sincronización offline** (cola SQLite → Supabase: visits, location_pings, competition_reports).
- Subida de fotos a Storage; envío de `location_pings` cada 30s; cacheo offline de rutas; competencia real (`competitor_brands`).
- `addStoreToRoute` (rutas especiales) aún sobre catálogo mock — cablear a un fetch de tiendas.

## 🚀 Próximos Pasos
- [ ] Correr el E2E visual en Expo (login real + ruta del día).
- [ ] Merge de `feature/mobile-login-rutas` a `master`.
- [ ] Sub-proyecto Mobile 2: motor de sync + fotos + GPS.

## 🔗 Enlaces Relacionados
- [[arquitectura/Spec - Mobile Login y Rutas|Spec — Mobile Login + Rutas]]
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]
- [[arquitectura/Ingesta - Mapeo de Datos|Mapeo de Datos]] — origen de las rutas.
- [[roadmap/Roadmap|Roadmap]]
