---
title: SOP 02 - Registro de Tienda (Check-In)
date: 2026-05-22
tags:
  - arquitectura
  - sop
  - checkin
  - camara
  - gps
---

# SOP 02: Registro de Tienda (Check-In)

## Objetivo
Registrar una visita a tienda de forma segura e infalsificable: capturando coordenadas GPS precisas, exigiendo una foto capturada en vivo por la cámara trasera del dispositivo y permitiendo observaciones.

---

## Desencadenante
El mercaderista toca una tienda en la lista de la **Ruta Activa**.

---

## Precondiciones
- Debe existir una sesión de ruta activa (`session_id` persistido).
- Los permisos de geolocalización deben estar activos.

---

## Flujo del Proceso

1. El usuario selecciona la tienda → Se abre la pantalla de **Formulario de Check-In**.
2. La aplicación solicita la coordenada GPS actual con `Location.getCurrentPositionAsync()` para asegurar precisión de llegada.
3. Se activa el módulo de **Captura de Foto** (ver [[04_anti_fraud_camera]]):
   * La interfaz embebe directamente el visor de la cámara.
   * El botón para registrar la visita permanece bloqueado hasta que se tome y apruebe una foto en vivo.
4. El mercaderista introduce observaciones opcionales en el campo de texto.
5. El mercaderista selecciona el **Estado de la Tienda**:
   * `completed` (Completado)
   * `skipped` (Saltado / Omitido)
   * `anomaly` (Anomalía detectada)
6. Presiona **"Registrar Visita"**.
7. La aplicación genera un `visit_id` (UUID v4).
8. **Evaluación de Conectividad:**
   * **Online:** Sube la foto al bucket `visit-photos` de Supabase Storage, obtiene la URL pública, escribe el registro en la tabla `visits` de Supabase con `synced = true`.
   * **Offline:** Guarda el payload completo en la base de datos `sqlite` local con `synced = false` y guarda el archivo binario de la imagen en el almacenamiento local del dispositivo (`FileSystem.documentDirectory`). (Ver [[03_offline_sync]]).
9. Regresa a la lista de la ruta y marca la tarjeta de la tienda como completada (cambiando su color y badge de estado).

---

## Casos de Borde y Excepciones

- **Falta de evidencia fotográfica:** La interfaz bloquea físicamente la acción de enviar el reporte si no hay al menos una foto registrada. Muestra un banner explicativo indicándolo.
- **GPS inhabilitado durante el check-in:** Si por algún motivo el teléfono pierde señal de geolocalización, se emite una alerta, la coordenada se graba vacía (`null`) y la visita se califica automáticamente en la base de datos como anomalía de ubicación.
- **Fallo al subir la foto en red inestable:** Si el registro de base de datos se guarda pero la subida física del archivo de imagen falla, el registro de la visita se guarda localmente como `synced = false` para reintentar la subida del binario en la siguiente sincronización.

---

## Enlaces Relacionados
- [[Esquema Base Datos]] — Atributos de la tabla `visits`.
- [[03_offline_sync]] — Procesamiento de la cola de subidas pendientes.
- [[04_anti_fraud_camera]] — Invariantes de seguridad física para la cámara.
