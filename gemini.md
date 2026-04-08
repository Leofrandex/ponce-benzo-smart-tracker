# Gemini.md — Project Constitution: Ponzivenzo Smart Tracker

> ⚠️ This file is LAW. All code, tools, and architecture must comply with the rules defined here.
> Only update this file when: (a) a schema changes, (b) a rule is added, (c) architecture is modified.

---

## 1. Architectural Invariants

- **3-Layer Architecture:**
  - **Layer 1 — Architecture (`architecture/`):** SOPs written in Markdown. Defines goals, inputs, tool logic, and edge cases.
  - **Layer 2 — Navigation:** LLM reasoning layer. Routes data between SOPs and Tools. Does not execute complex logic directly.
  - **Layer 3 — Tools (`tools/`):** Deterministic Python scripts. Atomic and testable. No LLM logic here.

- **Data-First Rule:** JSON Schema (Input/Output shapes) must be fully defined in this file before any code is written.

- **Ephemeral vs Persistent:**
  - `.tmp/` → All scrapes, logs, intermediate files. Ephemeral. Can be deleted at any time.
  - **Supabase** → The canonical Source of Truth. The "Payload" is only complete when data lives in Supabase.

- **Stack Canonical:**
  - **Frontend:** Next.js 14 (App Router) as a **Progressive Web App (PWA)**. Single universal codebase for mobile + desktop.
  - **Backend/DB/Auth:** Supabase (PostgreSQL + Auth + Storage + PostGIS for geo).
  - **Hosting:** Vercel (frontend PWA) + Supabase (hosted BaaS).
  - **Geolocation:** Browser/Device native Web Geolocation API.

---

## 2. Behavioral Rules

- **Multi-Resolution Fluid:** The app MUST be fully responsive (mobile-first CSS). It must not "break" on any screen size or pixel density.

- **Session Lifecycle (Start/Stop):** A route session only begins when the user explicitly presses "Empezar Ruta". This action:
  1. Requests GPS permission (Browser Geolocation API).
  2. Records a `session_start` event in Supabase with `timestamp` + `lat/lng` + `user_id`.
  A session only ends on explicit "Finalizar Ruta" tap.

- **Anti-Fraud Camera Rule:** Photo uploads MUST be captured via live camera. Rule:
  - On mobile: Use `<input type="file" accept="image/*" capture="environment">` to force rear camera capture.
  - On desktop: Use `MediaDevices.getUserMedia({ video: true })` to open the webcam.
  - Gallery/file picker access is **FORBIDDEN** for visit photos.

- **Offline Resilience (Offline Sync):** If network is unavailable:
  1. Form data is encrypted and stored in browser `localStorage` / `IndexedDB`.
  2. A `service-worker.js` monitors network status.
  3. On reconnect, data is silently pushed ("background sync") to Supabase.
  4. Pending syncs are clearly marked in the UI (e.g., `⏳ Pendiente de sincronización`).

- **DO NOT rules:**
  - Do NOT allow gallery photo uploads for visit records.
  - Do NOT allow a route session to start without valid GPS coordinates.
  - Do NOT store secrets (API keys) in frontend code. Use `.env.local` (Next.js) + Supabase RLS policies.
  - Do NOT write business logic in the Navigation layer. Tools must be deterministic.

---

## 3. Data Schemas

### 3.1 Input Format (What the app collects from the Merchandiser)

```json
{
  "session": {
    "user_id": "uuid",
    "route_id": "uuid",
    "session_start": "ISO8601 timestamp",
    "session_end": "ISO8601 timestamp | null",
    "start_location": { "lat": "float", "lng": "float" }
  },
  "visit": {
    "visit_id": "uuid",
    "session_id": "uuid",
    "store_id": "uuid",
    "user_id": "uuid",
    "check_in_time": "ISO8601 timestamp",
    "check_in_location": { "lat": "float", "lng": "float" },
    "photo_urls": ["string (supabase storage url)"],
    "observations": "string | null",
    "status": "enum: completed | skipped | anomaly",
    "synced": "boolean"
  }
}
```

### 3.2 Output / Payload Format (What lands in Supabase)

**Tables:**
- `users` — Merchandiser profiles (linked to Supabase Auth)
- `routes` — Route definitions (list of store_ids assigned to a user per day)
- `sessions` — Active route sessions (start/end timestamps, GPS)
- `visits` — Individual store check-ins (check_in_location, photos, observations)
- `stores` — Master store list (name, address, master_lat, master_lng)

**Supabase Storage Bucket:** `visit-photos/{user_id}/{visit_id}/{timestamp}.jpg`

**Payload Finality Rule:** A project is only "Complete" when a `visit` record exists in Supabase with `synced: true` AND at least one photo in Storage.

---

## 4. Maintenance Log

- **2026-04-08:** Initialized Project Memory (Protocol 0).
- **2026-04-08:** Discovery completed. Data Schema v1.0 defined. Architecture invariants locked.
