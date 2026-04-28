# Project Context — Ponzivenzo Smart Tracker

This file is intended for AI agents (Gemini, Copilot, Cursor, etc.) to understand the full context of this codebase.

---

## What This App Is

**Ponzivenzo Smart Tracker** — PWA for field merchandiser route tracking with geo-verified store check-ins and supervisor monitoring.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Dexie (IndexedDB, installed but unused) + Leaflet/Recharts

---

## App Structure (Dual Architecture)

The project is now split into two separate directories/repositories:

### 1. `ponce/hub` (Next.js - Supervisor Web Panel)
```
app/
├── page.tsx              # Login screen (redirects to /supervisor)
├── layout.tsx            # Root layout — AuthProvider wraps everything
├── (supervisor)/         # Supervisor route group
│   ├── layout.tsx        # 4-tab bottom nav/sidebar: Panel, Contactos, Tareas, Mapa
│   └── supervisor/
│       ├── page.tsx      # Dashboard with charts
│       ├── contactos/    # Store directory + detail view per store
│       ├── tareas/page.tsx   # Task management
│       └── mapa/page.tsx     # GPS Tracker + heat map
```
*Note: The mobile `(hub)` and `checkin` routes were deleted from the Next.js app.*

### 2. `ponce/mobile` (React Native Expo - Merchandiser App)
```
/mobile
├── App.tsx               # Root entry point
├── app.json              # Expo configuration
├── tailwind.config.js    # NativeWind (Tailwind) config
└── babel.config.js       # NativeWind babel plugin
```
*Note: Currently being initialized as a blank TypeScript template. This will contain all offline-first logic, `expo-sqlite`, `expo-camera`, and `expo-location` for continuous background tracking.*

**Other key files in `hub`:**
- `MAESTRO.xlsx` & `RUTAS 05-12-25 (1).xlsx` — Source data for Supabase import
- `.env.local` — Supabase credentials

---

## Environment Variables

`.env.local` already contains real Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://qwmdjevulhsxgpiubfev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (real key present)
NEXT_PUBLIC_APP_NAME=Ponzivenzo Smart Tracker
SUPABASE_SERVICE_ROLE_KEY=eyJ...       (real key present)
```

Demo credentials (mock auth only): `demo@poncebenzo.com` / `demo123`

---

## Current Phase: Phase 3 (Architecture Split & Supabase Integration)

### State of the Application:
The application is currently transitioning from a PWA to a **Web + Native Mobile** split architecture. 

- **Web Panel (`ponce/hub`):** Next.js dashboard for supervisors. The mobile routes have been deleted.
- **Mobile App (`ponce/mobile`):** React Native (Expo) app for merchandisers. Currently initialized as a blank template with NativeWind.

### Next Phase: Phase 3 (Supabase Integration)
1. Setup database schema in Supabase using the detailed plan in `supabase_architecture_plan.md`.
2. Build data ingestion scripts for `MAESTRO.xlsx` and `RUTAS 05-12-25 (1).xlsx`.
3. Implement Supabase Auth.
4. Develop the React Native mobile app with `expo-sqlite` and `expo-location`.
5. Connect the Next.js supervisor dashboard to live Supabase data.

---

## State Management

No Redux/Zustand. 
- **Web:** React `useState`.
- **Mobile:** `expo-sqlite` (or WatermelonDB) will be used for robust offline-first capabilities.

---

## Offline Sync & GPS Pattern (Native Android)

Due to the limitations of PWAs with background location tracking, the merchandiser app is being built natively in Android via Expo.
- **GPS:** `expo-location` with `startLocationUpdatesAsync` for continuous tracking even when screen is off.
- **Offline Sync:** Uses `expo-sqlite` for local storage and `expo-background-fetch` for silent uploads when connectivity is restored.
- **Camera (anti-fraud):** Uses `expo-camera`.

---

## Database Schema (Planned — NOT yet created in Supabase)

Key tables to create:
- `users` — `role: merchandiser | supervisor | admin`
- `stores` — PostGIS geography, `master_lat`, `master_lng`, `client_name`
- `routes` — daily assignments linking users to stores
- `sessions` — start/end jornada tracking
- `visits` — check-ins with `photo_urls`, location, `synced` flag

All tables will have RLS. Anti-fraud will use PostGIS distance between check-in GPS and `stores.master_location`.

---

## Mock Data Summary (in `mock-data.ts`)

| Data | Count | Details |
|------|-------|---------|
| `mockStores` | 12 | Farmatodo (5), Gama (3), Locatel (2), SAAS (2) — all in Caracas |
| `mockSupervisor` | 1 | Ana Martínez |
| `mockMerchandisers` | 4 | Carlos, Luis, María, Andrés |
| `mockTasks` | 12 | restock, contact_manager, pricing_issue, display_damage, other |
| `mockReports` | 17 | Visits with status, duration, photos_count, location_verified |

---

## Excel Data Summary (`data para supabase.xlsx`)

- **83 rows** (stores/clients)
- **8 unique sellers** (by `Id. de vendedor`)
- **Key columns:** `Id. de vendedor`, `Nombre y Apellido`, `Número de cliente`, `Nombre de cliente`, `Dirección 1`, `Ciudad`, `Persona de contacto`, `Correo electr.1/2/3`, `Teléfono 1/2/3`, `Inactivo`, `Clase de cliente`
- **Missing:** Latitude/Longitude coordinates (not in Excel)
- **Missing:** Seller email addresses (Excel only has client/store emails)

---

## UI Conventions

- Dark theme: `--bg-base: #0f0f1a`, accent `#00205C` (navy blue), `--accent-light` purple
- Mobile-first, max-width 480px
- Sticky header + bottom tab bar (mobile) / sidebar (desktop)
- Status badges: green = completed, yellow = skipped, red = anomaly
- Design tokens in `app/globals.css` (~31KB)
- Transitions via `PageTransition` component (opacity + translateY)
