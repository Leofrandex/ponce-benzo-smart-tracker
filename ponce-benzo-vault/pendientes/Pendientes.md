---
title: Lista de Pendientes
date: 2026-05-22
tags:
  - pendientes
  - dudas
  - datos
---

# Lista de Pendientes — Ponzivenzo Smart Tracker

Este documento almacena las preguntas por resolver, datos necesarios por parte del negocio y tareas de investigación técnica pendientes de resolver.

---

## 🛑 Bloqueadores Críticos (Datos Requeridos)

Para realizar la migración completa a producción y conectar a los vendedores reales, el equipo de negocio de Ponce & Benzo debe definir:

1. **Correos Electrónicos de Vendedores:** ✅ *Resuelto (2026-06-07)* — el usuario entregó los correos reales (dominio `@ponce-benzo.com`); se incorporarán como `tools/vendedores.json` (mapeo nombre→correo) en el sub-proyecto de Ingesta.

   **Decisión de alcance (2026-06-07):** la primera ingesta trabaja **solo con las 4 rutas definidas** en `RUTAS 05-12-25 (1).xlsx`. Set inicial de cuentas (6):
   * Merchandisers (con ruta): **Elvis Rondón, Willian Fermín, Eduward Martínez, Carlos Zurita**.
   * Supervisor: **Milagros Fernández** (gerente de los 4 según `ESTRUCTURA P&B - LP`).
   * Admin (ve todo): **Rosli Aponte** (Director de Ventas).

   **Personal pendiente de alta** (sin ruta en este Excel — se agregan cuando sus zonas entren al tracker):
   * Mercaderista sin ruta: Jonathan Fernández.
   * Asesores sin ruta individual: Betsy Castro, Joseph Padilla, Juan León, Martha Viloria.
   * Gerentes de otras zonas (→ supervisor a futuro): Andreina Rangel, Diana Delgado, Dubraska Pérez.
   * Administración (rol por definir): Nidia Rojas, Yelitze Pérez, Iris Mujica.
   * **"Aliado Comercial Caracas"** (`aliadocomercialcaracas@ponce-benzo.com`): correo genérico sin persona; posible relación con la **hoja 5 sin nombre** de `RUTAS` (mini-ruta Melani / Albita / Locatel La Castellana). Falta que el negocio aclare qué es y quién la atiende.
2. **Coordenadas GPS de Tiendas:**
   * *Problema:* Los Excel solo contienen direcciones de texto (ej. "Av. Principal local 3"). El geofencing anti-fraude requiere latitud/longitud numérica para verificar la cercanía de la foto.
   * *Acción:* Obtener las coordenadas maestras. Provisionalmente, la base de datos se inicializará con coordenadas del centro de Caracas (`10.4806, -66.9036`), que deberán actualizarse en la primera visita real del mercaderista (captura de posición inicial).

---

## ⚙️ Pendientes de Desarrollo Técnico

- [x] **Configuración de Variables de Entorno:** ✅ *(2026-06-07)* `hub/.env.local` y `.env` raíz con las claves del proyecto nuevo `poncebenzo`; handshake Python verificado.
- [x] **Modificar Ingesta de Excel:** ✅ *(2026-06-08)* `tools/import-data.ts` reescrito como pipeline idempotente (`tools/ingesta/`). Cargó 6 usuarios + 192 tiendas + 20 rutas. **Cambio de fuente:** las tiendas salen de `RUTAS`, no de MAESTRO (ver [[arquitectura/Ingesta - Mapeo de Datos|Mapeo]]). Falta el **enriquecimiento** de sucursales (dirección/encargado/clasificación/GPS) → [[pendientes/Solicitud de Datos a P&B|Solicitud a P&B]].
- [ ] **Validación de RLS Móvil:**
  * Probar que las llamadas a la base de datos de Supabase desde la app móvil respeten estrictamente la restricción de que un mercaderista solo vea sus propias visitas y rutas.
- [ ] **Compresión de Imágenes:**
  * Implementar compresión automática de imágenes utilizando `expo-image-manipulator` en la aplicación móvil antes de guardarlas en disco para evitar saturación del storage.

---

## 🧩 Pendientes del Modelo de Datos CRM (ADR-002)

