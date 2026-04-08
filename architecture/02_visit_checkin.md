# SOP 02: Visit Check-In (Registro de Tienda)

## Goal
Record a complete, tamper-resistant visit to a store: GPS stamp, mandatory camera photo, and optional observations. Push to Supabase when online; queue locally when offline.

## Trigger
User taps a store card in the **Active Route** screen.

## Preconditions
- An active session must exist (`session_id` in `sessionStorage`).
- GPS coordinates must be available (requested again at check-in for precision).

## Flow

1. User taps store → Navigate to **Check-In Screen** for that store.
2. App re-requests GPS: `navigator.geolocation.getCurrentPosition()` (to capture arrival coords).
3. **Photo Capture** (see SOP 04 for anti-fraud rules):
   - Mobile: Render `<input type="file" accept="image/*" capture="environment">`.
   - Desktop: Open `getUserMedia({ video: true })` webcam modal → allow capture of a frame.
   - User CANNOT submit form without at least 1 photo.
4. User fills optional **Observations** text field.
5. User selects **Status**: `completed` | `skipped` | `anomaly`.
6. User taps **"Registrar Visita"**.
7. App generates `visit_id` (uuid v4).
8. **Connectivity check:**
   - **Online:** Upload photo to Supabase Storage → get signed URL → write `visits` record with `synced: true`.
   - **Offline:** Save full payload to IndexedDB (Dexie.js) with `synced: false`. Show ⏳ badge. (See SOP 03).
9. Return to Active Route screen. Mark store as ✅ completed.

## Check-In Payload (visits table)
```json
{
  "visit_id": "<uuid>",
  "session_id": "<from sessionStorage>",
  "store_id": "<uuid>",
  "user_id": "<auth.uid>",
  "check_in_time": "<ISO8601>",
  "check_in_location": { "lat": <float>, "lng": <float> },
  "photo_urls": ["<supabase-storage-url>"],
  "observations": "<string | null>",
  "status": "completed | skipped | anomaly",
  "synced": true
}
```

## Supabase Storage Path
`visit-photos/{user_id}/{visit_id}/{timestamp}.jpg`

## Edge Cases
- **No photo captured:** Form submission is BLOCKED. Error: "La foto del punto de venta es obligatoria."
- **GPS denied mid-flow:** Alert user. Check-in location is recorded as `null`. Flag visit with `status: anomaly`.
- **Photo upload fails (network error):** Full payload queued in IndexedDB as `synced: false`. Photo binary stored as base64 blob in IndexedDB until sync.

## Database Table: `visits`
| Column | Type | Notes |
|---|---|---|
| `visit_id` | uuid | PK |
| `session_id` | uuid | FK → `sessions.session_id` |
| `store_id` | uuid | FK → `stores.store_id` |
| `user_id` | uuid | FK → `users.id` |
| `check_in_time` | timestamptz | |
| `check_in_location` | jsonb | `{ lat, lng }` |
| `photo_urls` | text[] | Supabase Storage URLs |
| `observations` | text | Nullable |
| `status` | text | enum: completed/skipped/anomaly |
| `synced` | boolean | Default false, true after push |
