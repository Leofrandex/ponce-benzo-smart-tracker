---
title: "Sesión: Log-2026-06-15 (Mobile Sync)"
date: 2026-06-15
tags:
  - log
  - sesion
  - mobile
  - sync
---

# Log de Sesión: 2026-06-15 (Mobile Sync)

## 📝 Resumen de la Sesión
Construido el **motor de sincronización SQLite → Supabase** del móvil: la cola local (sessions, location_pings, visits, competition_reports + fotos) ahora sube a Supabase casi en vivo. Esto desbloquea el **mapa en vivo** del hub (la causa raíz diagnosticada al inicio del día). Rama `feature/mobile-sync`. **Sin dependencias nativas nuevas** → entregable por OTA.

## 🛠️ Cambios Realizados
- **`mobile/src/services/sync/`** (nuevo): `ids.ts` (uuid v4 puro), `payloads.ts` (mapeadores SQLite→Supabase, puros + tests), `photoUpload.ts` (fotos a Storage vía `fetch().arrayBuffer()`), `syncClient.ts` (`flush()` ordenado por FK: sessions→pings→visits→competition, idempotente con upsert).
- **`db.ts`**: columna `synced` en `location_pings`, `ping_id` como UUID, getters de cola + `markSynced` + `getTotalUnsyncedCount`.
- **`SyncContext.tsx`** (nuevo): provider con flush en login + intervalo 60s; expone `pendingCount/status/flushNow`.
- **`RouteContext.tsx`**: `route_id` real (antes mock `route-demo-001`), `start_location` con fix GPS inicial (antes `null`), IDs UUID (`newId()`), y disparo de `flush` al iniciar sesión / check-in / finalizar ruta.
- **Pantallas**: `visit_id`/`report_id` ahora UUID. **`SyncBanner`** cableado al estado real de la cola. **`App.tsx`**: `SyncProvider` montado.

## 🤝 Decisiones Tomadas
- Sync = **inserts directos** desde la app (la RLS permite que el mercaderista escriba lo suyo); sin Edge Function.
- **Sin deps nativas**: uuid en JS, fotos con `fetch+arrayBuffer`, conectividad implícita (reintento por intervalo). Ver spec `docs/superpowers/specs/2026-06-15-mobile-sync-design.md`.

## ✅ Verificación
- Tests puros 6/6 PASS (`ids`, `payloads`, `photoUpload`); `tsc --noEmit` limpio.
- **E2E en dispositivo: pendiente de correr por el usuario** (iniciar ruta → ver mercaderista en el mapa; check-in con foto → visita + foto en Supabase/Storage; modo avión → cola → reconectar → drena).

## 🚀 Próximos Pasos
- [ ] **E2E en dispositivo** del flujo completo (build OTA o `npm run start`).
- [ ] **Hub**: generar signed URLs desde los paths de `photo_urls` para mostrar las fotos reales (follow-up menor).
- [ ] Evaluar sync en background con la app cerrada (hoy los pings se guardan en background y suben al volver a foreground).
- [ ] Deduplicar el doble `requestForegroundPermissionsAsync` en `startSession` (benigno).

## 🔗 Enlaces Relacionados
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[pendientes/Pendientes|Pendientes]]
- [[logs/Log-2026-06-15|Log 2026-06-15 (Nivel Cliente + Piloto)]]
