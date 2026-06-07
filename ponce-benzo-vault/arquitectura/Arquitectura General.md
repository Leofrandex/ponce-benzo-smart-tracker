---
title: Arquitectura General
date: 2026-05-22
tags:
  - arquitectura
  - general
  - system-design
---

# Arquitectura General — Ponzivenzo Smart Tracker

La plataforma se compone de dos aplicaciones independientes (frontend web y cliente móvil nativo) que interactúan a través de los servicios en la nube de **Supabase**.

```mermaid
graph TD
    subgraph Cliente Móvil [Mercaderista - Campo]
        RN[App React Native Expo] -->|SQLite| DB[(Base Datos Local)]
        RN -->|expo-location| BackgroundGPS[Continuous Tracking]
        RN -->|expo-camera| CameraCheckIn[Live Photo Capture]
    end

    subgraph Nube Supabase [BaaS - Backend]
        SAuth[Supabase Auth]
        SDB[(PostgreSQL + PostGIS)]
        SStorage[Storage Bucket: visit-photos]
    end

    subgraph Panel Web [Supervisor - Oficina]
        NextApp[App Next.js 14 Hub] -->|Queries/Realtime| SDB
    end

    RN -->|JWT Auth| SAuth
    RN -->|REST API / RLS| SDB
    RN -->|Photo Uploads| SStorage
    NextApp -->|JWT Auth| SAuth
```

---

## 💻 El Panel de Supervisión (`hub/`)

* **Framework:** Next.js 14 con App Router y TypeScript.
- **Propósito:** Actúa como el centro de control y visualización de la operación en campo. Es una interfaz responsiva optimizada para pantallas de escritorio.
- **Rutas Principales:**
  - `/supervisor` — Dashboard con gráficos acumulados de visitas de la jornada.
  - `/supervisor/contactos` — Listado de clientes y tiendas. Permite editar y ver detalles de visitas realizadas y programadas.
  - `/supervisor/tareas` — Panel interactivo estilo Kanban/Lista para delegar tareas y revisar sus resoluciones.
  - `/supervisor/mapa` — Visualización geográfica de recorridos y mapa de calor.

---

## 📱 La Aplicación Móvil (`mobile/`)

- **Framework:** React Native con Expo SDK 54.
- **Propósito:** Herramienta de trabajo del mercaderista de campo que prioriza el registro de actividades rápidas y la robustez offline.
- **Componentes de Navegación (`src/navigation/`):**
  - **AuthStack:** Control de acceso (`LoginScreen`).
  - **MainTabs (Bottom Tab Navigation):**
    - 🗺️ **Ruta (`RouteScreen`):** Lista de las tiendas a visitar en el día y estado de cada una.
    - 📋 **Historial (`VisitHistoryScreen`):** Reportes completados durante el día.
    - 👤 **Perfil (`ProfileScreen`):** Datos del vendedor, métricas de rendimiento y cierre de sesión.

### Flujo Operativo en Campo
```mermaid
sequenceDiagram
    Vendedor->>App: Iniciar Jornada (Empezar Ruta)
    App->>GPS: Activar watchPosition y background task
    App->>SQLite: Insertar nueva jornada (session_id)
    loop Ruta Diaria
        Vendedor->>App: Seleccionar Tienda
        App->>GPS: Verificar radio de tienda (< 200m)
        Vendedor->>App: Capturar Foto (Live Camera) + Nota
        Vendedor->>App: Presionar "Registrar Visita"
        App->>SQLite: Guardar visita (synced = false)
        App->>Supabase: Intentar subir reporte y foto
        alt Subida Exitosa
            App->>SQLite: Actualizar visita (synced = true)
        else Error de Red / Offline
            App->>App: Mantener en cola con bandera pendiente
        end
    end
    Vendedor->>App: Finalizar Jornada (Finalizar Ruta)
    App->>GPS: Apagar tracking y sensores
```

---

## Enlaces Relacionados
- [[resumen/Resumen General|Resumen General]] — Visión global del negocio.
- [[Esquema Base Datos]] — Detalles de tablas y RLS.
- [[01_session_lifecycle]] — Detalle de la máquina de estados de las sesiones.
- [[03_offline_sync]] — Lógica del motor de sincronización.
