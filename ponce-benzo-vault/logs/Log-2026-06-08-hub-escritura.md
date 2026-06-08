---
title: "Sesión: Log-2026-06-08 (Hub Escritura CRM)"
date: 2026-06-08
tags:
  - log
  - sesion
  - hub
  - supabase
  - crm
  - escritura
---

# Log de Sesión: 2026-06-08 — Hub Escritura (CRM)

## 📝 Resumen de la Sesión
Sub-proyecto 4 de la migración: se habilitó la **escritura** del hub sobre datos reales — editar sucursales (enriquecimiento), CRUD de contactos con encargado único, engagements y resolver tareas. Ejecución subagent-driven (6 tareas) sobre `feature/hub-escritura-crm`. Todas las escrituras y el RLS verificados E2E con JWT real.

## 🛠️ Cambios Realizados
- **BD:** RPC `fn_set_primary_contact(p_store_id, p_contact_id)` — desmarca el encargado anterior y marca el nuevo en una transacción (`SECURITY INVOKER`, `REVOKE` de anon). Aplicada vía MCP y reflejada en `tools/supabase_schema.sql`.
- **Módulo de mutaciones** (`hub/app/lib/mutations/`): `stores.ts` (`updateStore`, `deactivateStore`, `validateCoords` pura con test), `contacts.ts` (`createContact`, `updateContact`, `deleteContact`, `setPrimaryContact`), `engagements.ts` (`createEngagement`, `toggleEngagementDone`), `tasks.ts` (`resolveTask`). Cada una devuelve `{ error }`.
- **Componentes controlados:** `ContactList` y `EngagementsPanel` dejan el estado local mock; reciben `data` + callbacks.
- **Ficha de cliente** (`clientes/[storeId]/page.tsx`): dueña de los datos (hooks con `refetch`); botón "Editar" + `StoreFormModal` (re-incorporado) para editar la sucursal; callbacks de contactos/engagements; patrón mutación→refetch con `alert` en error.
- **Tareas** (`tareas/page.tsx`): botón "Marcar como completada" cableado a `resolveTask` + refetch.

## ✅ Verificación (E2E con JWT real contra `poncebenzo`)
- `tsc` + `lint` + `build` limpios en cada tarea; `validateCoords` 1/1.
- **Como Milagros (supervisor):**
  - Editar tienda (estado/clasificación/coords) → persiste.
  - Crear 2 contactos; marcar encargado C1 y luego C2 → queda **solo 1** `is_primary` (la RPC desmarca al anterior).
  - Eliminar contacto (hard delete) → desaparece.
  - Crear engagement to-do y cerrarlo → persiste.
  - Resolver una tarea (generada por una anomalía de prueba) → `resolved`.
- **RLS negativo (Carlos, mercaderista):** PATCH `stores` → **0 filas**; POST `contacts` → **HTTP 403**. La BD bloquea correctamente.
- Datos de prueba limpiados; tienda restaurada al estado limpio.

## 🤝 Decisiones Tomadas
- **Solo escrituras con datos reales hoy** (sucursales, contactos, engagements, resolver-tarea); los joins de nombres para gráficos/feed quedan fuera (dependen de visitas del mobile).
- **Mutación + refetch** con componentes controlados.
- **Encargado único** por RPC transaccional (auto-reasignar).
- **Hard delete** de contactos; **soft** (active=false) para sucursales.
- Crear sucursales nuevas: fuera de alcance (piloto usa las 192). Ver [[arquitectura/Spec - Hub Escritura CRM|Spec]].

## 🚧 Pendiente (siguientes)
- Desmarcar encargado (poner is_primary=false del actual) — caso raro, no cubierto.
- Joins de nombres para `ActivityFeed` y gráficos del dashboard (requieren visitas → mobile).
- Crear sucursales nuevas / tareas manuales / Kanban.

## 🚀 Próximos Pasos
- [ ] Merge de `feature/hub-escritura-crm` a `master`.
- [ ] Sub-proyecto Mobile: login real, carga de rutas, motor de sync, subida de fotos.

## 🔗 Enlaces Relacionados
- [[arquitectura/Spec - Hub Escritura CRM|Spec — Hub Escritura (CRM)]]
- [[arquitectura/Spec - Cablear Hub a Supabase|Spec — Hub Lectura]]
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]
- [[roadmap/Roadmap|Roadmap]]
