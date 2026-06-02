---
title: "Bloque Mobile — Requisitos de UI/UX"
date: 2026-06-02
tags:
  - pendientes
  - mobile
  - requisitos
  - ui
---

# Bloque Mobile — Requisitos de UI/UX (próxima sesión)

> [!NOTE]
> Esta nota captura los **requisitos de interfaz/experiencia** del bloque mobile para que una sesión nueva tenga todo el contexto. El **modelo de datos** que soporta cada punto ya existe: ver [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] y [[decisiones/ADR-002-Modelo-CRM|ADR-002]]. El bloque hub ya se completó (ver [[logs/Log-2026-06-02|Log-2026-06-02]]).

## 🧭 Contexto de la app mobile (estado actual)

- App **React Native / Expo**, offline-first (SQLite local → Supabase), en `mobile/`.
- Pantallas actuales: `LoginScreen`, `RouteScreen` (ruta del día), `CheckInScreen` (reporte de visita), `VisitHistoryScreen`, `ProfileScreen`.
- Datos en **mock** (`mobile/src/mock-data.ts`); estado de ruta/sesión en `mobile/src/context/RouteContext.tsx`; persistencia local en `mobile/src/services/db.ts`.
- **Tipos ya listos** en `mobile/src/types.ts`: `Route.is_special`, `Visit.anomaly_type` / `skip_reason` / `last_restock_date`, `CompetitionReport`, `CompetitorBrand`, `Contact`, etc.

> [!WARNING]
> **Brechas conocidas en el código actual** (a corregir en este bloque):
> - `CheckInScreen` usa **emojis** (`✅⚠️🔴`) en vez de una librería de íconos React.
> - `CheckInScreen` solo tiene un selector de estado; **no** captura `anomaly_type`, `skip_reason` ni `last_restock_date`.
> - `RouteContext.recordVisit` fuerza `anomaly_type: null`, `skip_reason: null`, `last_restock_date: null` al insertar — debe pasar los valores reales del formulario.
> - No existe UI para rutas especiales, agregar sucursal, ni reportaje de competencia.

## 📋 Requisitos por funcionalidad

### 1. Rutas especiales
- Las rutas pueden cambiar en fechas especiales (ej. 24 y 31 de diciembre).
- Debe haber una **opción para ejecutar una ruta especial** en lugar de las rutas ya configuradas.
- Soporte de datos: `routes.is_special` (BOOLEAN).

### 2. Agregar sucursal a la ruta
- Botón **"Agregar otra sucursal"** (cuando sea necesario).
- Al pulsarlo, pedir seleccionar la sucursal desde un **campo dropdown**, y luego permitir hacer el reportaje de esa visita.

### 3. Reporte de visita — fecha de última reposición
- En el reporte de la visita, el mercaderista puede marcar la **fecha de la última reposición**.
- Campo **opcional**.
- Soporte de datos: `visits.last_restock_date` (DATE).

### 4. Rutas omitidas (status = `skipped`)
- **Dropdown** para seleccionar el motivo de omisión:
  - `fuera_de_ruta` → "Fuera de ruta"
  - `sin_acceso` → "No hay acceso a la tienda"
  - `otro` → "Otro"
- El **campo de notas opcionales se mantiene**.
- **Usar íconos de una librería React, no emojis.**

### 5. Anomalías (status = `anomaly`)
- **Dropdown** para seleccionar el **tipo de anomalía**. Cada tipo equivale a la tarea que se le genera al supervisor (lógica ya implementada por el trigger en Supabase). Mapeo:

| Tipo de anomalía (dropdown) | `anomaly_type` | Tarea generada al supervisor |
| :--- | :--- | :--- |
| No hay stock | `sin_stock` | Reponer stock (`reponer_stock`) |
| Cambio en el planograma | `cambio_planograma` | Contactar comprador (`contactar_comprador`) |
| Diferencia de precios | `diferencia_precios` | Contactar comprador (`contactar_comprador`) |
| Producto dañado | `producto_danado` | Contactar gerente (`contactar_gerente`) |
| Otro | `otro` | Revisar anomalía (`revisar_anomalia`) |

- Se mantiene el campo de **observaciones**.

> [!IMPORTANT]
> Invariante de "Payload Completa": el cliente debe escribir `status = 'anomaly'` **y** `anomaly_type` en el **mismo INSERT** (el trigger depende de ello). Ver [[decisiones/ADR-002-Modelo-CRM|ADR-002]].

### 6. Reportaje de la competencia
- **Alternativa opcional** al flujo normal de visita (NO es un estado más junto a completada/omitida/anomalía). El mercaderista la usa solo si encuentra actividad de una marca competidora durante la ruta.
- UX propuesta: una **pestaña lateral** en un costado de la pantalla; al seleccionarla se abre un **panel lateral** para hacer el reportaje. Se puede **cerrar** al terminar y **volver a abrir** para modificar.
- Campos:
  - **Dropdown "¿Cuál fue la activación?"**: promoción, material POP, espacios/exhibiciones adicionales, impulsos/activación, degustación, otro. → `competition_reports.activation_type` (`promocion`, `material_pop`, `espacios_exhibiciones`, `impulso_activacion`, `degustacion`, `otro`).
  - **Dropdown "¿Qué marca?"** (estandarizado): de la tabla `competitor_brands`.
  - **Fotos** de la activación / actividad de la competencia. → `competition_reports.photo_urls`.

## 🗒️ Notas transversales (tener en cuenta)
- Es valioso ver los **cumpleaños** de los encargados/tienda (bitácora de experiencias). Soporte: `contacts.birthday`; ver [[largo-plazo/Bitacora Cumpleanos|Bitácora de Cumpleaños]].
- **Varios contactos** por tienda (no solo el encargado). Soporte: tabla `contacts`.
- **Un supervisor por vendedor**. Soporte: `users.supervisor_id`.
- **El vendedor es a quien se le asignan las tareas**; el supervisor solo **visualiza** las tareas de todos sus vendedores.

## 🎨 Decisiones de implementación pendientes (a definir en brainstorming de la sesión mobile)
- Librería de íconos React Native a usar (ej. `@expo/vector-icons` ya está disponible — `Ionicons`).
- Seguir en **mock-data** o empezar a cablear Supabase (probablemente mock-first, igual que el hub).
- Diseño exacto del panel lateral de competencia (gesto/pestaña, animación).
- Si el "agregar sucursal" y la "ruta especial" se modelan como cambios en el `RouteContext` mock.

## 🔗 Enlaces Relacionados
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — campos que soportan cada requisito.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — decisiones y trigger anomalía→tarea.
- [[roadmap/Roadmap|Roadmap]] — Fase 4.
- [[pendientes/Pendientes|Pendientes]] — bloqueadores y tareas técnicas.
- [[logs/Log-2026-06-02|Log-2026-06-02]] — bloque hub completado (precedente del enfoque mock-first + subagent-driven).
