---
title: SOP 04 - Cámara Anti-Fraude
date: 2026-05-22
tags:
  - arquitectura
  - sop
  - camara
  - seguridad
---

# SOP 04: Cámara Anti-Fraude y Captura Segura de Imágenes

## Objetivo
Garantizar la veracidad física de los reportes en los puntos de venta. Se obliga al mercaderista a capturar la evidencia fotográfica en vivo en el momento exacto de la visita, previniendo por completo el uso de imágenes almacenadas o descargadas.

---

## Reglas Inviolables de Seguridad

1. **Bloqueo Absoluto de Galería:** En ningún componente o vista del formulario de visita se incluirá código que llame a selectores de archivos, galerías del sistema u otras herramientas de importación de archivos.
2. **Captura Exclusiva en Vivo:** Las imágenes únicamente se obtendrán instanciando el visor nativo de la cámara en primer plano.
3. **Cámara Trasera Forzada:** El visor de la cámara se configura únicamente con dirección posterior (`facing="back"`) para asegurar la toma del entorno de la tienda y no autorretratos (selfies).

---

## Implementación Técnica (React Native Mobile)

La app utiliza la librería `expo-camera` para incrustar el visor directamente en la pantalla de la aplicación móvil:

```tsx
import { CameraView } from 'expo-camera';

// Renderizado dentro de CameraModal.tsx
<CameraView 
  style={styles.camera} 
  facing="back" 
  ref={cameraRef}
>
  {/* Botón de captura y controles de cierre */}
</CameraView>
```

### Flujo de Captura:
1. El usuario presiona el recuadro de cámara en [[02_visit_checkin|CheckInScreen]].
2. Se solicita el permiso de hardware. Si se rechaza, se bloquea el formulario.
3. Se abre el visor nativo. El usuario presiona capturar → se ejecuta `cameraRef.current.takePictureAsync()`.
4. Se presenta un preview de la foto tomada. El usuario puede elegir "Retomar" o "Usar foto".
5. Al presionar "Usar foto", la URI de caché temporal se pasa al estado del check-in.

---

## Casos de Borde y Excepciones

- **Fallo de inicialización del hardware de cámara:** Si el componente nativo de la cámara falla al arrancar debido a fallos físicos del dispositivo, se muestra un mensaje de error detallado al usuario y el botón de check-in permanece inactivo.
- **Auditoría de fotos:** En el servidor de Supabase, las fotos se guardan con metadatos asociados (como el `timestamp` de subida y el `visit_id`). Los supervisores pueden contrastar la hora del registro del check-in contra la hora grabada en los metadatos de la imagen para detectar anomalías.

---

## Enlaces Relacionados
- [[Resumen General]] — Detalles del stack de desarrollo.
- [[02_visit_checkin]] — Pantalla de check-in donde se utiliza este componente.
