---
title: "Spec - Rediseño Motor de Sync Móvil"
date: 2026-06-19
tags:
  - arquitectura
  - spec
  - mobile
  - sync
  - location-pings
---

# Spec — Rediseño del Motor de Sync Móvil

> [!NOTE] Estado
> Diseño **aprobado** (brainstorming 2026-06-19). Pendiente: plan de implementación.
> Relacionado: [[bugs/Registro de Bugs|BUG-009 → BUG-016]], [[arquitectura/03_offline_sync|Offline Sync]], [[logs/Log-2026-06-19|Log 2026-06-19]].

---

## 1. Problema

Tras 4+ rondas de parches (BUG-009/010/015/016 y variantes) el sync móvil sigue fallando y los problemas **mutan de lugar** — señal de un problema de arquitectura, no de bugs sueltos. Evidencia del último QA en dispositivo (build `a4d28b0b`):

- **Pings cada ~7s en vez de 30s**, y se **cortan a los 72s** aunque la ruta siga activa ~3 min.
- **`session_end` queda NULL** al finalizar (hubo que finalizar dos veces).
- **Reabrir la app muestra "Empezar Ruta"** aunque la sesión exista en el servidor.
- **"2 pendientes" fantasma** apenas se instala (SQLite vieja restaurada por el auto-backup de Android).
- Imposible saber **qué bundle corre** en el dispositivo (hay OTA configurado).

### Causas raíz estructurales
1. **Estado de sesión sin dueño único** — vive en memoria (`sessionId.current`), SQLite local y Supabase, y se desincronizan.
2. **Dos caminos de escritura que compiten** — el `UPDATE` directo a Supabase en `endSession` vs. el motor de sync por `flush`.
3. **Throttle de pings no confiable** — el task de background abre una **conexión SQLite efímera** (`openDatabaseAsync`) en cada disparo y no "ve" el último ping para throttlear → inserta todos.
4. **Múltiples fuentes de pings** — el watch de foreground y el task de background escriben sin coordinarse.
5. **Background frágil** sin auto-recuperación ni exención de batería.
6. **Cero observabilidad** en el dispositivo — se diagnostica adivinando por lo que llega a Supabase.

---

## 2. Decisiones de alcance (acordadas)

| Decisión | Valor |
|---|---|
| Alcance | Rediseño **completo** del motor de sync |
| Background con pantalla apagada | **Requisito** (no best-effort) |
| Motor de geolocalización | **Endurecer expo-location** (gratis); no se compra librería paga |
| OTA / builds | **OTA desactivado** en el piloto + auto-backup off + sello de versión visible |

---

## 3. Arquitectura

### 3.1 Dos planos de datos (en direcciones opuestas)

**Plano de LECTURA (Supabase → móvil):** rutas, tiendas, usuarios, marcas. Los autorea el supervisor en el hub. **Supabase es la fuente de verdad**; el móvil los lee (con caché local opcional para offline). **El móvil nunca escribe estos datos hacia arriba.**

**Plano de ESCRITURA (móvil → Supabase):** sesiones, location_pings, visitas, competencia. Los genera el móvil en campo. **SQLite es la fuente de verdad** hasta que el sync los sube (`synced=0 → upsert → synced=1`).

```
HUB (supervisor) ──escribe──► Supabase ──lee──► Móvil
                                  rutas, tiendas, marcas

Móvil ──genera──► SQLite ──sync (synced=0→upsert)──► Supabase ──lee──► HUB
                          sesiones, pings, visitas, competencia
```

### 3.2 Las tres reglas
1. **SQLite es la única fuente de verdad para lo que el móvil GENERA.** La UI deriva su estado de SQLite, nunca al revés. (Para lo que el móvil sólo consume, la fuente de verdad es Supabase.)
2. **Un solo camino de escritura: la cola de sync.** Se elimina el `UPDATE` directo a Supabase. Todo se escribe en SQLite con `synced=0` y el `syncEngine` lo empuja con upsert idempotente.
3. **Una sola fuente de pings con un solo handle de SQLite.** El task de background es el único writer de pings, usando un **handle persistente compartido** (no efímero). El watch de foreground sólo actualiza el chip de GPS.

