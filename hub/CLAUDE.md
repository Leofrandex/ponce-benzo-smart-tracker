# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

All commands run from this directory (`hub/`):

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
npm run clean    # Delete .next cache
npm run dev:fresh # Clean cache + start dev server
```

## Project

**Ponzivenzo Smart Tracker** — PWA for field merchandiser route tracking with geo-verified store check-ins and supervisor monitoring.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Dexie (installed, unused) + Leaflet + Recharts

## App Structure

```
app/
├── page.tsx              # Login screen (root) — mocked auth
├── layout.tsx            # Root layout — AuthProvider wraps everything
├── (hub)/                # Merchandiser route group
│   ├── layout.tsx        # 2-tab bottom nav: Mi Ruta, Historial
│   ├── ruta/page.tsx     # Route management & session lifecycle
│   ├── historial/page.tsx# Visit history from sessionStorage
│   └── perfil/           # Empty directory (unused)
├── (supervisor)/         # Supervisor route group
│   ├── layout.tsx        # 4-tab bottom nav: Panel, Contactos, Tareas, Mapa
│   └── supervisor/
│       ├── page.tsx      # Dashboard with Recharts (mock data)
│       ├── contactos/    # Store directory + [storeId] detail
│       ├── tareas/page.tsx   # Task management (mock data)
│       └── mapa/page.tsx     # GPS Tracker + Leaflet heat map (mock data)
├── checkin/[storeId]/page.tsx  # Per-store check-in form (camera + GPS)
├── select/page.tsx       # Role selector (merchandiser vs supervisor)
├── perfil/page.tsx       # User profile & logout (standalone page)
├── lib/
│   ├── types.ts          # All TypeScript interfaces
│   ├── auth-context.tsx  # AuthProvider — MOCKED via localStorage
│   └── mock-data.ts      # All demo data: 12 stores, 4 merchandisers, 12 tasks, 17 reports
└── components/
    ├── MapHistory.tsx    # Leaflet heat map (dynamic import, no SSR)
    ├── MapLive.tsx       # Leaflet live-tracking map (dynamic import, no SSR)
    ├── PageTransition.tsx# Fade-in page transition wrapper
    ├── leaflet-heat.d.ts # Type declaration for leaflet.heat
    └── dashboard/        # Recharts-based supervisor charts
        ├── AnomaliesByClientChart.tsx
        ├── StoresPerMerchandiserChart.tsx
        ├── TasksProgress.tsx
        └── TimePeriodSelector.tsx
```

**Other key files:**
- `data para supabase.xlsx` — Source data for future import: 83 real stores, 8 salespersons
- `.env.local` — Already contains real Supabase URL, Anon Key, and Service Role Key

**Directories that do NOT exist yet:**
- `tools/` — No schema SQL, no import script
- `architecture/` — No SOP documents

## Environment

`.env.local` already contains real Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://qwmdjevulhsxgpiubfev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (real key present)
NEXT_PUBLIC_APP_NAME=Ponzivenzo Smart Tracker
SUPABASE_SERVICE_ROLE_KEY=eyJ...       (real key present)
```

Demo credentials (mock auth only): `demo@poncebenzo.com` / `demo123`

## Current Phase: Phase 2 (100% Mock Data)

### State of the Application:
The application is entirely disconnected from Supabase. Despite having real keys in `.env.local`, no code uses them.

- **Login:** Mocked via `auth-context.tsx`. Only accepts demo credentials. Uses `localStorage` key `pv_demo_mode`.
- **Ruta:** Loads 5 hardcoded stores from `mockStores`. Sessions managed via `sessionStorage`.
- **Checkin:** Saves visits to `sessionStorage` (`pv_visits`). No database writes.
- **Historial:** Reads visits from `sessionStorage`. Resolves names from `mockStores`.
- **Supervisor:** All views (Panel, Contactos, Tareas, Mapa) use `mockTasks`, `mockReports`, and hardcoded merchandiser/GPS data.
- **Perfil:** Displays hardcoded demo profile.

### Dependencies NOT installed:
- `@supabase/supabase-js` — NOT in package.json
- `@supabase/ssr` — NOT in package.json

### Next Phase: Phase 3 (Supabase Integration)
1. Install `@supabase/supabase-js` and `@supabase/ssr`.
2. Create `app/lib/supabase.ts` (browser client).
3. Create `tools/supabase_schema.sql` — full schema with RLS.
4. Create `tools/import-data.ts` — import 83 stores + 8 sellers from Excel.
5. Replace `auth-context.tsx` mock with real Supabase Auth.
6. Replace all mock data references with Supabase queries.

## State Management

No Redux/Zustand. State lives in:
- React `useState` for component state
- `sessionStorage` keys: `pv_session_active`, `pv_session_start`, `pv_session_id`, `pv_store_statuses`, `pv_visits`, `pv_extra_stores`
- `localStorage` key: `pv_demo_mode` (auth flag)
- Dexie (IndexedDB) is installed (`dexie@4.4.2`) but **not imported or used anywhere**

## Offline Sync Pattern (Planned, Not Implemented)

Every `VisitRecord` has `synced: boolean`. Currently all visits save to `sessionStorage` with `synced: false`. No actual sync logic exists yet.

## GPS & Camera

- GPS: `navigator.geolocation.getCurrentPosition()` with `enableHighAccuracy: true`, `timeout: 10000ms`
- Camera (anti-fraud): mobile uses `<input capture="environment">` (forces rear camera); desktop uses `getUserMedia`. Gallery picker intentionally blocked.
- PWA: `@ducanh2912/next-pwa`, disabled in `NODE_ENV === 'development'`

## Database Schema (Planned — NOT yet created)

Key tables: `users`, `stores` (PostGIS), `routes`, `sessions`, `visits`. All with RLS.

## UI Conventions

Dark theme (`--bg-base: #0f0f1a`), navy accent (`#00205C`). Mobile-first (max-width 480px). Sticky header + bottom tab bar (mobile) / sidebar (desktop). Status badges: green/yellow/red for completed/skipped/anomaly. Design tokens in `app/globals.css`.
