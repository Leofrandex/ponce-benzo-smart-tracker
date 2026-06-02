---
title: "Sesión: Log-2026-06-02 (Bloque Mobile)"
date: 2026-06-02
tags:
  - log
  - sesion
  - mobile
  - ui
  - crm
---

# Log de Sesión: 2026-06-02 — Bloque Mobile

## 📝 Resumen de la Sesión

Implementación del **bloque mobile** completo (app React Native / Expo en `mobile/`), sobre **mock-data + SQLite local** (sin Supabase todavía, coherente con el bloque hub). Se cubrieron las seis funcionalidades pendientes de la Fase 4: rutas especiales (personalizables), agregar sucursal a la ruta, fecha de última reposición en el check-in, dropdowns de motivo de omisión y tipo de anomalía (con íconos `Ionicons`, sin emojis), y reportaje de competencia (panel lateral slide-over).

El diseño se validó con brainstorming visual (mockups en navegador). Spec en `docs/superpowers/specs/2026-06-02-bloque-mobile-design.md` y plan en `docs/superpowers/plans/2026-06-02-bloque-mobile.md` (locales, no versionados). Ejecutado con metodología **subagent-driven** (implementador + revisión de spec y de calidad por tarea; 15 tareas). Toda la rama `feat/bloque-mobile` compila con `npx tsc --noEmit` en cero errores.

## 🛠️ Cambios Realizados

### Capa de datos y estado
- **`mobile/src/types.ts`**: `VisitRecord` extendido con `anomaly_type` / `skip_reason` / `last_restock_date`; nuevo tipo de formulario `CompetitionReportRecord`.
- **`mobile/src/mock-data.ts`**: `mockCompetitorBrands` (catálogo para el dropdown de marcas).
- **`mobile/src/services/db.ts`**: `insertCompetitionReport` (las fotos se guardan como **JSON** en la columna `photo_uri` TEXT, sin migrar schema) + `getUnsyncedCompetitionCount`.
- **`mobile/src/context/RouteContext.tsx`**:
  - **Fix**: `recordVisit` ya no fuerza nulls — escribe `anomaly_type` (si `status='anomaly'`), `skip_reason` (si `'skipped'`) y `last_restock_date` reales en el mismo INSERT (invariante "payload completa" de [[decisiones/ADR-002-Modelo-CRM|ADR-002]]).
  - `routeMode` (`normal`/`special`) + `setRouteMode`, `addStoreToRoute`, `removeStoreFromRoute`.
  - `recordCompetitionReport`; `refreshSyncCount` suma visitas + reportes de competencia no sincronizados.

### Componentes nuevos
- **`BottomSheetSelect.tsx`**: hoja inferior de selección única reutilizable (anomalía, omisión, activación, marca, tienda).
- **`StorePickerSheet.tsx`**: buscador + catálogo de tiendas (excluye las ya presentes).
- **`RouteModeToggle.tsx`**: segmentado Ruta normal / ★ Ruta especial.
- **`CompetitionTab.tsx`** + **`CompetitionPanel.tsx`**: pestaña lateral + panel slide-over animado (activación, marca, tienda opcional, fotos múltiples vía `CameraModal`, notas).

### Pantallas
- **`CheckInScreen.tsx`**: emojis → `Ionicons`; dropdowns condicionales de omisión/anomalía (bottom-sheet); fecha de última reposición opcional (`@react-native-community/datetimepicker`); validación de envío; `handleSubmit` ahora hace `await recordVisit` (evita navegar antes de persistir) y resetea estado al cambiar de status.
- **`StoreCard.tsx`**: botón ✕ opcional (`onRemove`), habilitado solo antes de empezar la sesión.
- **`RouteScreen.tsx`**: `RouteModeToggle`, botón "Agregar sucursal" (footer), estado vacío para ruta especial, quitar sucursales, y montaje de la pestaña + panel de competencia.

### Dependencia
- **`@react-native-community/datetimepicker@8.4.x`** (vía `expo install`).

## 🤝 Decisiones Tomadas
- **Mock-first**: toda la UI sobre mock-data + SQLite; el cableado a Supabase Auth/queries sigue siendo hito posterior.
- **Ruta especial = ruta personalizable** (no una lista fija): arranca vacía y el mercaderista la arma con el mismo picker que "agregar sucursal".
- **Dropdowns = bottom-sheet modal** (no acordeón inline); **competencia = slide-over lateral** (no bottom-sheet).
- **Fotos de competencia como JSON** en `photo_uri` (sin migración de schema SQLite).
- Sin nuevos ADR (decisiones de UI dentro de Fase 4; no alteran stack ni schema).

## 🚀 Próximos Pasos (Para la siguiente sesión)
- [ ] Cablear el bloque mobile y el hub a Supabase (login real, queries, sync). Requiere credenciales `.env` + ingesta de Excel.
- [ ] **Follow-ups menores de calidad (no bloqueantes):** `CompetitionTab` usa `top: 200` fijo (revisar en QA de dispositivos); `addStoreToRoute` no-op silencioso si el `storeId` no existe (agregar `console.warn` con data real); evaluar si el botón "Agregar sucursal" debe ocultarse durante sesión activa (decisión de producto).
- [ ] Reconciliar tipos mock del hub (`SupervisorTask`/`TaskType`) con `tasks`/`DbTaskType`.
- [ ] Pruebas manuales del flujo en Expo (emulador/dispositivo).

## 🔗 Enlaces Relacionados
- [[pendientes/Bloque Mobile|Bloque Mobile — Requisitos de UI/UX]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[pendientes/Pendientes|Pendientes]]
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]]
- [[logs/Log-2026-06-02|Log-2026-06-02 (Bloque Hub)]]
