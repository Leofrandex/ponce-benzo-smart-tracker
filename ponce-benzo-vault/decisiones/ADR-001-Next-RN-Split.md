---
title: "ADR-001: Split de Arquitectura Dual (Next.js + React Native Expo)"
date: 2026-05-22
status: aceptado
tags:
  - adr
  - decisiones
  - arquitectura
---

# ADR-001: Split de Arquitectura Dual (Next.js + React Native Expo)

* **Estado**: `aceptado`
* **Fecha**: 2026-05-22
* **Autores**: Agente de IA & Usuario

---

## Contexto
Originalmente, el proyecto **Ponzivenzo Smart Tracker** estaba planificado como una Progressive Web App (PWA) de Next.js unificada, donde tanto los supervisores como los mercaderistas usaban la misma plataforma web en navegadores móviles/escritorio.

Sin embargo, el requerimiento crítico del negocio es el **rastreo GPS continuo y en segundo plano** de los mercaderistas para certificar las visitas y generar mapas de calor precisos. Durante el desarrollo inicial, se identificaron severas restricciones técnicas en los navegadores móviles (especialmente iOS Safari y modos de ahorro de energía en Android) que suspenden el ciclo de ejecución de las pestañas web en segundo plano, impidiendo la captura confiable del tracking de geolocalización.

## Decisión
Se decidió dividir el proyecto en dos repositorios/carpetas independientes dentro de un mismo espacio de trabajo (monorepo o carpetas vecinas):

1. **`ponce/hub` (Next.js 14 App Router + Tailwind CSS)**:
   - Panel web enfocado exclusivamente en supervisores y administradores.
   - Responsable del monitoreo en tiempo real, tableros de control con gráficos (Recharts), asignación de tareas y rutas, y visualización de mapas (Leaflet).
2. **`ponce/mobile` (React Native Expo + TypeScript)**:
   - Aplicación móvil nativa compilada para Android e instalada en los teléfonos de los mercaderistas.
   - Responsable de la lógica de negocio en campo: check-in geolocalizado, captura de fotos mediante cámara nativa (anti-fraude) y tracking GPS persistente.

## Consecuencias
### Positivas 👍
- **Tracking GPS Robusto**: Posibilidad de usar APIs nativas a través de `expo-location` (`startLocationUpdatesAsync`) para seguir recolectando coordenadas GPS con la pantalla apagada.
- **Resiliencia Offline Real**: Uso de `expo-sqlite` para una base de datos local y duradera que almacene visitas y fotos antes de subirlas cuando haya red.
- **Seguridad y Control Anti-Fraude**: Capacidad de obligar a los usuarios a usar la cámara en vivo a través de `expo-camera`, inhabilitando la selección de imágenes de la galería del teléfono.
- **UX Premium**: Interfaces fluidas nativas y manejo consistente del ciclo de vida del dispositivo móvil.

### Negativas / Riesgos 👎
- **Duplicidad de Modelos / Tipos**: Se debe mantener coherencia de tipos y modelos de datos entre Next.js y React Native de manera manual (o usando un esquema Supabase centralizado).
- **Proceso de Distribución**: La app móvil no se distribuye a través de una URL simple, sino que requiere generar compilaciones (.apk) para los dispositivos Android de los mercaderistas.

## Enlaces Relacionados
- [[resumen/Constitucion|Constitución del Proyecto (Reglas inmutables)]]
- [[arquitectura/Arquitectura General|Arquitectura General]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
