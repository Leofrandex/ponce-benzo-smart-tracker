# SOP 04: Anti-Fraud Camera (Captura Segura de Imágenes)

## Goal
Guarantee that all visit photos are captured live via the device camera. Gallery uploads are strictly forbidden to prevent re-use of old photos.

## Rules (INVIOLABLE)
1. The file picker / gallery MUST NEVER be accessible for visit photos.
2. Every photo must be captured in real-time from the camera.
3. Photo capture must happen WITHIN the same check-in session (timestamp verified).

## Implementation by Platform

### Mobile (Android Chrome / iOS Safari)
```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  id="visit-photo-capture"
  style="display: none"
/>
```
- `capture="environment"` instructs the browser to open the rear camera directly.
- On Android Chrome: bypasses the gallery picker entirely.
- On iOS Safari: opens camera but may still show the "Photo Library" option as an OS-level sheet. This is a known iOS limitation. Mitigations:
  1. Add UI warning: "Debes tomar una foto EN ESTE MOMENTO. No se permiten fotos de la galería."
  2. In Phase 2+: implement EXIF timestamp validation on the server to reject photos > 5 min old.

### Desktop / Laptop (Chrome, Firefox, Edge)
1. Do NOT render `<input type="file">` at all on desktop.
2. Instead, open a `getUserMedia` webcam modal:
   ```js
   const stream = await navigator.mediaDevices.getUserMedia({
     video: { facingMode: 'environment', width: 1280, height: 720 }
   });
   ```
3. Display live video preview in a `<video>` element.
4. User clicks "Capturar" → draw frame to `<canvas>` → export as JPEG blob.
5. Close stream tracks after capture.
6. No file system access at any point.

## Detection Logic (Platform Switch)
```js
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
// OR use: window.matchMedia('(max-width: 768px)').matches

if (isMobile) {
  // Render <input capture="environment">
} else {
  // Open getUserMedia webcam modal
}
```

## Photo Validation (Before Upload)
- **Format:** JPEG only (convert PNG → JPEG client-side if needed).
- **Max size:** 5MB. Compress to JPEG 0.7 if larger.
- **Min resolution:** 640x480 (reject if too small — likely a corrupt file).
- **Timestamp:** Photo must be taken within the current check-in session (validated by app state, not EXIF in Phase 1).

## Edge Cases
- **Camera permission denied (mobile):** Block check-in. Show modal: "El acceso a la cámara es obligatorio para registrar la visita."
- **No camera hardware (desktop without webcam):** Show error and allow supervisor override (admin flag in DB). Log `photo_urls: []` with `status: anomaly`.
- **getUserMedia not supported (older browser):** Graceful degradation: show browser upgrade notice.
