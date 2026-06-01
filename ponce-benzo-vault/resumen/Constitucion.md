---
title: Constitución del Proyecto
date: 2026-05-22
tags:
  - resumen
  - constitucion
  - reglas
  - schemas
---

# Constitución del Proyecto — Ponzivenzo Smart Tracker

> [!WARNING]
> Este archivo representa la constitución y reglas inmutables de desarrollo. Todo código, arquitectura y base de datos debe cumplir estrictamente con lo aquí definido.

---

## 🏛️ Invariantes Arquitectónicos

### Regla de la Payload Completa
El estado "Completo" de un check-in de visita exige de forma obligatoria:
1. Un registro insertado en la tabla `visits` en Supabase con el flag `synced = true`.
2. Al menos una foto cargada con éxito en el storage de Supabase (`visit-photos/`).

### Origen de la Verdad (Canonical Source of Truth)
- **Local:** La base de datos local `expo-sqlite` en el móvil es el buffer temporal.
- **Remoto:** Supabase es la fuente canónica final.

---

## ⚙️ Reglas de Comportamiento (Behavioral Rules)

### 1. Responsividad Multirresolución
El panel web (`hub`) y la app móvil (`mobile`) deben ser completamente adaptativos y fluidos. La interfaz no debe romperse ni desbordarse en ninguna densidad de píxeles o tamaño de pantalla.

### 2. Ciclo de Vida de una Ruta (Jornada)
La sesión de ruta de un mercaderista sigue un ciclo de vida estrictamente controlado:
* El mercaderista inicia la jornada de forma explícita presionando **"Empezar Ruta"**.
  * Se solicita y valida el permiso de GPS del dispositivo.
  * Se registra un evento `session_start` con el timestamp actual, `user_id` y las coordenadas GPS iniciales.
* La jornada solo se da por terminada tras presionar **"Finalizar Ruta"**, lo cual registra el timestamp `session_end` y apaga los sensores.

### 3. Cámara Anti-Fraude
* La captura de fotos en el check-in se realiza **exclusivamente a través de la cámara del dispositivo** en tiempo real.
* **Prohibición:** Está estrictamente vetado el acceso al selector de archivos o galería de imágenes del dispositivo móvil para evitar la carga de archivos antiguos o falsificados.

### 4. Tolerancia y Resiliencia Offline
* En caso de pérdida de red, todos los registros de check-in, coordenadas y URIs de fotos locales se guardan en la base de datos `sqlite` con `synced = 0`.
* Se muestra un indicador visual (ej. `⏳ Pendiente de sincronización`) en las pantallas correspondientes.
* Al recuperar conexión, un proceso silencioso en segundo plano sincroniza la cola acumulada y actualiza el estado a `synced = 1`.

---

## 📐 Esquemas de Datos (Data Schemas)

### Esquema de Entrada (Datos que la App recopila localmente)
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
    "anomaly_type": "enum: sin_stock | cambio_planograma | diferencia_precios | producto_danado | otro | null",
    "skip_reason": "enum: fuera_de_ruta | sin_acceso | otro | null",
    "last_restock_date": "ISO8601 date | null",
    "synced": "boolean"
  }
}
```

### Rutas de Storage en Supabase
Las fotos de visitas deben almacenarse con la siguiente estructura de carpetas:
`visit-photos/{user_id}/{visit_id}/{timestamp}.jpg`

---

## Enlaces Relacionados
- [[Resumen General]] — Visión general y stack del proyecto.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — Tablas relacionales y políticas RLS.
- [[arquitectura/04_anti_fraud_camera|SOP 04 - Cámara Anti-Fraude]] — Reglas específicas del uso de la cámara.
