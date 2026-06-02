---
title: Roadmap del Proyecto
date: 2026-05-22
tags:
  - roadmap
  - planificacion
  - hitos
---

# Roadmap del Proyecto — Ponzivenzo Smart Tracker

Este documento detalla el estado actual del desarrollo y los próximos hitos a cumplir según las fases definidas para el proyecto.

---

## 🎯 Estado Actual: Fase 3 (Arquitectura e Integración)

Hemos completado el blueprint, la división de código (Split Web/Mobile) y la definición de esquemas de bases de datos. El foco actual es el desarrollo de las herramientas de ingesta de datos Excel y la migración de las interfaces mockeadas a producción conectándolas a Supabase.

---

## 📅 Hitos por Fase

### 🏁 Fase 0: Protocolo (Completado)
- [x] Crear `gemini.md` (Constitución del Proyecto).
- [x] Definir esquemas de datos JSON v1.0 en la constitución.
- [x] Resolver dudas iniciales con el equipo de negocio.

### 📐 Fase 1: Blueprint (Completado)
- [x] Establecer la arquitectura dual: Next.js (`hub`) y React Native Expo (`mobile`).
- [x] Definir e investigar los componentes anti-fraude y geolocalización.
- [x] Investigar la resiliencia offline en móviles (SQLite + FileSystem).

### 🔗 Fase 2: Link / Conectividad (Completado)
- [x] Inicializar el proyecto en Supabase (Base de datos PostgreSQL + PostGIS).
- [x] Crear el bucket de almacenamiento `visit-photos` en Supabase Storage.
- [x] Configurar las políticas de Row Level Security (RLS) en base de datos.
- [x] Configurar el enrutador y componentes iniciales de la app móvil.

### 🏗️ Fase 3: Arquitectura y Conexiones (En Desarrollo)
- [/] **Segundo Cerebro:** Estructurar el vault de Obsidian y migrar documentación raíz.
- [x] **Modelo de Datos CRM (esquema base completado):** Expansión del esquema Supabase con contactos, bitácora de engagements, tareas, reportes de competencia, jerarquía supervisor→vendedor, columnas de segmentación de tiendas y trigger anomalía→tarea. Reflejado en el SQLite local móvil y en los tipos TypeScript. Ver [[decisiones/ADR-002-Modelo-CRM|ADR-002]].
- [ ] **Ingesta de Datos:** Actualizar `tools/import-data.ts` para procesar y cargar los datos de `MAESTRO.xlsx` y `RUTAS 05-12-25 (1).xlsx` a Supabase de manera consolidada.
- [ ] **Configurar Variables de Entorno:** Generar `hub/.env.local` con las claves reales de la base de datos de producción.
- [ ] **Handshake de Producción:** Correr y verificar la respuesta con el script `tools/verify_supabase_connection.py`.
- [ ] **Sincronización Móvil:** Reemplazar el login y carga de rutas de prueba por llamadas reales a Supabase Auth y consultas SQLite -> Supabase.

### 🎨 Fase 4: Estilización y UX (En Desarrollo)
- [x] **Sección Clientes (hub, mock-data):** renombre de "Contactos" → "Clientes"; filtros geográficos jerárquicos + canal + clasificación; ficha de cliente descompuesta en componentes aislados que visualiza múltiples contactos, cargo, última reposición y fotos de reportes. Engagements/to-dos, histórico de rotación y anaquel ideal quedan como **placeholders** (CRM funcional a futuro). Ver [[logs/Log-2026-06-02|Log-2026-06-02]].
- [x] **Mapa de calor (hub, mock-data):** rediseño a modo claro, mapa único con pestañas En vivo/Histórico, sucursales por coordenadas, mercaderistas activos, filtros compartidos, rango de fechas en histórico, animaciones framer-motion. Eliminado el drill-down individual y el modo oscuro.
- [ ] Diseñar el panel de tareas en el supervisor hub con sistema Kanban/Lista interactivo (consumiendo la tabla `tasks` del modelo CRM; reconciliar los tipos mock `SupervisorTask`/`TaskType` con `DbTaskType`).
- [ ] **Bloque mobile:** rutas especiales, agregar sucursal a la ruta, dropdowns de anomalía/omisión (react-icons), `last_restock_date` en check-in, reportaje de competencia.
- [ ] Refinar las micro-animaciones y feedback visual de carga en la app móvil.
- [ ] Incorporar el banner visual dinámico de sincronizaciones pendientes (`SyncBanner`).

### 🚀 Fase 5: Despliegue y Pruebas Alpha (Pendiente)
- [ ] Desplegar el Next.js Supervisor Panel en Vercel.
- [ ] Realizar una prueba de piloto alpha con 2 mercaderistas de campo usando la aplicación móvil.
- [ ] Corregir fallos de rendimiento y sincronización detectados durante el piloto.

---

## Enlaces Relacionados
- [[resumen/Resumen General|Resumen General]] — Visión técnica e infraestructura.
- [[pendientes/Pendientes|Lista de Pendientes]] — Tareas y preguntas pendientes.
- [[logs/Session Logs|Bitácora de Desarrollo]] — Historial de cambios por sesión.
