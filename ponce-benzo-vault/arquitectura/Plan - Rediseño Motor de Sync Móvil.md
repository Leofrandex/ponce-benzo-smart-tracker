---
title: "Plan - Rediseño Motor de Sync Móvil"
date: 2026-06-19
tags:
  - arquitectura
  - plan
  - mobile
  - sync
---

# Rediseño del Motor de Sync Móvil — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir el sync móvil sobre una sola fuente de verdad (SQLite), un solo camino de escritura (la cola de sync), una sola fuente de pings con handle compartido, background endurecido con auto-recuperación, y observabilidad (logs en dispositivo + a Supabase).

**Architecture:** Capas con responsabilidad única — `localStore` (handle SQLite singleton + schema), `sessionState` (lógica pura), `sessionStore` (estado de sesión sobre SQLite), `locationTracker` + `backgroundTask` (única fuente de pings), `syncEngine` (cola → Supabase), `diagnostics` (logs + versión). `RouteContext`/`SyncContext` quedan como capa fina de presentación.

**Tech Stack:** React Native (Expo SDK 54), expo-sqlite, expo-location, expo-task-manager, expo-intent-launcher, @supabase/supabase-js, node:test + tsx para tests.

> Spec de referencia: [[arquitectura/Spec - Rediseño Motor de Sync Móvil|Spec]].

## Global Constraints

- **No NativeWind, no `metro.config.js`** (rompe en Windows con Expo 54). Estilos con `StyleSheet.create()`.
- **Idioma:** código en inglés, UI en español.
- **Tests:** `node:test` corridos con `npx tsx --test`. Lógica de negocio en funciones puras.
- **Background sólo corre en APK / dev-client**, no en Expo Go.
- **SQLite:** un único handle compartido (singleton). Prohibido `openDatabaseAsync` por invocación en el task.
- **Un solo camino de escritura a Supabase:** todo vía `syncEngine` (`synced=0 → upsert → synced=1`). Prohibido `supabase.from(...).update()` directo en la lógica de sesión.
- **Throttle de pings:** mínimo 30s, leído desde SQLite con el handle compartido.
- **Nombres de DB:** archivo `poncebenzo.db`.

---

## Estructura de archivos

```
mobile/src/
  store/
    localStore.ts          # CREAR — handle SQLite singleton + schema + meta + sync_log + CRUD
    localStore.test.ts     # CREAR (lógica de migración pura)
  session/
    sessionState.ts        # CREAR — puro: resolveTodayState, selectStaleOpen
    sessionState.test.ts   # CREAR
    sessionStore.ts        # CREAR — start/end/resolve sobre localStore
  location/
    pingThrottle.ts        # MOVER desde services/sync (reuse)
    pingThrottle.test.ts   # MOVER
    backgroundTask.ts      # CREAR — defineTask con handle compartido + throttle + flushPings
    locationTracker.ts     # CREAR — foreground watch (UI) + start/stop bg + battery-opt + watchdog
  sync/
    payloads.ts            # REUSAR (existe)
    photoUpload.ts         # REUSAR (existe)
    syncEngine.ts          # CREAR — flush() + flushPings() (consolida syncClient)
    syncEngine.test.ts     # CREAR
  diagnostics/
    log.ts                 # CREAR — sync_log writer + flushDeviceLogs
    version.ts             # CREAR — sello versión/commit
  context/
    RouteContext.tsx       # MODIFICAR — adelgazar a presentación
    SyncContext.tsx        # MODIFICAR — usar syncEngine
  screens/
    ProfileScreen.tsx      # MODIFICAR — sello de versión + acceso a debug log
    DebugLogScreen.tsx     # CREAR — ver sync_log
mobile/app.json            # MODIFICAR — WAKE_LOCK, allowBackup:false, updates.enabled:false, extra.gitCommit
supabase                   # migración device_logs (vía MCP)
```

> **Nota de orden:** las tareas siguen un orden de dependencias. Las viejas `services/sync/syncClient.ts`, `services/db.ts`, `tasks/locationTask.ts` se reemplazan progresivamente; la última tarea elimina lo muerto.

---

## Fase A — Fundación: store y diagnóstico

### Task 1: `localStore` — handle SQLite único + schema

**Files:**
- Create: `mobile/src/store/localStore.ts`
- Test: `mobile/src/store/localStore.test.ts`

**Interfaces:**
- Produces:
  - `getDb(): Promise<SQLiteDatabase>` — singleton; abre una vez `poncebenzo.db` y reusa.
  - `initSchema(db: SQLiteDatabase): Promise<void>` — crea/migra tablas (incluye `meta`, `sync_log`).
  - `getMeta(db, key: string): Promise<string | null>` / `setMeta(db, key: string, value: string): Promise<void>`
  - `buildMigrations(existingCols: Record<string, Set<string>>): string[]` — **función pura** que devuelve los `ALTER TABLE` faltantes (testeable sin DB).

- [ ] **Step 1: Write the failing test** (lógica pura de migración)

`mobile/src/store/localStore.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrations } from './localStore';

test('buildMigrations: agrega columnas faltantes y omite las presentes', () => {
  const existing = {
    visits: new Set(['visit_id', 'store_id']),
    location_pings: new Set(['ping_id', 'session_id', 'timestamp', 'lat', 'lng']),
  };
  const stmts = buildMigrations(existing);
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN user_id')));
  assert.ok(stmts.some((s) => s.includes('ALTER TABLE location_pings ADD COLUMN synced')));
  assert.ok(!stmts.some((s) => s.includes('ADD COLUMN visit_id')));
});

test('buildMigrations: sin faltantes devuelve []', () => {
  const full = {
    visits: new Set(['anomaly_type', 'skip_reason', 'last_restock_date']),
    location_pings: new Set(['user_id', 'synced']),
    competition_reports: new Set(['visit_id']),
  };
  assert.deepEqual(buildMigrations(full), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx tsx --test src/store/localStore.test.ts`
