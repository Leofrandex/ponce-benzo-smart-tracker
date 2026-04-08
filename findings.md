# Findings — Ponzivenzo Smart Tracker

## Research Discoveries

### 1. Frontend Architecture Decision: Next.js PWA vs Expo Universal
- **Decision: Next.js 14 (App Router) + PWA** wins for Phase 1.
- **Rationale:**
  - No app store submission required — critical for speed.
  - Works on all mobile browsers (Chrome Android, Safari iOS) and all desktops via URL.
  - `next-pwa` (or `@ducanh2912/next-pwa`) adds full PWA manifest + service worker in hours.
  - Expo web is powerful but adds complexity; can be migrated to later if native shell is needed.
- **Expo consideration:** Kept open for Phase 2+ if client requires Play Store / App Store distribution.

### 2. Camera Anti-Fraud Implementation
- **Key finding:** `<input type="file" accept="image/*" capture="environment">` is the most reliable cross-platform trick to force the rear camera on Android Chrome. It bypasses the gallery picker on most Android devices.
- **Desktop fallback:** `MediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` opens the webcam. No file picker is exposed.
- **iOS Safari caveat:** `capture` attribute support is limited on older iOS. A fallback warning UI must be shown if `getUserMedia` is unavailable.

### 3. Offline Sync Architecture (Service Worker + Background Sync)
- **Pattern:** Uses the **Background Sync API** (Chrome/Android supported) via a registered service worker.
- **Queue library:** `workbox-background-sync` (part of Workbox, which `next-pwa` uses internally) is the canonical solution.
- **Offline data store:** `IndexedDB` via the `idb` or `Dexie.js` library (cleaner async API than raw IndexedDB).
- **Flow:** Form submit → Check connectivity → If offline: save to Dexie.js with `synced: false` → SW Background Sync retries → On success: update record to `synced: true` → Push to Supabase.
- **iOS limitation:** Background Sync API is NOT supported on Safari/iOS. Fallback: retry on next app foreground event (`visibilitychange` listener).

### 4. Supabase Architecture
- **Auth:** Supabase Auth (email/password for now). RLS policies enforce that users can only read/write their own data.
- **PostGIS:** Supabase supports PostGIS natively. Can calculate distance between `check_in_location` and `stores.master_location` in SQL for anti-fraud distance check.
- **Storage:** Supabase Storage supports per-bucket RLS policies. `visit-photos` bucket should be private (access only via signed URLs).
- **Realtime:** Supabase Realtime can be used in Phase 3 for the supervisor dashboard.

### 5. GPS Geolocation Constraints
- **Browser API:** `navigator.geolocation.getCurrentPosition()` and `watchPosition()` work on both mobile and desktop.
- **HTTPS required:** Geolocation API **requires HTTPS**. Vercel provides this by default. Local dev uses `localhost` (exempt).
- **Accuracy:** Mobile GPS accuracy: ~5-10m. Desktop/laptop uses IP geolocation (~city-level). This must be documented in the UI ("Usando ubicación aproximada — GPS no disponible").

## Constraints
- All deployments MUST use HTTPS (Geolocation API requirement).
- iOS Safari does not support Background Sync — requires fallback retry strategy.
- Gallery access must be blocked at the code level, not just at the UX/UI level.
- Supabase free tier: 500MB DB, 1GB Storage, 50,000 MAUs — sufficient for Phase 1 pilot.
