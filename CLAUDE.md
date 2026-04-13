# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `hub/` directory:

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

## Architecture Overview

**Ponzivenzo Smart Tracker** — a PWA for field merchandiser route tracking with geo-verified store check-ins and supervisor monitoring.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL + PostGIS + Auth + Storage) + Dexie (IndexedDB for offline)

### App Structure

```
hub/app/
├── page.tsx              # Login screen (root)
├── (hub)/                # Protected route group with persistent bottom nav
│   ├── layout.tsx        # 4-tab bottom nav shell (Ruta, Monitor, Historial, Perfil)
│   ├── ruta/             # Route management & session lifecycle
│   ├── monitor/          # Real-time fleet tracking (supervisor view)
│   ├── historial/        # Visit history & sync status
│   └── perfil/           # User profile & logout
├── checkin/[storeId]/    # Dynamic per-store check-in form
└── lib/mock-data.ts      # Type definitions + mock data (Phase 2 placeholder)
```

**Other key directories:**
- `tools/supabase_schema.sql` — Full DB schema with RLS policies
- `architecture/` — SOPs for session lifecycle, check-in flow, offline sync, anti-fraud camera

### Current Phase

The app is in **Phase 2/3 transition**: the UI is built with mock data (`lib/mock-data.ts`). Phase 3 requires wiring Supabase to the frontend by replacing mock calls with real Supabase queries.

### Environment

`hub/.env.local` requires:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Keys are currently `PENDIENTE_INGRESAR` (pending). The app runs with demo auth (`demo@ponzivenzo.com` / `demo123`) and mock data until Supabase is connected.

### State Management

No Redux/Zustand. State lives in:
- React `useState` for component state
- `sessionStorage` for session persistence across refreshes (`pv_session_active`, `pv_session_start`, `pv_location_history`, `pv_store_statuses`, `pv_visits`)
- Dexie (IndexedDB) is installed but not yet integrated — planned for offline-first sync

### Offline Sync Pattern

Every `VisitRecord` has a `synced: boolean` field. Flow: form submit → check `navigator.onLine` → if offline, save locally with `synced: false` → Service Worker attempts background sync → on success, update `synced: true`. Note: iOS Safari doesn't support Background Sync API; use `visibilitychange` listener as fallback.

### GPS & Camera

- GPS: `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`, `timeout: 10000ms`, `maximumAge: 5000ms`
- Camera (anti-fraud): mobile uses `<input capture="environment">` to force rear camera; desktop uses `getUserMedia`. Gallery picker is intentionally blocked.
- PWA is disabled in `NODE_ENV === 'development'` for easier debugging.

### Database Schema (Supabase)

Key tables: `stores` (PostGIS geography), `users` (role: merchandiser/supervisor/admin), `routes` (daily assignments), `sessions` (start/end tracking), `visits` (check-ins with photo_urls, location, sync flag). All tables have RLS — users only access their own data. Anti-fraud validation uses PostGIS distance between check-in location and `stores.master_location`.

### UI Conventions

Dark theme (`--bg-base: #0f0f1a`), purple accent (`#6c47ff`). Mobile-first (max-width 480px). Sticky header + bottom tab bar. Status badges: green/yellow/red for completed/skipped/anomaly. Design tokens are in `app/globals.css`.
