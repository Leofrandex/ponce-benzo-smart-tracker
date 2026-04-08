# SOP 03: Offline Sync (Resiliencia Operativa)

## Goal
Ensure zero data loss when the Merchandiser operates without internet connectivity. All visit data queued locally must be pushed silently to Supabase on reconnection.

## Storage Architecture
- **Library:** Dexie.js (IndexedDB wrapper)
- **DB Name:** `ponzivenzo_offline_db`
- **Tables (Dexie stores):**
  - `pending_visits` — visit records pending sync
  - `pending_photos` — photo blobs pending S3 upload

## Offline Queue Flow

### Write (When Offline)
1. User submits check-in form.
2. `navigator.onLine === false` OR Supabase call fails with network error.
3. Save to Dexie:
   ```js
   pending_visits.add({
     visit_id, session_id, store_id, user_id,
     check_in_time, check_in_location,
     observations, status,
     synced: false,
     created_at: new Date().toISOString()
   })
   pending_photos.add({
     visit_id,
     photo_blob: <base64 string>,  // captured from canvas/file
     uploaded: false
   })
   ```
4. UI shows ⏳ badge on the visit card: "Pendiente de sincronización".

### Sync (When Online)
**Path A — Background Sync API (Chrome/Android):**
1. On form submit, register a Background Sync tag: `sw.sync.register('sync-visits')`.
2. Service worker listens for `sync` event.
3. On `sync` event: read all `pending_visits` and `pending_photos` from Dexie.
4. For each pending visit:
   a. Upload photo blob to Supabase Storage → get URL.
   b. Insert `visits` record with `synced: true`.
   c. Delete from Dexie `pending_visits` and `pending_photos`.
5. Notify UI to remove ⏳ badge (via `BroadcastChannel` or `postMessage`).

**Path B — Foreground Fallback (iOS Safari / Firefox):**
1. Listen to `window.addEventListener('online', syncPendingVisits)`.
2. Also trigger on `document.addEventListener('visibilitychange')` when `document.visibilityState === 'visible'`.
3. Same sync logic as Path A steps 4a-4d.

## Service Worker Registration
- File: `hub/public/sw.js` (generated/augmented by `@ducanh2912/next-pwa`).
- Custom sync handler registered in `hub/public/sw-custom.js`:
  ```js
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-visits') {
      event.waitUntil(syncAllPendingVisits());
    }
  });
  ```

## UI States
| State | UI Indicator |
|---|---|
| Synced | ✅ Green checkmark |
| Pending sync | ⏳ Orange badge "Pendiente" |
| Sync failed | 🔴 Red badge "Error — reintentando" |

## Edge Cases
- **IndexedDB quota exceeded:** Show warning and block new check-ins until sync resolves.
- **Supabase returns 4xx (auth error during sync):** Do NOT delete from queue. Prompt re-login, then retry.
- **Photo blob > 5MB:** Compress to JPEG 0.7 quality before storing in IndexedDB.
