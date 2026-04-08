# Task Plan — Ponzivenzo Smart Tracker

## ✅ Status: BLUEPRINT APPROVED — Ready for Phase 2: Link

---

## Phase Checklist

### ✅ Phase 0: Protocol (Initialization)
- [x] Create `gemini.md` (Project Constitution)
- [x] Create `task_plan.md`
- [x] Create `findings.md`
- [x] Create `progress.md`
- [x] Discovery questions answered
- [x] Data Schema v1.0 defined in `gemini.md`

---

### 🔲 Phase 1: Blueprint (COMPLETE)
- [x] North Star defined: Universal PWA for Merchandiser hub
- [x] Integrations confirmed: Supabase + Browser Geolocation API
- [x] Source of Truth confirmed: Supabase (PostgreSQL + Storage)
- [x] Delivery Payload confirmed: Next.js PWA at `rutas.ponzivenzo.com`
- [x] Behavioral rules defined: Multi-resolution, Session Lifecycle, Anti-Fraud Camera, Offline Sync
- [x] Technical research completed (see `findings.md`)
- [x] Architecture decision: **Next.js 14 (App Router) + PWA + Supabase**

---

### 🔲 Phase 2: Link (Connectivity)
- [ ] Setup Supabase project (create tables: `users`, `routes`, `sessions`, `visits`, `stores`)
- [ ] Create Supabase Storage bucket: `visit-photos`
- [ ] Configure Supabase Auth (email/password + RLS policies)
- [ ] Enable PostGIS extension on Supabase project
- [ ] Setup `.env.local` with Supabase credentials
- [ ] Write `tools/verify_supabase_connection.py` — test auth + db + storage handshake
- [ ] Confirm Geolocation API works on target devices (test script)

---

### 🔲 Phase 3: Architect (3-Layer Build)
- [ ] Create `architecture/01_session_lifecycle.md` (SOP: Start/Stop Route)
- [ ] Create `architecture/02_visit_checkin.md` (SOP: Check-in flow, photo capture, form)
- [ ] Create `architecture/03_offline_sync.md` (SOP: Offline queue, retry, Supabase push)
- [ ] Create `architecture/04_anti_fraud_camera.md` (SOP: Camera capture rules)
- [ ] Initialize Next.js 14 project with PWA config
- [ ] Build Layer 3 Tools:
  - [ ] `tools/db_seed.py` — Seed `stores` master table
  - [ ] `tools/verify_supabase_connection.py` — Connection handshake
  - [ ] `tools/upload_test_image.py` — Validate Storage pipeline

---

### 🔲 Phase 4: Stylize (UI/UX)
- [ ] Mobile-first CSS design system
- [ ] Merchandiser Hub screens: Login → Route List → Active Route → Check-In → Finalize
- [ ] PWA manifest + icons
- [ ] Offline indicator UI (⏳ Pending sync badge)
- [ ] Present to users for feedback

---

### 🔲 Phase 5: Trigger (Deployment)
- [ ] Deploy Next.js PWA to Vercel
- [ ] Configure production Supabase project
- [ ] Set up custom domain: `rutas.ponzivenzo.com`
- [ ] Alpha pilot with 2 merchandisers
- [ ] Finalize Maintenance Log in `gemini.md`

---

## Architecture Decision Record

| Decision | Choice | Rationale |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router) + PWA | Universal URL-based, no app store needed, fastest to ship |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) | Instant BaaS, PostGIS geo support, RLS security |
| Offline Sync | Workbox Background Sync + Dexie.js | Canonical PWA offline pattern, integrates with next-pwa |
| Camera Anti-Fraud | `capture="environment"` + `getUserMedia()` | Bypasses gallery on most platforms |
| Expo | Deferred to Phase 2+ | Only if native app store presence is required |
| Hosting | Vercel + Supabase Cloud | HTTPS guaranteed (required for Geolocation API) |
