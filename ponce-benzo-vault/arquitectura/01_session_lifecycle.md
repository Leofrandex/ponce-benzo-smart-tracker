---
title: SOP 01 - Ciclo de Vida de la Sesión
date: 2026-05-22
tags:
  - arquitectura
  - sop
  - sesion
  - gps
---

# SOP 01: Ciclo de Vida de la Sesión (Empezar / Finalizar Ruta)

## Objetivo
Controlar el ciclo de vida completo de la sesión de ruta de un mercaderista —desde su inicio explícito hasta su finalización— garantizando que todas las coordenadas de GPS y marcas de tiempo queden registradas fielmente en Supabase.

---

## Desencadenante
El usuario presiona el botón **"Empezar Ruta"** en la pantalla principal de la app móvil.

---

## Precondiciones
- El usuario debe estar autenticado (sesión activa en Supabase Auth).
- Debe existir una ruta asignada para el día actual (`routes` correspondiente al `user_id` y fecha de hoy).
- Se deben otorgar los permisos de GPS (foreground y background) antes de poder registrar cualquier dato de la sesión.

---

## Flujo del Proceso

### 1. Iniciar Sesión (Empezar Ruta)
1. La aplicación solicita permisos de GPS utilizando `expo-location`:
   * `Location.requestForegroundPermissionsAsync()`
   * `Location.requestBackgroundPermissionsAsync()`
2. Si el permiso de GPS es **denegado** → Muestra un modal de bloqueo: *"Necesitamos acceso a tu ubicación en todo momento para registrar la ruta. Autorízalo en los ajustes del dispositivo."*
3. Si el permiso es **concedido** → Captura la ubicación inicial `{ lat, lng }` usando `Location.getCurrentPositionAsync()`.
4. Genera un identificador único de sesión `session_id` (UUID v4).
5. Escribe el registro en la tabla `sessions` de SQLite (para persistencia offline) y realiza el intento de inserción en la base de datos de Supabase:
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
6. Guarda el `session_id` activo en la memoria persistente del dispositivo.
7. Inicializa el tracking geográfico continuo en segundo plano usando `Location.startLocationUpdatesAsync('BACKGROUND_LOCATION_TASK')`.
8. Cambia el estado de la interfaz móvil a **Ruta Activa**.

### 2. Finalizar Sesión (Finalizar Ruta)
1. El usuario presiona el botón **"Finalizar Ruta"**.
2. Muestra un modal de confirmación: *¿Confirmas que terminaste todas las visitas del día?*
3. Al confirmar:
   * Realiza un parche (PATCH/UPDATE) en la tabla `sessions` para registrar `session_end = NOW()`.
   * Detiene el rastreo continuo: `Location.stopLocationUpdatesAsync('BACKGROUND_LOCATION_TASK')`.
   * Remueve el `session_id` activo de la memoria persistente del dispositivo.
4. Transiciona la UI a la pantalla de resumen del día de trabajo con la lista de visitas.

---

## Casos de Borde y Excepciones

- **Cierre inesperado de la aplicación (Crash/Reinicio):** Al abrir la app, el proveedor `RouteProvider` busca si hay un `session_id` activo guardado localmente. Si existe, restaura la sesión y la UI correspondiente. Si la sesión corresponde a un día anterior, obliga al usuario a cerrarla de inmediato.
- **Pérdida temporal de señal GPS:** Si el sensor no reporta señal, las peticiones fallidas se omiten en el tracking en vivo, pero el foreground watcher sigue activo para reintentar la obtención de coordenadas apenas sea posible.

---

## Enlaces Relacionados
- [[Resumen General]] — Visión general y stack del proyecto.
- [[02_visit_checkin]] — SOP para el registro de check-in en una tienda.
- [[03_offline_sync]] — Sincronización en segundo plano de la jornada y coordenadas.
