---
title: Resumen General
date: 2026-05-22
tags:
  - resumen
  - general
  - ponzivenzo
---

# Resumen General — Ponzivenzo Smart Tracker

**Ponzivenzo Smart Tracker** es una aplicación de seguimiento y control de rutas para mercaderistas de campo. Cuenta con un sistema de verificación geográfica de visitas mediante check-ins con foto y GPS, y permite a los supervisores monitorear y asignar tareas en tiempo real.

---

## 🛠️ Stack Tecnológico

El proyecto está diseñado bajo una **Arquitectura Dual** separada para satisfacer las necesidades específicas de los mercaderistas en campo y los supervisores en oficina.

- **Panel de Supervisión (Web):** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Recharts (para métricas y gráficos) + Leaflet (para el mapa de calor y tracking en vivo).
- **Aplicación del Mercaderista (Móvil):** React Native (Expo) + TypeScript + `StyleSheet` nativo (sin Tailwind/NativeWind para garantizar estabilidad en Windows) + sensores de hardware (`expo-location`, `expo-camera`) + persistencia local (`expo-sqlite`).
- **Backend y Base de Datos:** Supabase (PostgreSQL + extensión PostGIS para cálculos geográficos + Storage para fotos + Auth).

---

## 📂 Estructura de la Aplicación

La base del código está organizada en dos directorios principales:

### 1. Panel de Supervisión Web (`hub/`)
Contiene la aplicación de administración construida en Next.js. Los componentes y rutas móviles fueron eliminados para concentrar la lógica en los supervisores.
- **Ruta Raíz:** Login de acceso.
- **Rutas de Supervisor `(supervisor)/`:**
  - `/supervisor` — Dashboard principal con analíticas de visitas.
  - `/supervisor/contactos` — Directorio y fichas de tiendas y clientes.
  - `/supervisor/tareas` — Asignador y monitor de tareas para mercaderistas.
  - `/supervisor/mapa` — Ubicación en tiempo real y mapa de calor de recorridos.

### 2. Aplicación Móvil Nativa (`mobile/`)
Proyecto en Expo SDK 54 enfocado en una experiencia *Offline-First* con acceso directo a sensores de hardware.
- `App.tsx` — Enrutador raíz y envoltura de proveedores (Auth, SQLite, Route).
- `src/navigation/` — Navegación nativa con pestañas inferiores (`Ruta`, `Historial`, `Perfil`).
- `src/screens/` — Pantallas de inicio de sesión, listado de la ruta activa, formulario de check-in, historial del día y perfil de usuario.

---

## 🔋 Patrones Clave de Funcionamiento

### 📍 Ubicación GPS Continua (Segundo Plano)
Para evitar limitaciones que los navegadores móviles imponen sobre las PWAs, el tracking del mercaderista se realiza nativamente:
* Al presionar **"Empezar Ruta"**, se solicita permiso de ubicación en segundo plano.
* Se inicia un servicio continuo (`expo-location` + `expo-task-manager`) que captura y reporta la ubicación cada 30 segundos o 50 metros.
* Los pings se guardan en la tabla local `location_pings` de SQLite.

### 📶 Resiliencia Offline (Offline-First)
* Si hay conexión a internet, las visitas y fotos se envían inmediatamente a Supabase.
* En zonas sin cobertura, se guardan en SQLite local con el flag `synced = 0`.
* Un banner en la interfaz indica los reportes pendientes de sincronización.
* Al restablecerse la conexión, un background fetch limpia la cola hacia Supabase.

### 📸 Cámara Anti-Fraude
* La evidencia fotográfica del check-in se captura **únicamente** con la cámara nativa en vivo (`expo-camera`).
* El acceso a la galería de fotos está **bloqueado en el código** para evitar la carga de fotos antiguas o falsificadas.
* El botón para registrar la visita solo se activa si hay coordenadas GPS actuales válidas y al menos una foto tomada.

---

## 📊 Resumen de Datos de Prueba (Mock Data)

Para desarrollo local, se utiliza la data mockeada definida en `src/mock-data.ts`:

| Entidad | Cantidad | Detalles |
| :--- | :---: | :--- |
| **Tiendas (`mockStores`)** | 12 | Farmatodo (5), Gama (3), Locatel (2), SAAS (2) — en Caracas |
| **Supervisores (`mockSupervisor`)** | 1 | Ana Martínez |
| **Mercaderistas (`mockMerchandisers`)** | 4 | Carlos, Luis, María, Andrés |
| **Tareas (`mockTasks`)** | 12 | Restablecimiento, gestión, problemas de precio, etc. |
| **Reportes de Visita (`mockReports`)** | 17 | Registros de visitas con estados, duraciones y fotos |

---

## Enlaces Relacionados
- [[Constitucion]] — Reglas del proyecto y esquemas de datos.
- [[arquitectura/Arquitectura General|Arquitectura General]] — Detalles del split de código y módulos.
- [[roadmap/Roadmap|Roadmap del Proyecto]] — Próximos hitos y tareas.
