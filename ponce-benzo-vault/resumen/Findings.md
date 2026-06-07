---
title: Hallazgos Técnicos e Investigación
date: 2026-05-22
tags:
  - resumen
  - investigacion
  - hallazgos
  - limitaciones
---

# Hallazgos Técnicos e Investigación — Ponzivenzo Smart Tracker

Este documento compila el historial de descubrimientos técnicos, decisiones de infraestructura e investigación del comportamiento de sensores en dispositivos móviles.

---

## 🔎 Descubrimientos de Investigación

### 1. Decisiones de Arquitectura: Split Web + Mobile
* **Decisión:** Mantener una arquitectura separada (Next.js en `/hub` para oficina, y React Native Expo en `/mobile` para mercaderistas).
* **Razonamiento:**
  * Las aplicaciones PWA basadas en navegador imponen severas limitaciones en iOS y Android para el rastreo por GPS continuo en segundo plano (matan el proceso si el navegador se minimiza o la pantalla se apaga).
  * Construir una app nativa en Android/iOS con Expo Go y SDK nativo resuelve el rastreo de ubicación continuo gracias a `expo-task-manager` y `expo-location`.

### 2. Implementación de Cámara Anti-Fraude
* **Móvil:** `expo-camera` se configura para usar exclusivamente la cámara trasera (`facing="back"`). No se importan ni configuran métodos de selección de archivos del almacenamiento del dispositivo.
* **Seguridad:** Al forzar la captura en vivo sin selector de galería (`ImagePicker`), prevenimos la falsificación de reportes con imágenes previas de otras visitas.

### 3. Sincronización y Cola de Persistencia Local (SQLite)
* **Patrón Offline:** Uso de la API `expo-sqlite` para definir tablas locales de visitas (`visits`), jornadas (`sessions`) y pings de coordenadas (`location_pings`).
* **Sincronización:** Se utiliza un servicio periódico o detector de conectividad que barre los registros locales con `synced = false`, realiza la subida en lote de registros y fotos a Supabase y, tras recibir la confirmación de la API, marca los registros locales como `synced = true`.

### 4. Configuración de Geolocalización (GPS)
* **Precisión:** Se configura `Location.Accuracy.High` (en primer plano) y `Location.Accuracy.Balanced` (en segundo plano) para obtener coordenadas GPS con un margen de error menor a 15 metros.
* **Geofencing de Tiendas:** Cálculo de distancia utilizando la fórmula **Haversine** (para determinar la separación en metros entre dos coordenadas geográficas). Si el check-in se realiza a más de 200 metros de la ubicación maestra de la tienda (`master_lat`, `master_lng`), el sistema lo registra pero lo marca automáticamente con una alerta de anomalía (`location_verified: false`).

---

## ⚠️ Limitaciones y Restricciones del Sistema

- **HTTPS Obligatorio:** Las peticiones de geolocalización y APIs de seguridad en el panel del supervisor exigen conexiones seguras. Vercel provee HTTPS automáticamente para producción; en desarrollo local se permite `localhost`.
- **Restricción de Windows en Expo:** NativeWind v4 requiere configuraciones ESM específicas en Windows que causan el crash `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Por ende, está **estrictamente prohibido usar NativeWind/Tailwind** en la app móvil; todos los componentes móviles deben usar `StyleSheet.create()`.

---

## Enlaces Relacionados
- [[Resumen General]] — Resumen de stack y archivos.
- [[Constitucion]] — Reglas y schemas del proyecto.
- [[arquitectura/03_offline_sync|SOP 03 - Sincronización Offline]] — Lógica de colas y reconexión.