- [ ] **Normalizar zona geográfica:** mover `stores.estado` / `municipio` / `urbanizacion` (hoy texto libre, decisión D3) a tablas lookup normalizadas a futuro para evitar inconsistencias de escritura.
- [x] **Restricción `tasks.status` en Supabase:** ✅ *(2026-06-07)* el schema v2.0 nace con `CHECK (status IN ('open','resolved'))`, columna `description` (el trigger copia las observaciones del check-in) y sin `priority` (eliminada también del UI del hub). Tipo `Task` del hub reconciliado.
- [/] **Cablear el bloque hub a Supabase:** ✅ *lectura hecha (2026-06-08)* — las 5 superficies leen datos reales vía RLS (`queries/*.ts` + `useSupabaseQuery`), auth real con `@supabase/ssr`. Ver [[logs/Log-2026-06-08-hub|Log Hub]]. **Falta la ESCRITURA** (CRUD de contactos/sucursales/engagements, resolver tareas) y los joins de nombres para los gráficos del dashboard y el feed de tareas (hoy en estado vacío). Ver siguiente ítem.
- [ ] **Cablear hub — escritura (CRM):** `EngagementsPanel` crear/cerrar → `contact_engagements`; CRUD de `contacts` (encargado único) y `stores`; resolver tareas (`tasks.status`). Reconciliar `SupervisorTask` (UI mock) con `Task`/`FullTaskRow` y joinar `visits`→`users` para mostrar nombres en `ActivityFeed`, `AnomaliesByClientChart`, `StoresPerMerchandiserChart`, `TasksProgress`.
- [ ] **CRM funcional (cablear engagements):** `EngagementsPanel` funciona sobre estado local (mock) desde la sesión 2026-06-06; al cablear, persistir crear/cerrar en `contact_engagements` de Supabase.
- [ ] **Cablear CRUD de contactos y de sucursales:** desde 2026-06-06 la ficha del cliente permite crear/editar/eliminar contactos (encargado único) y editar toda la info de la sucursal (zona, canal, clasificación, GPS, activa/desactivar); la lista de Clientes permite crear sucursales nuevas. Todo sobre estado local. Al cablear: INSERT/UPDATE/DELETE en `contacts` (el delete debe borrar también en Supabase), INSERT/UPDATE en `stores`. ~~Garantizar encargado único en BD~~ ✅ resuelto en schema v2.0 (índice único parcial `uq_contacts_primary_per_store`); las políticas de escritura de `stores` para staff también ya existen.
- [ ] **Ingesta de `MAESTRO.xlsx` (columnas CRM):** mapear las columnas de estado / municipio / urbanización / canal / clasificación del Excel a las nuevas columnas de `stores`.
- [x] **GAP — Crear `location_pings` en Supabase:** ✅ *(2026-06-07)* creada en el schema v2.0 con GEOGRAPHY generada, índices (incl. GiST) y RLS (dueño escribe/lee, supervisor lee). El SQLite local ganó `user_id` para el sync 1:1.
- [x] **Endurecer RLS `tasks_assignee`:** ✅ *(2026-06-07)* reemplazada en v2.0 por `tasks_select` + `tasks_update` (sin INSERT de cliente — solo el trigger `SECURITY DEFINER` crea tareas).
- [ ] **Recolección de data para features de largo plazo:** definir quién y cómo recolecta la data para el histórico de rotación de productos y el anaquel de exhibición ideal. Ver [[largo-plazo/Historico Rotacion Productos|Histórico de Rotación]] y [[largo-plazo/Anaquel Exhibicion Ideal|Anaquel de Exhibición Ideal]].

---

## 📱 Bloque Mobile (completado 2026-06-02)

- [x] **Bloque Mobile (UI/UX):** rutas especiales (personalizables), agregar/quitar sucursal, fecha de última reposición en el check-in, dropdowns de omisión y anomalía (Ionicons, bottom-sheet), y reportaje de competencia (slide-over). Implementado mock-first sobre SQLite. Ver [[logs/Log-2026-06-02-bloque-mobile|Log Bloque Mobile]] y [[pendientes/Bloque Mobile|Bloque Mobile — Requisitos]].
- [ ] **Follow-ups menores de calidad (no bloqueantes):**
  * ~~`CompetitionTab` usa `top: 200` fijo~~ — la pestaña fue rediseñada (más finita, `top: 170`) y ahora vive dentro del check-in (2026-06-06). Verificar alineación en pantallas chicas durante QA de dispositivos.
  * `addStoreToRoute` hace no-op silencioso si el `storeId` no existe — agregar `console.warn` al cablear data real.
  * Evaluar (decisión de producto) si el botón "Agregar sucursal" debe ocultarse mientras la sesión está activa (hoy se oculta sólo al finalizar la ruta).
- [ ] **Cablear el bloque mobile a Supabase:** login real (Supabase Auth), carga de rutas y sync de visitas/pings/reportes de competencia. Requiere credenciales `.env` + ingesta de Excel (bloqueadores arriba). La columna `competition_reports.photo_uri` guarda hoy un JSON de URIs locales; al sincronizar habrá que subir las fotos y mapear a `photo_urls`.
- [ ] **Al cablear visitas a Supabase:** `visits.photo_uri` local guarda JSON de URIs → subir a Storage (`visit-photos`) y mapear a `photo_urls`. Aplica tanto a fotos de la visita como al reporte de competencia adjunto.
- [ ] **Pruebas manuales en Expo** (emulador/dispositivo) del flujo completo mobile.

## Enlaces Relacionados
- [[pendientes/Bloque Mobile|Bloque Mobile — Requisitos de UI/UX]] — alcance detallado de la próxima sesión.
- [[roadmap/Roadmap|Roadmap del Proyecto]] — Hitos del desarrollo general.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — Decisiones del esquema CRM.
- [[resumen/Constitucion|Constitución]] — Reglas y restricciones a respetar en las soluciones.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — Tablas destino de los datos a importar.