Expected: FAIL ("buildMigrations is not a function" / módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`mobile/src/store/localStore.ts`:
```ts
import type { SQLiteDatabase } from 'expo-sqlite';

// Columnas opcionales por tabla (migraciones idempotentes; SQLite no soporta IF NOT EXISTS en ADD COLUMN).
const OPTIONAL_COLUMNS: Record<string, Array<[string, string]>> = {
  visits: [['anomaly_type', 'TEXT'], ['skip_reason', 'TEXT'], ['last_restock_date', 'TEXT']],
  competition_reports: [['visit_id', 'TEXT']],
  location_pings: [['user_id', 'TEXT'], ['synced', 'INTEGER NOT NULL DEFAULT 0']],
};

/** Pura: dada la columna existente por tabla, devuelve los ALTER TABLE faltantes. */
export function buildMigrations(existing: Record<string, Set<string>>): string[] {
  const out: string[] = [];
  for (const [table, cols] of Object.entries(OPTIONAL_COLUMNS)) {
    const have = existing[table] ?? new Set<string>();
    for (const [col, type] of cols) {
      if (!have.has(col)) out.push(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  }
  return out;
}

const CREATE_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, route_id TEXT NOT NULL,
    session_start TEXT NOT NULL, session_end TEXT, start_lat REAL, start_lng REAL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS location_pings (
    ping_id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    visit_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT NOT NULL, user_id TEXT NOT NULL,
    check_in_time TEXT NOT NULL, lat REAL, lng REAL, photo_uri TEXT, observations TEXT,
    status TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS competition_reports (
    report_id TEXT PRIMARY KEY, session_id TEXT, store_id TEXT, user_id TEXT NOT NULL,
    brand_id TEXT, activation_type TEXT, photo_uri TEXT, notes TEXT, created_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS sync_log (
    log_id TEXT PRIMARY KEY, ts TEXT NOT NULL, level TEXT NOT NULL,
    event TEXT NOT NULL, detail TEXT, user_id TEXT, synced INTEGER NOT NULL DEFAULT 0
  );
`;

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_SQL);
  const tables = Object.keys(OPTIONAL_COLUMNS);
  const existing: Record<string, Set<string>> = {};
  for (const t of tables) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    existing[t] = new Set(rows.map((r) => r.name));
  }
  for (const stmt of buildMigrations(existing)) {
    await db.execAsync(stmt);
  }
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { openDatabaseAsync } = await import('expo-sqlite');
      const db = await openDatabaseAsync('poncebenzo.db');
      await initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, key);
  return row?.value ?? null;
}
export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, key, value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx tsx --test src/store/localStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/store/localStore.ts mobile/src/store/localStore.test.ts
git commit -m "feat(mobile/store): localStore con handle SQLite único + schema/meta/sync_log"
```

---

### Task 2: `diagnostics` — log de eventos + sello de versión

**Files:**
- Create: `mobile/src/diagnostics/log.ts`
- Create: `mobile/src/diagnostics/version.ts`
- Test: `mobile/src/diagnostics/log.test.ts`

**Interfaces:**
- Consumes: `getMeta`/`setMeta` no; usa `db.runAsync` directo. `newId` de `../services/sync/ids`.
- Produces:
  - `logEvent(db, level: 'info'|'warn'|'error', event: string, detail?: string, userId?: string): Promise<void>`
  - `formatLogLine(row: { ts: string; level: string; event: string; detail: string | null }): string` — **pura**, testeable.
  - `APP_VERSION: string`, `GIT_COMMIT: string` (de `expo-constants`).

- [ ] **Step 1: Write the failing test**

`mobile/src/diagnostics/log.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLogLine } from './log';

test('formatLogLine: incluye hora, nivel, evento y detalle', () => {
  const line = formatLogLine({ ts: '2026-06-19T13:37:31.000Z', level: 'warn', event: 'ping_skip', detail: 'throttle 12s' });
  assert.match(line, /WARN/);
  assert.match(line, /ping_skip/);
  assert.match(line, /throttle 12s/);
});

