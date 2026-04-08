# SOP 01: Session Lifecycle (Empezar / Finalizar Ruta)

## Goal
Control the full lifecycle of a Merchandiser route session — from explicit start to explicit end — ensuring all GPS data and timestamps are recorded faithfully in Supabase.

## Trigger
User taps **"Empezar Ruta"** button on the Route Hub screen.

## Preconditions
- User must be authenticated (Supabase Auth session active).
- A route must be assigned for the current day (`sessions.route_id` must exist).
- GPS permission must be granted BEFORE session is recorded.

## Flow

### START SESSION
1. UI calls `navigator.geolocation.getCurrentPosition()`.
2. If GPS permission DENIED → Show blocking modal: "Necesitamos acceso a tu ubicación para empezar la ruta. Actívalo en los ajustes de tu navegador."
3. If GPS permission GRANTED → capture `{ lat, lng }`.
4. Generate `session_id` (uuid v4).
5. Write to Supabase `sessions` table:
   ```json
   {
     "session_id": "<uuid>",
     "user_id": "<auth.uid>",
     "route_id": "<assigned_route_id>",
     "session_start": "<ISO8601>",
     "session_end": null,
     "start_location": { "lat": <float>, "lng": <float> }
   }
   ```
6. Store `session_id` in `sessionStorage` (survives page refresh, cleared on tab close).
7. UI transitions to **Active Route** screen.

### STOP SESSION
1. User taps **"Finalizar Ruta"** button.
2. Show confirmation modal: "¿Confirmas que terminaste todas las visitas del día?"
3. On confirm: PATCH `sessions` record → set `session_end = NOW()`.
4. Clear `session_id` from `sessionStorage`.
5. UI transitions to **Summary** screen showing visits completed today.

## Edge Cases
- **App closed mid-session:** On next app open, detect `session_id` in `sessionStorage`. If found, resume active session UI. If `sessionStorage` cleared (tab closed), prompt user to manually close lingering session.
- **GPS unavailable on desktop:** Warn user that location accuracy may be limited (IP-based). Do NOT block desktop usage — log `accuracy: "low"` in session record.

## Database Table: `sessions`
| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid | PK |
| `user_id` | uuid | FK → `users.id` |
| `route_id` | uuid | FK → `routes.id` |
| `session_start` | timestamptz | Set on start |
| `session_end` | timestamptz | Null until finalized |
| `start_location` | jsonb | `{ lat, lng }` |