### 3.3 Componentes (responsabilidad única, testeables solos)

| Módulo | Qué hace | Depende de |
|---|---|---|
| `localStore` | Dueño **único** del handle SQLite (singleton reutilizado por UI y task) + CRUD tipado + tabla `meta` | expo-sqlite |
| `sessionStore` | Máquina de estados de sesión sobre SQLite (`resolveTodayState`, `start`, `end`). **Sin red.** | localStore |
| `locationTracker` | Foreground watch (sólo UI) + registro/arranque/parada del task de background (única fuente de pings), throttle, exención de batería, watchdog/auto-recuperación | expo-location, localStore |
| `syncEngine` | La bomba de la cola: lee `synced=0`, sube a Supabase ordenado por FK e idempotente, marca `synced=1`. **Único punto de red de escritura.** | localStore, supabase |
| `diagnostics` | `sync_log` en dispositivo + subida a `device_logs` en Supabase + sello de versión/commit | localStore |
| `RouteContext` / `SyncContext` | Capa fina de React: derivan estado de los stores y exponen acciones. **Sin lógica de negocio ni red directa.** | los stores |

---

## 4. Flujo del ciclo de sesión

Función central que computa el estado **desde SQLite** (nunca desde memoria):

```
resolveTodayState(userId) → NONE | ACTIVE | ENDED
   • NONE   = no hay sesión de hoy             → "Empezar Ruta"
   • ACTIVE = sesión de hoy, session_end NULL  → "Finalizar Ruta" + tracking
   • ENDED  = sesión de hoy, session_end ≠ NULL → "Ruta finalizada" (no reinicia)
```

**① Empezar Ruta** — `sessionStore.start()`
1. Toma fix de GPS (para `start_location`).
2. INSERT sesión en SQLite (`synced=0`, `session_end` NULL).
3. INSERT ping inicial (`synced=0`) + actualiza la marca de "último ping".
4. Arranca `locationTracker` (watch + task de background).
5. `syncEngine.flush()`. → Estado deriva a ACTIVE.

**② Ping** — *única fuente: el task de background*
1. Android entrega ubicación(es) → el task lee la sesión abierta vía el **handle compartido**.
2. **Throttle confiable**: lee `MAX(timestamp)` de pings con ese handle; si `< 30s`, no inserta.
3. INSERT 1 ping (la ubicación más reciente del lote), `synced=0`.
4. `syncEngine.flushPings()` lo sube. *(El foreground watch sólo refresca el chip GPS.)*

**③ Finalizar Ruta** — `sessionStore.end()`
1. Para `locationTracker` (watch + task).
2. Resuelve el `sid` **desde SQLite** (sesión abierta de hoy), no desde memoria.
3. UPDATE `session_end` local, `synced=0`. **Sin update directo a Supabase.**
4. `syncEngine.flush()` → el upsert sube el `session_end`. → Estado deriva a ENDED.

**④ Reabrir app** — rehidratación = sólo derivar
1. `closeStaleSessions` (cierra jornadas abiertas de días anteriores).
2. `resolveTodayState`:
   - ACTIVE → **auto-recuperación**: verifica que el tracking siga vivo; si el OS lo mató, lo reinicia.
   - ENDED → muestra finalizada.
   - NONE → "Empezar Ruta".
3. `syncEngine.flush()`.

**Trazabilidad bug → fix:**
- *7s entre pings* → fuente única + throttle con handle reutilizado.
- *session_end NULL* → un solo camino de escritura (upsert del engine).
- *finalizar dos veces* → `end()` resuelve `sid` desde SQLite.
- *reabrir = Empezar Ruta* → estado derivado de SQLite.

---

## 5. Endurecer el background

El corte a 72s = Android dejó de alimentar el task (batería / Doze / kill del fabricante). Capas de defensa:

1. **Foreground service** persistente (notificación *ongoing* "Ruta activa").
2. **Exención de optimización de batería**: en el onboarding, detectar si está optimizada y abrir la pantalla de Android para excluirla (`expo-intent-launcher` → `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`). Factor #1.
3. **Permiso `WAKE_LOCK`** (agregar a `app.json`).
4. **Parámetros de ubicación**: `timeInterval ~30s`, `distanceInterval 0`, **sin** `deferredUpdatesInterval`, `pausesUpdatesAutomatically:false`.
5. **Watchdog / auto-recuperación**: en cada `AppState → active`, si hay sesión abierta pero el task murió (`hasStartedLocationUpdatesAsync` false) o el último ping está viejo (>90s) → reinicia el tracking.
6. **Flujo de permiso correcto**: pedir "Permitir todo el tiempo" con explicación; si sólo dio "mientras se usa", detectarlo y avisar (no fallar en silencio).

> [!WARNING] Honestidad sobre límites
> En fabricantes muy agresivos (Xiaomi/Huawei) el OS *puede* matar el servicio igual; el watchdog garantiza continuidad al volver a la app, y los `device_logs` dirán si pasa en los teléfonos reales del piloto. Si se confirma, recién ahí se evalúa la librería paga (react-native-background-geolocation).

---

## 6. Observabilidad

1. **OTA desactivado** (`updates.enabled:false`): el APK corre siempre su bundle embebido.
2. **Auto-backup de Android off** (`allowBackup:false`): mata el fantasma de "2 pendientes" restaurados.
3. **Sello de versión/commit** en la pantalla Perfil (inyectado en el build).
4. **Log de eventos en dispositivo** — tabla `sync_log(ts, level, event, detail)`: inicio/fin de sesión, ping insertado, ping omitido por throttle, flush ok/falla (con conteos), tracking arrancó/murió/reinició, estado de permisos.
   - Visible en pantalla de **debug** (long-press al sello de versión).
   - **Se sube a Supabase** (tabla `device_logs`) → diagnóstico desde el hub sin adivinar.

**Cambios en `app.json`**: agregar `WAKE_LOCK`, `allowBackup:false`, `updates.enabled:false`. (`FOREGROUND_SERVICE_LOCATION` y los de ubicación ya están.)

---

## 7. Estrategia de testing

**Nivel 1 — Unitarios puros (node:test, sin dispositivo).** Funciones puras: `resolveTodayState`, `shouldEmitPing`, `closeStaleSessions`, mapeadores de payload + orden de `flush`.

**Nivel 2 — Integración contra SQLite real + Supabase mockeado.** Flujos completos `start → ping → end → reabrir` producen el estado y las filas `synced` correctas. Caza los bugs multi-paso sin dispositivo.

**Nivel 3 — Dev client + Metro (sin rebuilds).** El OTA-off es sólo para el APK del piloto. Se compila **una vez** un `development` build (dev client) que corre el task de background **de verdad** y permite **hot reload** del JS por Metro. Sólo se compila un `preview` nuevo para entregas al piloto.

**Nivel 4 — Diagnóstico en dispositivo + `device_logs` a Supabase.** Verificación de aceptación con queries a Supabase.

### Criterios de aceptación
- Pings cada **30±5s**, constantes durante toda la ruta (incl. pantalla apagada 5+ min).
- `session_end` se marca **al primer intento** de finalizar.
- Reabrir tras finalizar → "Ruta finalizada" (no reinicia).
- Reabrir con ruta activa → reanuda, **sin duplicar** sesión.
- Contador de pendientes llega a **0**; sin fantasmas tras reinstalar.

---

## 8. Migración (no romper lo que funciona)

- **Visitas, competencia y fotos** ya suben bien (BUG-005/007 resueltos). Se **conservan** los mapeadores (`payloads.ts`) y la subida de fotos (`photoUpload.ts`); se reencauzan dentro del nuevo `syncEngine` (mismo patrón `synced=0 → upsert`).
- El schema de SQLite se **extiende** (tabla `meta`, `sync_log`) con migraciones idempotentes; no se recrea.
- Se **borra** el `UPDATE` directo a Supabase de `endSession` y la inserción de pings del foreground watch (causas de bugs).
- `RouteContext`/`SyncContext` se adelgazan a capa de presentación sobre los nuevos stores.

---

## 9. Fuera de alcance (YAGNI)

- Librería de geolocalización paga (se evaluará sólo si el piloto confirma que el OS mata el tracking pese al endurecimiento).
- Caché offline de rutas: opcional, no requisito de esta iteración.
- Compresión de imágenes (pendiente aparte).
