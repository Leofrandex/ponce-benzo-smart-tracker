---
title: Bitácora de Sesiones (Logs)
date: 2026-05-22
tags:
  - logs
  - indice
---

# Bitácora de Sesiones (Logs) — Ponzivenzo Smart Tracker

Este documento es el índice principal de todos los logs de sesión de desarrollo. Registra el progreso paso a paso de cada día de trabajo para mantener la trazabilidad de los cambios.

## 📅 Historial de Sesiones

| Fecha | Sesión / Log | Resumen de Cambios | Estado |
| :--- | :--- | :--- | :--- |
| 2026-06-15 | [[logs/Log-2026-06-15\|Log-2026-06-15 (Nivel Cliente + Piloto Farmatodo)]] | Nivel **Cliente (cadena)**: tabla `clients` + FK/columnas en stores (migración). **Piloto Farmatodo** re-poblado desde el Excel (fuente de verdad): 4 cadenas, **45 tiendas** (36 act. + 9 creadas) con GPS/dirección/encargado, **76 rutas** nuevas (mercaderista+día, horizonte 4 sem.), 154 no-piloto desactivadas, alta de Jonathan. Hub: tab **Tiendas** + filtro por cliente + página **Clientes**. Diagnóstico: el mapa en vivo falla porque el móvil no sube data (0 pings). ADR-004. Rama `feature/nivel-cliente-piloto-farmatodo`. | Completado |
| 2026-06-08 | [[logs/Log-2026-06-08-mobile-login\|Log-2026-06-08 (Mobile Login + Rutas)]] | Mobile cableado a Supabase (6 tareas subagent-driven): cliente Supabase (AsyncStorage), login real con sesión persistida, `pickRoute` (hoy/fallback) + `routesApi`, RouteContext carga la ruta real (loading/error/reload), pantallas con estados + fecha. Verificado E2E con JWT: Carlos ve solo sus 5 rutas; la del lunes 32 tiendas reales. Sync/fotos/GPS = siguiente. Rama `feature/mobile-login-rutas`. | Completado |
| 2026-06-08 | [[logs/Log-2026-06-08-hub-escritura\|Log-2026-06-08 (Hub Escritura CRM)]] | Escritura del hub habilitada (6 tareas subagent-driven): RPC `fn_set_primary_contact` (encargado único atómico), módulo de mutaciones, componentes controlados, ficha con edición de sucursal/contactos/engagements y resolver tareas. Verificado E2E con JWT: Milagros escribe (incl. encargado único); Carlos (mercaderista) bloqueado por RLS (0 filas / 403). Rama `feature/hub-escritura-crm`. | Completado |
| 2026-06-08 | [[logs/Log-2026-06-08-hub\|Log-2026-06-08 (Cablear Hub a Supabase)]] | Hub cableado a Supabase (fundación + lectura, 10 tareas subagent-driven): `@supabase/ssr` + middleware (guard `/supervisor`), auth real, hook `useSupabaseQuery`, agregación pura con tests, y las 5 superficies leyendo datos reales (192 tiendas). Auth y RLS verificados E2E vía JWT (Milagros ve su equipo; Rosli ve todo). Rama `feature/cablear-hub-supabase`. | Completado |
| 2026-06-08 | [[logs/Log-2026-06-08\|Log-2026-06-08 (Ingesta de Datos)]] | Pipeline de ingesta idempotente a `poncebenzo`: helpers + parser de RUTAS con TDD (7/7 tests), y 3 etapas (usuarios/tiendas/rutas) + orquestador. Cargados **6 usuarios + 192 tiendas + 20 rutas**, verificado E2E e idempotente. Hallazgo: tiendas salen de RUTAS, no de MAESTRO (canal por cadena 76%). Solicitud de datos a P&B documentada. Rama `feature/ingesta-datos`. | Completado |
| 2026-06-07 | [[logs/Log-2026-06-07\|Log-2026-06-07 (Supabase v2.0)]] | Migración a Supabase — Fundación: proyecto recreado desde cero (`poncebenzo`), schema v2.0 consolidado aplicado vía MCP (location_pings, tasks open/resolved + description, competition visit_id, RLS endurecida, Storage), priority eliminado del hub, SQLite mobile alineado. Trigger de anomalías y handshake verificados E2E. ADR-003. Rama `feature/supabase-schema-v2`. | Completado |
| 2026-06-06 | [[logs/Log-2026-06-06\|Log-2026-06-06 (Correcciones UI)]] | Bloque correcciones de UI mobile + hub (mock-first, subagent-driven, 15 commits): tipografía Inter en mobile, competencia ligada al check-in + fotos múltiples, ficha de cliente v3 (alturas fijas, engagements funcionales, tareas 2 estados), Select propio, sidebar de filtros acordeón en mapa, DateRangeChips con calendario propio, marcadores con íconos. tsc 0 errores, lint limpio, build exitoso. | Completado |
| 2026-06-02 | [[logs/Log-2026-06-02-bloque-mobile\|Log-2026-06-02 (Bloque Mobile)]] | Bloque mobile (mock-data + SQLite): rutas especiales personalizables, agregar/quitar sucursal, fecha de última reposición, dropdowns de omisión/anomalía (Ionicons, bottom-sheet), reportaje de competencia (slide-over). Fix de `recordVisit` (payload completa ADR-002). 15 tareas subagent-driven, tsc en cero. | Completado |
| 2026-06-02 | [[logs/Log-2026-06-02\|Log-2026-06-02]] | Bloque hub (mock-data): Sección Clientes (filtros zona/canal/clasificación + ficha con contactos múltiples, cargo, última reposición, fotos; engagements y largo plazo como placeholders) y Mapa de calor rediseñado (modo claro, pestañas En vivo/Histórico, sucursales+mercaderistas, filtros, rango de fechas, framer-motion). | Completado |
| 2026-06-01 | [[logs/Log-2026-06-01\|Log-2026-06-01]] | Modelo de datos CRM: esquema Supabase (contacts, contact_engagements, tasks, competition, columnas nuevas, trigger anomalía→tarea, RLS) + SQLite local móvil + tipos TS. ADR-002. | Completado |
| 2026-05-22 | [[logs/Log-2026-05-22\|Log-2026-05-22]] | Creación y estructuración del Segundo Cerebro (Vault de Obsidian). | Completado |

---

## 🛠️ Cómo agregar un nuevo Log
1. Crea un nuevo archivo en esta carpeta con el nombre `Log-YYYY-MM-DD.md`.
2. Utiliza la plantilla [[templates/Template - Log|Template - Log]] para estructurarlo.
3. Rellena los metadatos YAML y las secciones correspondientes.
4. Agrega una nueva fila al inicio de la tabla en esta página enlazando la nota.