test('formatLogLine: sin detalle no rompe', () => {
  const line = formatLogLine({ ts: '2026-06-19T13:37:31.000Z', level: 'info', event: 'session_start', detail: null });
  assert.match(line, /session_start/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx tsx --test src/diagnostics/log.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`mobile/src/diagnostics/log.ts`:
```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../services/sync/ids';

export function formatLogLine(row: { ts: string; level: string; event: string; detail: string | null }): string {
  const hora = row.ts.slice(11, 19);
  return `${hora} ${row.level.toUpperCase()} ${row.event}${row.detail ? ` · ${row.detail}` : ''}`;
}

export async function logEvent(
  db: SQLiteDatabase,
  level: 'info' | 'warn' | 'error',
  event: string,
  detail?: string,
  userId?: string,
): Promise<void> {
  try {
    await db.runAsync(
      `INSERT INTO sync_log (log_id, ts, level, event, detail, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
      newId(), new Date().toISOString(), level, event, detail ?? null, userId ?? null,
    );
  } catch { /* el log nunca debe tumbar la app */ }
}
```

`mobile/src/diagnostics/version.ts`:
```ts
import Constants from 'expo-constants';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
export const GIT_COMMIT: string =
  (Constants.expoConfig?.extra as { gitCommit?: string } | undefined)?.gitCommit ?? 'dev';
export const VERSION_STAMP = `v${APP_VERSION} · ${GIT_COMMIT}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx tsx --test src/diagnostics/log.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/diagnostics
git commit -m "feat(mobile/diagnostics): sync_log writer + sello de versión"
```

---

## Fase B — Máquina de estados de sesión

### Task 3: `sessionState` — lógica pura del estado del día

**Files:**
- Create: `mobile/src/session/sessionState.ts`
- Test: `mobile/src/session/sessionState.test.ts`

**Interfaces:**
- Produces:
  - `type SessionLike = { session_id: string; user_id: string; session_start: string; session_end: string | null }`
  - `type TodayState = 'NONE' | 'ACTIVE' | 'ENDED'`
  - `resolveTodayState(rows: SessionLike[], userId: string, nowIso: string): { state: TodayState; session: SessionLike | null }`
  - `selectStaleOpen(rows: SessionLike[], userId: string, nowIso: string): SessionLike[]`

- [ ] **Step 1: Write the failing test**

`mobile/src/session/sessionState.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTodayState, selectStaleOpen } from './sessionState';

const U = 'u1';
const now = '2026-06-19T15:00:00.000Z';
const mk = (id: string, start: string, end: string | null) =>
  ({ session_id: id, user_id: U, session_start: start, session_end: end });

test('NONE cuando no hay sesión de hoy', () => {
  const r = resolveTodayState([mk('a', '2026-06-18T10:00:00Z', null)], U, now);
  assert.equal(r.state, 'NONE');
});

test('ACTIVE cuando la sesión de hoy está abierta', () => {
  const r = resolveTodayState([mk('a', '2026-06-19T09:00:00Z', null)], U, now);
  assert.equal(r.state, 'ACTIVE');
  assert.equal(r.session?.session_id, 'a');
});

test('ENDED cuando la sesión de hoy está cerrada', () => {
  const r = resolveTodayState([mk('a', '2026-06-19T09:00:00Z', '2026-06-19T12:00:00Z')], U, now);
  assert.equal(r.state, 'ENDED');
});

test('toma la sesión de hoy más reciente', () => {
  const r = resolveTodayState([
    mk('a', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
    mk('b', '2026-06-19T10:00:00Z', null),
  ], U, now);
  assert.equal(r.state, 'ACTIVE');
  assert.equal(r.session?.session_id, 'b');
});

test('ignora sesiones de otro usuario', () => {
  const r = resolveTodayState([{ session_id: 'x', user_id: 'otro', session_start: '2026-06-19T09:00:00Z', session_end: null }], U, now);
  assert.equal(r.state, 'NONE');
});

test('selectStaleOpen: sólo abiertas de días anteriores', () => {
  const stale = selectStaleOpen([
    mk('viejo', '2026-06-18T09:00:00Z', null),
    mk('hoy', '2026-06-19T09:00:00Z', null),
    mk('cerrado', '2026-06-17T09:00:00Z', '2026-06-17T10:00:00Z'),
  ], U, now);
  assert.deepEqual(stale.map((s) => s.session_id), ['viejo']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx tsx --test src/session/sessionState.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`mobile/src/session/sessionState.ts`:
```ts
export type SessionLike = {
  session_id: string; user_id: string; session_start: string; session_end: string | null;
};
export type TodayState = 'NONE' | 'ACTIVE' | 'ENDED';

// "Hoy" en UTC (consistente con el resto del código: timestamps ISO en UTC).
function dayOf(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

export function resolveTodayState(
  rows: SessionLike[], userId: string, nowIso: string,
): { state: TodayState; session: SessionLike | null } {
  const today = dayOf(nowIso);
  const todays = rows
    .filter((s) => s.user_id === userId && dayOf(s.session_start) === today)
    .sort((a, b) => b.session_start.localeCompare(a.session_start));
  const session = todays[0] ?? null;
  if (!session) return { state: 'NONE', session: null };
  return { state: session.session_end == null ? 'ACTIVE' : 'ENDED', session };
}

export function selectStaleOpen(rows: SessionLike[], userId: string, nowIso: string): SessionLike[] {
  const today = dayOf(nowIso);
  return rows.filter(
    (s) => s.user_id === userId && s.session_end == null && dayOf(s.session_start) !== today,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx tsx --test src/session/sessionState.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/session/sessionState.ts mobile/src/session/sessionState.test.ts
git commit -m "feat(mobile/session): lógica pura de estado de sesión por día"
```

---

### Task 4: `sessionStore` — operaciones sobre SQLite

**Files:**
- Create: `mobile/src/session/sessionStore.ts`

**Interfaces:**
- Consumes: `resolveTodayState`, `selectStaleOpen` (Task 3); `logEvent` (Task 2); `newId` de `../services/sync/ids`.
- Produces:
  - `resolveToday(db, userId): Promise<{ state: TodayState; session: SessionLike | null }>`
  - `startSession(db, p: { userId: string; routeId: string; startLat: number | null; startLng: number | null }): Promise<string>` — inserta sesión + ping inicial; devuelve `session_id`.
  - `endSession(db, userId): Promise<string | null>` — resuelve sid desde SQLite, marca `session_end`+`synced=0`; devuelve sid o null.
  - `closeStaleSessions(db, userId): Promise<void>`

> Sin tests unitarios de DB (la lógica ya está cubierta en Task 3); estas funciones son envoltorios SQL delgados que se validan en Nivel 3/4 (dev client). Mantener triviales.

- [ ] **Step 1: Write the implementation**

`mobile/src/session/sessionStore.ts`:
```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { resolveTodayState, selectStaleOpen, type SessionLike, type TodayState } from './sessionState';
import { newId } from '../services/sync/ids';
import { logEvent } from '../diagnostics/log';

async function allSessions(db: SQLiteDatabase, userId: string): Promise<SessionLike[]> {
  return db.getAllAsync<SessionLike>(
    `SELECT session_id, user_id, session_start, session_end FROM sessions WHERE user_id = ?`, userId,
  );
}

export async function resolveToday(db: SQLiteDatabase, userId: string): Promise<{ state: TodayState; session: SessionLike | null }> {
  return resolveTodayState(await allSessions(db, userId), userId, new Date().toISOString());
}

export async function closeStaleSessions(db: SQLiteDatabase, userId: string): Promise<void> {
  const stale = selectStaleOpen(await allSessions(db, userId), userId, new Date().toISOString());
  for (const s of stale) {
    await db.runAsync(`UPDATE sessions SET session_end = session_start, synced = 0 WHERE session_id = ?`, s.session_id);
    await logEvent(db, 'warn', 'session_stale_closed', s.session_id, userId);
  }
}

export async function startSession(
  db: SQLiteDatabase,
  p: { userId: string; routeId: string; startLat: number | null; startLng: number | null },
): Promise<string> {
  const sid = newId();
  const startIso = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sessions (session_id, user_id, route_id, session_start, start_lat, start_lng, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    sid, p.userId, p.routeId, startIso, p.startLat ?? null, p.startLng ?? null,
  );
  if (p.startLat != null && p.startLng != null) {
    await db.runAsync(
      `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      newId(), sid, p.userId, startIso, p.startLat, p.startLng,
    );
  }
  await logEvent(db, 'info', 'session_start', sid, p.userId);
  return sid;
}

export async function endSession(db: SQLiteDatabase, userId: string): Promise<string | null> {
  const { state, session } = await resolveToday(db, userId);
  if (state !== 'ACTIVE' || !session) {
    await logEvent(db, 'warn', 'session_end_noop', `state=${state}`, userId);
    return null;
  }
  const endIso = new Date().toISOString();
  await db.runAsync(`UPDATE sessions SET session_end = ?, synced = 0 WHERE session_id = ?`, endIso, session.session_id);
  await logEvent(db, 'info', 'session_end', session.session_id, userId);
  return session.session_id;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/session/sessionStore.ts
git commit -m "feat(mobile/session): sessionStore (start/end/resolve/closeStale) sobre SQLite"
```

---

## Fase C — Tracking de ubicación (única fuente de pings)

### Task 5: Mover `pingThrottle` y endurecer el throttle

**Files:**
- Create: `mobile/src/location/pingThrottle.ts`
- Create: `mobile/src/location/pingThrottle.test.ts`
- Delete (al final, Task 12): `mobile/src/services/sync/pingThrottle.ts`

**Interfaces:**
- Produces: `shouldEmitPing(lastTsMs: number | null, nowMs: number, minGapMs?: number): boolean`

- [ ] **Step 1: Write the failing test**

`mobile/src/location/pingThrottle.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldEmitPing } from './pingThrottle';

test('emite si nunca hubo ping', () => assert.equal(shouldEmitPing(null, 1000), true));
test('no emite antes de 30s', () => assert.equal(shouldEmitPing(1000, 1000 + 12_000), false));
test('emite pasados 30s', () => assert.equal(shouldEmitPing(1000, 1000 + 30_000), true));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx tsx --test src/location/pingThrottle.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`mobile/src/location/pingThrottle.ts`:
```ts
// ¿Toca emitir un ping? true si nunca se emitió o si pasó el intervalo mínimo (30s).
export function shouldEmitPing(lastTsMs: number | null, nowMs: number, minGapMs = 30_000): boolean {
  return lastTsMs == null || nowMs - lastTsMs >= minGapMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx tsx --test src/location/pingThrottle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/location/pingThrottle.ts mobile/src/location/pingThrottle.test.ts
git commit -m "feat(mobile/location): pingThrottle puro (reubicado)"
```

---

### Task 6: `backgroundTask` — única fuente de pings con handle compartido

**Files:**
- Create: `mobile/src/location/backgroundTask.ts`

**Interfaces:**
- Consumes: `getDb` (Task 1), `shouldEmitPing` (Task 5), `logEvent` (Task 2), `flushPings` (Task 8 — definir firma ahora, implementar en Task 8), `newId`.
- Produces: `export const BACKGROUND_LOCATION_TASK = 'pb-background-location'` y el `defineTask` registrado.

> Depende de `flushPings(db, supabase)` de Task 8. Si se ejecuta antes que Task 8, dejar el import y el build fallará el typecheck hasta completar Task 8 — por eso este orden. Alternativamente, implementar Task 8 inmediatamente después.

- [ ] **Step 1: Write the implementation**

`mobile/src/location/backgroundTask.ts`:
```ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getDb } from '../store/localStore';
import { shouldEmitPing } from './pingThrottle';
import { logEvent } from '../diagnostics/log';
import { flushPings } from '../sync/syncEngine';
import { supabase } from '../services/supabase';
import { newId } from '../services/sync/ids';

export const BACKGROUND_LOCATION_TASK = 'pb-background-location';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) { console.warn('[bgTask] error:', error.message); return; }
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  if (!locations?.length) return;

  try {
    const db = await getDb(); // HANDLE COMPARTIDO — clave del throttle confiable
    const open = await db.getFirstAsync<{ session_id: string; user_id: string }>(
      `SELECT session_id, user_id FROM sessions WHERE session_end IS NULL ORDER BY session_start DESC LIMIT 1`,
    );
    if (!open) return;

    const last = await db.getFirstAsync<{ ts: string }>(
      `SELECT timestamp AS ts FROM location_pings ORDER BY timestamp DESC LIMIT 1`,
    );
    const lastMs = last?.ts ? new Date(last.ts).getTime() : null;

    if (shouldEmitPing(lastMs, Date.now())) {
      const loc = locations[locations.length - 1]; // sólo la más reciente del lote
      await db.runAsync(
        `INSERT INTO location_pings (ping_id, session_id, user_id, timestamp, lat, lng, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        newId(), open.session_id, open.user_id, new Date(loc.timestamp).toISOString(),
        loc.coords.latitude, loc.coords.longitude,
      );
      await logEvent(db, 'info', 'ping_insert', `${loc.coords.latitude.toFixed(5)},${loc.coords.longitude.toFixed(5)}`, open.user_id);
    } else {
      await logEvent(db, 'info', 'ping_skip', `throttle`, open.user_id);
    }

    await flushPings(db, supabase);
  } catch (e) {
    console.warn('[bgTask] failed:', e);
  }
});
```

- [ ] **Step 2: Commit** (typecheck se completa con Task 8)

```bash
git add mobile/src/location/backgroundTask.ts
git commit -m "feat(mobile/location): task de background como única fuente de pings (handle compartido + throttle)"
```

---

### Task 7: `locationTracker` — watch UI + control del background + watchdog + batería

**Files:**
- Create: `mobile/src/location/locationTracker.ts`

**Interfaces:**
- Consumes: `BACKGROUND_LOCATION_TASK` (Task 6), `getDb` (Task 1), `resolveToday` (Task 4), `logEvent` (Task 2).
- Produces:
  - `requestPermissions(): Promise<{ foreground: boolean; background: boolean }>`
  - `requestBatteryExemption(): Promise<void>`
  - `startTracking(onUI: (loc: { lat: number; lng: number }) => void): Promise<() => void>` — arranca watch foreground (sólo UI) + background updates; devuelve función para parar el watch.
  - `stopBackground(): Promise<void>`
  - `ensureTracking(userId: string): Promise<void>` — watchdog: si hay sesión ACTIVE pero el task murió o el último ping está viejo (>90s), lo reinicia.

- [ ] **Step 1: Write the implementation**

`mobile/src/location/locationTracker.ts`:
```ts
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { BACKGROUND_LOCATION_TASK } from './backgroundTask';
import { getDb } from '../store/localStore';
import { resolveToday } from '../session/sessionStore';
import { logEvent } from '../diagnostics/log';

const STALE_PING_MS = 90_000;

export async function requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  let bg = { status: 'denied' } as Location.LocationPermissionResponse;
  if (fg.status === 'granted') bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: fg.status === 'granted', background: bg.status === 'granted' };
}

export async function requestBatteryExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:com.poncebenzo.tracker' },
    );
  } catch { /* algunos OEM no exponen el intent; no es fatal */ }
}

async function startBackground(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Ponce & Benzo — Ruta activa',
      notificationBody: 'Registrando tu ubicación durante la ruta.',
      notificationColor: '#00205C',
    },
  });
}

export async function stopBackground(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

export async function startTracking(onUI: (loc: { lat: number; lng: number }) => void): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
    (loc) => onUI({ lat: loc.coords.latitude, lng: loc.coords.longitude }), // SÓLO UI
  );
  await startBackground();
  return () => sub.remove();
}

export async function ensureTracking(userId: string): Promise<void> {
  const db = await getDb();
  const { state } = await resolveToday(db, userId);
  if (state !== 'ACTIVE') return;
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  const last = await db.getFirstAsync<{ ts: string }>(`SELECT timestamp AS ts FROM location_pings ORDER BY timestamp DESC LIMIT 1`);
  const stale = !last?.ts || Date.now() - new Date(last.ts).getTime() > STALE_PING_MS;
  if (!running || stale) {
    await logEvent(db, 'warn', 'tracking_restart', `running=${running} stale=${stale}`, userId);
    await startBackground();
  }
}
```

- [ ] **Step 2: Install `expo-intent-launcher`**

Run: `cd mobile && npx expo install expo-intent-launcher`
Expected: agrega la dependencia compatible con SDK 54.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores (asumiendo Task 8 ya hecho o por hacerse; si falla sólo por `flushPings`, continuar a Task 8).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/location/locationTracker.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile/location): tracker (watch UI + background + watchdog + exención de batería)"
```

---

## Fase D — Motor de sync

### Task 8: `syncEngine` — cola única hacia Supabase

**Files:**
- Create: `mobile/src/sync/syncEngine.ts`
- Test: `mobile/src/sync/syncEngine.test.ts`
- Reuse: `mobile/src/services/sync/payloads.ts`, `mobile/src/services/sync/photoUpload.ts`

**Interfaces:**
- Consumes: `payloads` (`toSessionPayload`, `toPingPayload`, `toVisitPayload`, `toCompetitionPayload`), `uploadPhotos`.
- Produces:
  - `getUnsyncedPings(db): Promise<PingRow[]>` (con backfill de user_id vía LEFT JOIN sessions)
  - `flushPings(db, supabase): Promise<number>`
  - `flush(db, supabase): Promise<{ pushed: number; failed: number }>` (sessions → pings → visits → competition, ordenado por FK)
  - `pendingCount(db): Promise<number>`
  - `splitUploadable(pings: {ping_id:string; user_id:string|null}[]): {ok:string[]; orphan:string[]}` — **pura**, testeable.

- [ ] **Step 1: Write the failing test** (lógica pura de filtrado)

`mobile/src/sync/syncEngine.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitUploadable } from './syncEngine';

test('splitUploadable: separa pings con y sin user_id', () => {
  const { ok, orphan } = splitUploadable([
    { ping_id: 'a', user_id: 'u1' },
    { ping_id: 'b', user_id: null },
    { ping_id: 'c', user_id: 'u1' },
  ]);
  assert.deepEqual(ok, ['a', 'c']);
  assert.deepEqual(orphan, ['b']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx tsx --test src/sync/syncEngine.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

`mobile/src/sync/syncEngine.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { toSessionPayload, toPingPayload, toVisitPayload, toCompetitionPayload } from '../services/sync/payloads';
import { uploadPhotos } from '../services/sync/photoUpload';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e));

export function splitUploadable(pings: { ping_id: string; user_id: string | null }[]): { ok: string[]; orphan: string[] } {
  const ok: string[] = [], orphan: string[] = [];
  for (const p of pings) (p.user_id ? ok : orphan).push(p.ping_id);
  return { ok, orphan };
}

type PingRow = { ping_id: string; session_id: string | null; user_id: string | null; timestamp: string; lat: number; lng: number };

export function getUnsyncedPings(db: SQLiteDatabase): Promise<PingRow[]> {
  return db.getAllAsync<PingRow>(
    `SELECT p.ping_id, p.session_id, COALESCE(p.user_id, s.user_id) AS user_id, p.timestamp, p.lat, p.lng
       FROM location_pings p LEFT JOIN sessions s ON s.session_id = p.session_id
      WHERE p.synced = 0`,
  );
}

export async function flushPings(db: SQLiteDatabase, supabase: SupabaseClient): Promise<number> {
  let pushed = 0;
  const pings = (await getUnsyncedPings(db)).filter((p) => p.user_id);
  for (const p of pings) {
    try {
      const { error } = await supabase.from('location_pings').upsert(toPingPayload(p), { onConflict: 'ping_id' });
      if (error) throw error;
      await db.runAsync(`UPDATE location_pings SET synced = 1 WHERE ping_id = ?`, p.ping_id);
      pushed++;
    } catch (e) { console.warn(`[sync] ping ${p.ping_id} FAIL:`, errMsg(e)); }
  }
  return pushed;
}

let isFlushing = false;
export async function flush(db: SQLiteDatabase, supabase: SupabaseClient): Promise<{ pushed: number; failed: number }> {
  if (isFlushing) return { pushed: 0, failed: 0 };
  isFlushing = true;
  let pushed = 0, failed = 0;
  try {
    for (const s of await db.getAllAsync<any>(`SELECT * FROM sessions WHERE synced = 0`)) {
      try { const { error } = await supabase.from('sessions').upsert(toSessionPayload(s), { onConflict: 'session_id' }); if (error) throw error; await db.runAsync(`UPDATE sessions SET synced=1 WHERE session_id=?`, s.session_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] session ${s.session_id} FAIL:`, errMsg(e)); }
    }
    pushed += await flushPings(db, supabase);
    for (const v of await db.getAllAsync<any>(`SELECT * FROM visits WHERE synced = 0`)) {
      try { const uris: string[] = v.photo_uri ? JSON.parse(v.photo_uri) : []; const urls = await uploadPhotos(supabase, v.user_id, v.visit_id, uris); const { error } = await supabase.from('visits').upsert(toVisitPayload(v, urls), { onConflict: 'visit_id' }); if (error) throw error; await db.runAsync(`UPDATE visits SET synced=1 WHERE visit_id=?`, v.visit_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] visit ${v.visit_id} FAIL:`, errMsg(e)); }
    }
    for (const c of await db.getAllAsync<any>(`SELECT * FROM competition_reports WHERE synced = 0`)) {
      try { const uris: string[] = c.photo_uri ? JSON.parse(c.photo_uri) : []; const urls = await uploadPhotos(supabase, c.user_id, c.report_id, uris); const { error } = await supabase.from('competition_reports').upsert(toCompetitionPayload(c, urls), { onConflict: 'report_id' }); if (error) throw error; await db.runAsync(`UPDATE competition_reports SET synced=1 WHERE report_id=?`, c.report_id); pushed++; }
      catch (e) { failed++; console.warn(`[sync] comp ${c.report_id} FAIL:`, errMsg(e)); }
    }
  } finally { isFlushing = false; }
  return { pushed, failed };
}

export async function pendingCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sessions WHERE synced=0)
          + (SELECT COUNT(*) FROM location_pings p LEFT JOIN sessions s ON s.session_id=p.session_id WHERE p.synced=0 AND COALESCE(p.user_id,s.user_id) IS NOT NULL)
          + (SELECT COUNT(*) FROM visits WHERE synced=0)
          + (SELECT COUNT(*) FROM competition_reports WHERE synced=0) AS n`);
  return row?.n ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx tsx --test src/sync/syncEngine.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck (cierra Task 6 y 7)**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/sync/syncEngine.ts mobile/src/sync/syncEngine.test.ts
git commit -m "feat(mobile/sync): syncEngine (cola única flush/flushPings/pendingCount)"
```

---

### Task 9: `device_logs` en Supabase + subida desde el dispositivo

**Files:**
- Modify: `mobile/src/diagnostics/log.ts` (agregar `flushDeviceLogs`)
- Supabase: migración `device_logs` (vía MCP `apply_migration`)

**Interfaces:**
- Produces: `flushDeviceLogs(db, supabase): Promise<number>`

- [ ] **Step 1: Crear la tabla en Supabase**

Aplicar migración `create_device_logs` (MCP `apply_migration`):
```sql
CREATE TABLE IF NOT EXISTS public.device_logs (
  log_id   uuid PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES public.users(id),
  ts       timestamptz NOT NULL,
  level    text NOT NULL,
  event    text NOT NULL,
  detail   text
);
ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_logs_own ON public.device_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY device_logs_supervisor_read ON public.device_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = device_logs.user_id AND u.supervisor_id = auth.uid()));
CREATE POLICY device_logs_admin_read ON public.device_logs
  FOR SELECT USING (fn_is_admin());
CREATE INDEX IF NOT EXISTS idx_device_logs_user_ts ON public.device_logs (user_id, ts DESC);
```

- [ ] **Step 2: Implementar la subida**

Agregar al final de `mobile/src/diagnostics/log.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function flushDeviceLogs(db: SQLiteDatabase, supabase: SupabaseClient): Promise<number> {
  const rows = await db.getAllAsync<{ log_id: string; user_id: string | null; ts: string; level: string; event: string; detail: string | null }>(
    `SELECT log_id, user_id, ts, level, event, detail FROM sync_log WHERE synced = 0 AND user_id IS NOT NULL LIMIT 200`,
  );
  let pushed = 0;
  for (const r of rows) {
    try {
      const { error } = await supabase.from('device_logs').upsert(
        { log_id: r.log_id, user_id: r.user_id, ts: r.ts, level: r.level, event: r.event, detail: r.detail },
        { onConflict: 'log_id' },
      );
      if (error) throw error;
      await db.runAsync(`UPDATE sync_log SET synced = 1 WHERE log_id = ?`, r.log_id);
      pushed++;
    } catch { /* reintenta en el próximo flush */ }
  }
  return pushed;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/diagnostics/log.ts
git commit -m "feat(diagnostics): subir sync_log a device_logs (Supabase) para diagnóstico remoto"
```

---

## Fase E — Wire en la UI

### Task 10: `SyncContext` usa `syncEngine`

**Files:**
- Modify: `mobile/src/context/SyncContext.tsx`

**Interfaces:**
- Consumes: `flush`, `pendingCount` (Task 8), `getDb` (Task 1), `flushDeviceLogs` (Task 9).
- Produces: `useSyncCtx()` con `{ pendingCount, status, flushNow, refreshCount }` (misma firma que hoy, para no romper consumidores).

- [ ] **Step 1: Reemplazar el contenido**

`mobile/src/context/SyncContext.tsx`:
```tsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { getDb } from '../store/localStore';
import { flush, pendingCount as pendingCountQuery } from '../sync/syncEngine';
import { flushDeviceLogs } from '../diagnostics/log';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'synced';
interface SyncContextValue { pendingCount: number; status: SyncStatus; flushNow: () => Promise<void>; refreshCount: () => Promise<void>; }
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const running = useRef(false);

  const refreshCount = useCallback(async () => { setPendingCount(await pendingCountQuery(await getDb())); }, []);
  const flushNow = useCallback(async () => {
    if (!user || running.current) return;
    running.current = true; setStatus('syncing');
    try {
      const db = await getDb();
      const { failed } = await flush(db, supabase);
      await flushDeviceLogs(db, supabase);
      await refreshCount();
      setStatus(failed > 0 ? 'offline' : 'synced');
    } catch { setStatus('offline'); }
    finally { running.current = false; }
  }, [user, refreshCount]);

  useEffect(() => { refreshCount(); if (user) flushNow(); }, [user, flushNow, refreshCount]);
  useEffect(() => { const id = setInterval(() => { flushNow(); }, 60_000); return () => clearInterval(id); }, [flushNow]);

  return <SyncContext.Provider value={{ pendingCount, status, flushNow, refreshCount }}>{children}</SyncContext.Provider>;
}
export function useSyncCtx(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncCtx must be used inside SyncProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/context/SyncContext.tsx
git commit -m "refactor(mobile/sync): SyncContext usa syncEngine + sube device_logs"
```

---

### Task 11: `RouteContext` deriva de `sessionStore` + `locationTracker`

**Files:**
- Modify: `mobile/src/context/RouteContext.tsx`

**Interfaces:**
- Consumes: `resolveToday`, `startSession`, `endSession`, `closeStaleSessions` (Task 4); `startTracking`, `stopBackground`, `ensureTracking`, `requestPermissions`, `requestBatteryExemption` (Task 7); `getDb` (Task 1); `insertVisit`/`insertCompetitionReport` (de `../services/db`, conservados); `useSyncCtx`.
- Mantiene la misma API pública de `useRouteCtx()` consumida por las pantallas (`sessionActive`, `sessionEnded`, `gpsState`, `currentLocation`, `startSession`, `endSession`, `recordVisit`, etc.).

> **Cambios clave vs. hoy:** el estado `sessionActive`/`sessionEnded` se deriva de `resolveToday` (no de refs); `endSession` NO hace update directo a Supabase (sólo `sessionStore.end` + `flushNow`); los pings ya NO se insertan en el watch de foreground; se agrega watchdog en `AppState`.

- [ ] **Step 1: Reescribir la lógica de sesión del provider**

Reemplazar en `mobile/src/context/RouteContext.tsx` el bloque de estado/efectos de sesión (rehidratación, `startSession`, `endSession`, `beginTracking`, `startBackgroundTracking`) por:

```tsx
// dentro de RouteProvider
import { AppState } from 'react-native';
import { getDb } from '../store/localStore';
import { resolveToday, startSession as ssStart, endSession as ssEnd, closeStaleSessions } from '../session/sessionStore';
import { startTracking, stopBackground, ensureTracking, requestPermissions, requestBatteryExemption } from '../location/locationTracker';
import * as Location from 'expo-location';

const stopWatchRef = useRef<null | (() => void)>(null);

const deriveState = useCallback(async () => {
  if (!user) return;
  const db = await getDb();
  await closeStaleSessions(db, user.id);
  const { state } = await resolveToday(db, user.id);
  setSessionActive(state === 'ACTIVE');
  setSessionEnded(state === 'ENDED');
  if (state === 'ACTIVE') {
    setGpsState('searching');
    stopWatchRef.current = await startTracking(({ lat, lng }) => { setCurrentLocation({ lat, lng }); setGpsState('found'); });
    await ensureTracking(user.id);
  }
}, [user]);

useEffect(() => { deriveState(); }, [deriveState]);

// Watchdog: al volver a foreground, reasegurar el tracking de la sesión activa.
useEffect(() => {
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && user) ensureTracking(user.id); });
  return () => sub.remove();
}, [user]);

async function startSession() {
  if (!user) return;
  const perms = await requestPermissions();
  if (!perms.foreground) { setGpsState('error'); return; }
  await requestBatteryExemption();
  let lat: number | null = null, lng: number | null = null;
  try { const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); lat = pos.coords.latitude; lng = pos.coords.longitude; } catch {}
  const db = await getDb();
  await ssStart(db, { userId: user.id, routeId: routeId.current ?? 'unknown', startLat: lat, startLng: lng });
  if (lat != null) setCurrentLocation({ lat, lng: lng! });
  setSessionActive(true); setSessionEnded(false); setGpsState(lat != null ? 'found' : 'searching');
  stopWatchRef.current = await startTracking(({ lat: a, lng: b }) => { setCurrentLocation({ lat: a, lng: b }); setGpsState('found'); });
  flushNow();
}

async function endSession() {
  setSessionActive(false); setSessionEnded(true); setGpsState('idle'); setCurrentLocation(null);
  stopWatchRef.current?.(); stopWatchRef.current = null;
  await stopBackground();
  if (user) { const db = await getDb(); await ssEnd(db, user.id); }
  flushNow();
}
```

> Borrar de este archivo: el `useRef` `sessionId`/`lastPingAt`, el `useEffect` viejo de rehidratación con `getOpenSession`, `beginTracking`, `startBackgroundTracking`, y el `import` de `BACKGROUND_LOCATION_TASK`/`shouldEmitPing`/`insertLocationPing`/`updateSessionEnd`/`getTodaySession`/`getOpenSession`/`supabase`. `recordVisit` se mantiene pero usando `await getDb()` para el handle y sin `flush` directo bloqueante (igual que hoy, fire-and-forget).

- [ ] **Step 2: Ajustar `recordVisit` para usar el handle compartido**

En `recordVisit`, cambiar el `db` del `useSQLiteContext()` por `const db = await getDb();` al inicio, manteniendo el resto (insert visita optimista, competencia en try/catch, `flushNow()` sin await). Quitar `useSQLiteContext`.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/context/RouteContext.tsx
git commit -m "refactor(mobile/route): estado derivado de sessionStore + tracker (sin update directo, sin pings en foreground, watchdog)"
```

---

### Task 12: `App.tsx` usa `getDb`; eliminar código muerto

**Files:**
- Modify: `mobile/App.tsx`
- Delete: `mobile/src/services/sync/syncClient.ts`, `mobile/src/services/sync/pingThrottle.ts`, `mobile/src/services/sync/pingThrottle.test.ts`, `mobile/src/tasks/locationTask.ts`, `mobile/src/services/sync/resume.ts`, `mobile/src/services/sync/resume.test.ts`
- Modify: `mobile/src/services/db.ts` (quitar funciones reemplazadas: `getOpenSession`, `getTodaySession`, `closeStaleSessions`, `insertLocationPing*`, `updateSessionEnd`, `getOpenSession`, conteos viejos; conservar `insertVisit`, `insertCompetitionReport`, `getTodayVisits` y los tipos usados por `recordVisit`/historial).

**Interfaces:**
- Consumes: `getDb`, `initSchema` (Task 1); `BACKGROUND_LOCATION_TASK` (Task 6, registra el task por import).

- [ ] **Step 1: Quitar `SQLiteProvider` y registrar el task**

En `mobile/App.tsx`: eliminar `SQLiteProvider`/`useSQLiteContext` (ya no se usa el provider — el handle es el singleton de `getDb`). Importar el task para que se registre: `import '../location/backgroundTask';` (ruta correcta `./src/location/backgroundTask`). Llamar `getDb()` al montar para inicializar el schema. Mantener `useFonts` (Inter bloqueante) + carga de íconos no bloqueante (BUG-013).

```tsx
// reemplazo del árbol de providers en App.tsx
import './src/location/backgroundTask'; // registra el TaskManager.defineTask
import { getDb } from './src/store/localStore';
// ...
useEffect(() => { getDb(); }, []); // inicializa schema una vez

return (
  <SafeAreaProvider>
    <AuthProvider>
      <SyncProvider>
        <RouteProvider>
          <NavigationContainer><AppNavigator /></NavigationContainer>
        </RouteProvider>
      </SyncProvider>
      <StatusBar style="dark" />
    </AuthProvider>
  </SafeAreaProvider>
);
```

- [ ] **Step 2: Borrar archivos muertos**

```bash
cd mobile
rm src/services/sync/syncClient.ts src/services/sync/pingThrottle.ts src/services/sync/pingThrottle.test.ts \
   src/tasks/locationTask.ts src/services/sync/resume.ts src/services/sync/resume.test.ts
```

- [ ] **Step 3: Limpiar `services/db.ts`**

Quitar las funciones reemplazadas (listadas arriba) y sus referencias. Mantener `insertVisit`, `insertCompetitionReport`, `getTodayVisits`, tipos `VisitRow`/`CompetitionReportRow`. Cualquier pantalla que importe `getTodayVisits` debe pasarle `await getDb()`.

- [ ] **Step 4: Typecheck + tests completos**

Run: `cd mobile && npx tsc --noEmit && npx tsx --test src/**/*.test.ts`
Expected: sin errores de tipos; todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add -A mobile
git commit -m "refactor(mobile): App usa getDb singleton; eliminar syncClient/locationTask/resume muertos"
```

---

### Task 13: Sello de versión + pantalla de debug log en Perfil

**Files:**
- Modify: `mobile/src/screens/ProfileScreen.tsx`
- Create: `mobile/src/screens/DebugLogScreen.tsx`
- Modify: `mobile/src/navigation/AppNavigator.tsx` (registrar `DebugLog`)

**Interfaces:**
- Consumes: `VERSION_STAMP` (Task 2), `getDb` (Task 1), `formatLogLine` (Task 2).

- [ ] **Step 1: Pantalla de debug**

`mobile/src/screens/DebugLogScreen.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDb } from '../store/localStore';
import { formatLogLine } from '../diagnostics/log';
import { colors, fonts } from '../theme';

export function DebugLogScreen() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<{ ts: string; level: string; event: string; detail: string | null }>(
        `SELECT ts, level, event, detail FROM sync_log ORDER BY ts DESC LIMIT 300`,
      );
      setLines(rows.map(formatLogLine));
    })();
  }, []);
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Diagnóstico</Text>
      <FlatList data={lines} keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Text style={styles.line}>{item}</Text>} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase, padding: 12 },
  title: { fontSize: 16, color: colors.textPrimary, ...fonts.bold, marginBottom: 8 },
  line: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace', marginBottom: 2 },
});
```

- [ ] **Step 2: Sello en Perfil + acceso al debug**

En `ProfileScreen.tsx`, agregar al pie un `Text` con `VERSION_STAMP` envuelto en `TouchableOpacity` con `onLongPress={() => navigation.navigate('DebugLog')}`.

- [ ] **Step 3: Registrar la ruta**

En `AppNavigator.tsx`, agregar `<Stack.Screen name="DebugLog" component={DebugLogScreen} />` y el tipo `DebugLog: undefined` en `RootStackParamList`.

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/DebugLogScreen.tsx mobile/src/screens/ProfileScreen.tsx mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): sello de versión + pantalla de debug log (long-press en Perfil)"
```

