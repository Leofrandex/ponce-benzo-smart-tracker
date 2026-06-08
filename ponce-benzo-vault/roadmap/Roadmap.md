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

### 🔗 Fase 2: Link / Conectividad (Completado — re-ejecutada 2026-06-07)
- [x] Inicializar el proyecto en Supabase (Base de datos PostgreSQL + PostGIS). **Re-creado desde cero** como `poncebenzo` con Schema v2.0 consolidado, ver [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]].
- [x] Crear el bucket de almacenamiento `visit-photos` en Supabase Storage (con políticas por carpeta `{user_id}/`).
- [x] Configurar las políticas de Row Level Security (RLS) en base de datos (v2.0 endurecida: trigger SECURITY DEFINER, tasks sin INSERT de cliente, supervisor read-only en competencia).
- [x] Configurar el enrutador y componentes iniciales de la app móvil.

### 🏗️ Fase 3: Arquitectura y Conexiones (En Desarrollo)
- [/] **Segundo Cerebro:** Estructurar el vault de Obsidian y migrar documentación raíz.
- [x] **Modelo de Datos CRM (esquema base completado):** Expansión del esquema Supabase con contactos, bitácora de engagements, tareas, reportes de competencia, jerarquía supervisor→vendedor, columnas de segmentación de tiendas y trigger anomalía→tarea. Reflejado en el SQLite local móvil y en los tipos TypeScript. Ver [[decisiones/ADR-002-Modelo-CRM|ADR-002]].
- [x] **Ingesta de Datos (2026-06-08):** `tools/import-data.ts` reescrito como pipeline idempotente (`tools/ingesta/`). Cargados 6 usuarios + 192 tiendas + 20 rutas del piloto a `poncebenzo`. Tiendas desde RUTAS (canal por cadena de MAESTRO, 76%); enriquecimiento (dirección/encargado/clasificación/GPS) pendiente de datos de P&B. Ver [[arquitectura/Ingesta - Mapeo de Datos|Mapeo]] y [[pendientes/Solicitud de Datos a P&B|Solicitud a P&B]].
- [x] **Schema v2.0 alineado con el UI (2026-06-07):** proyecto Supabase recreado desde cero y schema consolidado aplicado (location_pings, tasks open/resolved + description, competition visit_id, RLS endurecida, Storage). Hub sin `priority`; SQLite mobile alineado. Ver [[arquitectura/Spec - Supabase Schema v2|Spec v2.0]] y [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]].
- [x] **Configurar Variables de Entorno:** `hub/.env.local` y `.env` raíz con las claves reales del proyecto `poncebenzo` (2026-06-07).
- [x] **Handshake de Producción:** `tools/verify_supabase_connection.py` verificado OK contra el proyecto nuevo (env, DB, Storage, Auth) (2026-06-07).
- [x] **Cablear Hub a Supabase — Fundación + Lectura (2026-06-08):** `@supabase/ssr` + middleware (guard `/supervisor`), auth real, hook `useSupabaseQuery`, agregación pura con tests, y las 5 superficies leyendo datos reales (192 tiendas). Auth/RLS verificados E2E vía JWT. Escritura (CRUD) = sub-proyecto aparte. Ver [[arquitectura/Spec - Cablear Hub a Supabase|Spec]] y [[logs/Log-2026-06-08-hub|Log Hub]].
- [x] **Cablear Hub — Escritura (CRM) (2026-06-08):** editar sucursales (enriquecimiento), CRUD de contactos con encargado único (RPC `fn_set_primary_contact`), engagements y resolver tareas. Mutación+refetch, componentes controlados. Verificado E2E con JWT (RLS bloquea al mercaderista). Ver [[arquitectura/Spec - Hub Escritura CRM|Spec]] y [[logs/Log-2026-06-08-hub-escritura|Log]]. Pendiente menor: joins de nombres para gráficos/feed (dependen del mobile) y crear sucursales nuevas.
- [ ] **Sincronización Móvil:** Reemplazar el login y carga de rutas de prueba por llamadas reales a Supabase Auth y consultas SQLite -> Supabase (motor de sync + subida de fotos a Storage).

### 🎨 Fase 4: Estilización y UX (En Desarrollo)
- [x] **Sección Clientes (hub, mock-data):** renombre de "Contactos" → "Clientes"; filtros geográficos jerárquicos + canal + clasificación; ficha de cliente descompuesta en componentes aislados que visualiza múltiples contactos, cargo, última reposición y fotos de reportes. Engagements/to-dos, histórico de rotación y anaquel ideal quedan como **placeholders** (CRM funcional a futuro). Ver [[logs/Log-2026-06-02|Log-2026-06-02]].
- [x] **Mapa de calor (hub, mock-data):** rediseño a modo claro, mapa único con pestañas En vivo/Histórico, sucursales por coordenadas, mercaderistas activos, filtros compartidos, rango de fechas en histórico, animaciones framer-motion. Eliminado el drill-down individual y el modo oscuro.
- [x] **Bloque mobile (mock-data + SQLite):** rutas especiales (personalizables), agregar/quitar sucursal a la ruta, dropdowns de anomalía/omisión (Ionicons, bottom-sheet), `last_restock_date` en check-in, reportaje de competencia (slide-over). Fix de `recordVisit` (payload completa ADR-002). Ver [[logs/Log-2026-06-02-bloque-mobile|Log Bloque Mobile]].
- [x] **Bloque correcciones de UI 2026-06-06 (mock-first, completado):** tipografía Inter en mobile (`@expo-google-fonts/inter`), competencia ligada al check-in + fotos múltiples (URIs como JSON en `photo_uri TEXT`), ficha de cliente v3 (alturas fijas: Actividad 380 px / Engagements 320 px / Contactos 175 px, scroll interno, contactos unificados), engagements funcionales (mock local), tareas reducidas a dos estados `open`/`resolved`, Select propio en filtros de clientes, sidebar de filtros acordeón en mapa (230 px, borde navy, "Limpiar filtros"), DateRangeChips con calendario propio, marcadores con íconos diferenciados. tsc 0 errores, lint limpio, build exitoso. Ver [[logs/Log-2026-06-06|Log-2026-06-06]].
- [ ] Diseñar el panel de tareas en el supervisor hub con sistema Kanban/Lista interactivo (consumiendo la tabla `tasks` del modelo CRM; `SupervisorTask`/`TaskType` ya reconciliados a `open`/`resolved`).
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
