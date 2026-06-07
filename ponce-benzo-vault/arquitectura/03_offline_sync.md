---
title: SOP 03 - Sincronización Offline y Resiliencia
date: 2026-05-22
tags:
  - arquitectura
  - sop
  - offline
  - sqlite
  - sync
---

# SOP 03: Sincronización Offline y Resiliencia Operativa

## Objetivo
Garantizar la protección absoluta de los datos recolectados por el mercaderista durante su jornada diaria en campo. Toda información guardada en ausencia de red debe retenerse y transmitirse silenciosamente a Supabase apenas se reestablezca la conectividad.

---

## Arquitectura de Almacenamiento Local

* **Base de Datos:** SQLite administrada a través de `expo-sqlite` (base de datos: `poncebenzo.db`).
* **Archivos Binarios (Imágenes):** Almacenamiento físico directo en el directorio persistente de la aplicación usando `expo-file-system`.
* **Tablas Involucradas en SQLite:**
  - `sessions` — Historial de jornadas iniciadas.
  - `visits` — Reportes de check-in locales con columna `synced` (0 = no sincronizado, 1 = sincronizado).
  - `location_pings` — Coordenadas de rastreo continuo acumuladas.

---

## Mecanismo de Sincronización

### 1. Guardado en Cola (Cuando está Offline)
1. El mercaderista envía la visita.
2. Si falla la llamada a la API de Supabase o se detecta que no hay conexión de red:
   * Inserta el registro en la tabla `visits` de SQLite local:
     ```sql
     INSERT INTO visits (visit_id, session_id, store_id, user_id, check_in_time, lat, lng, photo_uri, observations, status, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ```
   * Mueve el archivo temporal de la foto a una ubicación persistente en el dispositivo (`FileSystem.documentDirectory + "photos/" + visit_id + ".jpg"`).
   * Incrementa el conteo de sincronizaciones pendientes en el contexto (`pendingSyncCount`).
3. Muestra un banner en la pantalla principal: `⏳ X visitas pendientes de sincronización`.

### 2. Vaciado de Cola (Al recuperar conexión)

El sistema intenta sincronizar los datos acumulados por dos vías redundantes:

#### Vía A: Sincronización en Segundo Plano (Background Fetch)
1. Se define una tarea nativa en segundo plano utilizando `expo-task-manager` y `expo-background-fetch`.
2. El sistema operativo despierta la tarea periódicamente (mínimo cada 15 minutos).
3. La tarea:
   * Consulta los registros en SQLite con `synced = 0`.
   * Por cada registro:
     1. Lee el archivo binario de la imagen del disco local y lo sube al Storage de Supabase (`visit-photos/`).
     2. Inserta el registro de la visita en la tabla remota `visits` de Supabase vinculando la URL de Storage obtenida.
     3. Actualiza el registro de SQLite local a `synced = 1`.
     4. Elimina la foto del almacenamiento local del teléfono para liberar espacio.

#### Vía B: Sincronización en Primer Plano (Foreground NetInfo)
1. Al detectar un evento de reconexión de red (`NetInfo` pasa a `isConnected = true`), la aplicación ejecuta inmediatamente la misma lógica de vaciado de cola descrita en la Vía A.

---

## Casos de Borde y Excepciones

- **Falta de espacio en almacenamiento local:** Si el dispositivo se queda sin memoria para guardar fotos, la aplicación bloquea nuevas visitas y muestra una advertencia destructiva instando a liberar espacio.
- **Error de autenticación durante la sincronización:** Si Supabase rechaza la sincronización por token expirado, la app retiene los datos locales intactos y solicita al usuario volver a iniciar sesión para completar la subida.

---

## Enlaces Relacionados
- [[Esquema Base Datos]] — Estructura de las tablas SQLite locales.
- [[02_visit_checkin]] — Flujo de registro y generación del check-in.