---

## Fase F — Config de build / piloto

### Task 14: `app.json` — endurecer permisos, apagar OTA y backup, inyectar commit

**Files:**
- Modify: `mobile/app.json`
- Create/Modify: `mobile/eas.json` (hook para inyectar commit, opcional)

- [ ] **Step 1: Editar `app.json`**

- En `expo.android.permissions` agregar `"android.permission.WAKE_LOCK"`.
- En `expo.android` agregar `"allowBackup": false`.
- Reemplazar el bloque `"updates"` por `"updates": { "enabled": false }` (apaga OTA; el APK corre siempre su bundle).
- En `expo.extra` agregar `"gitCommit": "dev"` (se sobreescribe en build).

- [ ] **Step 2: Inyectar el commit en el build (opcional pero recomendado)**

Agregar un `app.config.js` que lea `process.env.EAS_BUILD_GIT_COMMIT_HASH` (lo expone EAS) y lo ponga en `extra.gitCommit`, o setearlo a mano antes de cada build. Mínimo viable: editar `extra.gitCommit` al commit corto antes de `eas build`.

- [ ] **Step 3: Verificar config**

Run: `cd mobile && npx expo config --type public > /dev/null && echo OK`
Expected: `OK` (config válida).

- [ ] **Step 4: Commit**

```bash
git add mobile/app.json mobile/app.config.js 2>/dev/null; git add mobile/app.json
git commit -m "chore(mobile): WAKE_LOCK + allowBackup:false + OTA off + sello de commit"
```

---

### Task 15: Build dev-client (iteración) y verificación de aceptación

**Files:** ninguno (operativo)

- [ ] **Step 1: Compilar el dev client (una sola vez)**

Run: `cd mobile && npx eas-cli build --platform android --profile development --non-interactive --no-wait`
Expected: build encolado; instalar el APK dev-client en el teléfono del piloto.

- [ ] **Step 2: Iterar por Metro**

Run: `cd mobile && npx expo start --dev-client --lan`
Conectar el dev-client; hot reload del JS sin rebuild. El background corre de verdad.

- [ ] **Step 3: Verificación de aceptación (queries a Supabase, vía MCP)**

Con una ruta de prueba de ~5 min (incluyendo pantalla apagada), verificar:
```sql
-- Cadencia de pings ~30s
WITH d AS (SELECT timestamp, extract(epoch FROM (timestamp - lag(timestamp) OVER (ORDER BY timestamp))) AS delta FROM location_pings)
SELECT round(avg(delta))::int AS avg_delta, min(delta)::int AS min_delta, max(delta)::int AS max_delta FROM d WHERE delta IS NOT NULL;
-- Sesión cerrada al primer intento
SELECT session_id, session_end IS NOT NULL AS cerrada FROM sessions ORDER BY session_start DESC LIMIT 1;
-- Logs del dispositivo
SELECT ts, level, event, detail FROM device_logs ORDER BY ts DESC LIMIT 50;
```
Criterios: `avg_delta` 25-35s, `max_delta` < 60s; sesión `cerrada = true`; sin sesiones duplicadas; `device_logs` con `tracking_restart` sólo si el OS mató el servicio.

- [ ] **Step 4: Build `preview` para el piloto (cuando pase aceptación)**

Run: `cd mobile && npx eas-cli build --platform android --profile preview --non-interactive --no-wait`

---

## Cierre

- [ ] Actualizar el vault: log de la sesión, `BUG-009..016` marcados como resueltos por el rediseño, y enlazar este plan desde [[arquitectura/03_offline_sync|Offline Sync]].
