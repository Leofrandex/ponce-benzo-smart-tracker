---
title: "Spec — Hub Escritura (CRM)"
date: 2026-06-08
tags:
  - arquitectura
  - spec
  - supabase
  - hub
  - crm
  - escritura
---

# Spec — Hub Escritura (CRM)

> [!SUCCESS]
> **Estado:** ✅ **Implementado** el 2026-06-08. 6 tareas subagent-driven; `tsc`/`lint`/`build` limpios; escrituras y RLS verificados E2E con JWT real (Milagros escribe; Carlos bloqueado). Ver [[logs/Log-2026-06-08-hub-escritura|Log Hub Escritura]].
> **Contexto:** Sub-proyecto 4 de la migración. El hub ya lee datos reales de Supabase (fundación + lectura, 2026-06-08). Esta fase agrega las **escrituras que operan sobre datos que ya existen**: editar sucursales (= enriquecimiento), CRUD de contactos, engagements y resolver tareas. Monta sobre la capa de lectura (`queries/*.ts` + `useSupabaseQuery`) y el RLS ya verificado.

---

## Objetivo

Que el supervisor pueda **escribir** desde el hub: editar la información de sus sucursales (dirección, zona, canal, clasificación, GPS, activa), gestionar contactos (crear/editar/eliminar/marcar encargado), registrar y cerrar engagements, y resolver tareas. Todo respetando el RLS y manteniendo la UI fiel a la BD vía mutación + refetch.

## Decisiones tomadas durante el diseño

| Decisión | Resolución |
|---|---|
| Alcance | **Solo escrituras con datos reales hoy**: sucursales, contactos, engagements, resolver-tarea. Se excluyen los joins de nombres para gráficos/feed (inútiles hasta que el mobile genere visitas). |
| Refresco de UI | **Mutación + refetch**. Módulo de mutaciones espejo del de queries; componentes pasan a **controlados** (reciben data + callbacks), sin estado local mock. Tras escritura exitosa → `refetch`. |
| Encargado único | **Auto-reasignar** vía RPC `fn_set_primary_contact` (desmarca el anterior y marca el nuevo en una transacción). Resuelve el índice único parcial `uq_contacts_primary_per_store`. |
| Eliminar contacto | **Hard delete** (DELETE de la fila), según el pendiente del vault ("el delete debe borrar también en Supabase"). |
| Eliminar sucursal | **Soft**: `active = false` (no hay política DELETE en `stores`; el UI desactiva). |
| Crear sucursales nuevas | **Fuera**: el piloto usa las 192 existentes; el botón "Agregar sucursal" queda deshabilitado. |
| Resolver tarea | **Incluido** (cableado), aunque aún no haya tareas (se generan desde anomalías del mobile). |

## Arquitectura

Espejo de la capa de lectura más una función SQL puntual:

1. **Módulo de mutaciones** (`hub/app/lib/mutations/*.ts`): funciones tipadas que llaman al `browserClient` y devuelven `{ error: string | null }` (o el registro creado). Una por dominio: contacts, stores, engagements, tasks.
2. **RPC `fn_set_primary_contact(p_store_id, p_contact_id)`**: en una transacción, pone `is_primary = false` a los contactos activos de la tienda y `is_primary = true` al objetivo. `SECURITY INVOKER` (el RLS de `contacts` ya autoriza a supervisor/admin). Se crea por migración (MCP) y se refleja en `tools/supabase_schema.sql`.
3. **Componentes controlados**: `EngagementsPanel`, `ContactList`, `ContactFormModal`, `StoreFormModal` y `tareas/page.tsx` dejan de tener estado local mock; reciben `data` + callbacks. Tras una escritura exitosa, el padre hace `refetch` del hook de lectura correspondiente.

## Superficies de escritura

| Superficie | Operaciones | Tabla / RLS |
|---|---|---|
| **Sucursal** (ficha de cliente) | Editar zona (`estado`/`municipio`/`urbanizacion`), `business_channel`, `classification`, `master_lat`/`master_lng`, `address`, `active` | `stores` UPDATE (supervisor/admin) — habilita el **enriquecimiento** de datos de P&B |
| **Contactos** (ficha) | Crear, editar, eliminar (hard delete), marcar encargado | `contacts` INSERT/UPDATE/DELETE (staff) + RPC encargado |
| **Engagements** (ficha) | Crear nota/to-do; cerrar/reabrir to-do | `contact_engagements` INSERT/UPDATE |
| **Tareas** | Resolver (`status` open→resolved) | `tasks` UPDATE (asignado/creador/supervisor) |

## Archivos

### Nuevos
- `hub/app/lib/mutations/contacts.ts` — `createContact`, `updateContact`, `deleteContact`, `setPrimaryContact` (llama al RPC).
- `hub/app/lib/mutations/stores.ts` — `updateStore`, `deactivateStore`.
- `hub/app/lib/mutations/engagements.ts` — `createEngagement`, `toggleEngagementDone`.
- `hub/app/lib/mutations/tasks.ts` — `resolveTask`.
- Migración SQL `fn_set_primary_contact` (MCP) + reflejada en `tools/supabase_schema.sql`.

### Modificados
- `hub/app/(supervisor)/supervisor/clientes/[storeId]/page.tsx` — re-habilitar edición de sucursal (`StoreFormModal`) y CRUD de contactos; pasar callbacks de mutación + refetch.
- `hub/app/components/clientes/EngagementsPanel.tsx` — controlado (recibe `engagements` + `onCreate`/`onToggle`); sin estado local mock.
- `hub/app/components/clientes/ContactList.tsx` + `ContactFormModal.tsx` — `onSave`/`onDelete`/`onSetPrimary` cableados a mutaciones.
- `hub/app/components/clientes/StoreFormModal.tsx` — `onSave` cableado a `updateStore`.
- `hub/app/(supervisor)/supervisor/tareas/page.tsx` — re-habilitar el botón "Marcar como completada" → `resolveTask` + refetch.

### Sin cambios
- La lista de Clientes mantiene "Agregar sucursal" **deshabilitado** (crear sucursales fuera de alcance).

## Flujo de datos y errores

- Cada función de mutación devuelve `{ error }`. El componente: si `error`, lo muestra inline (o `alert`) y **no cierra** el modal / no limpia el formulario; si éxito, hace `refetch` del hook de lectura y cierra/limpia.
- El RLS es la última línea: una escritura no autorizada (ej. un mercaderista intentando editar contactos) es rechazada por la BD y se muestra el error.
- El cambio de encargado pasa siempre por el RPC (nunca un UPDATE directo de `is_primary = true`), evitando la violación del índice único.

## Criterios de aceptación

1. `tsc` + `lint` + `build` del hub limpios; tests `node:test` de validaciones puras (si las hay) verdes.
2. **Sucursal:** como Milagros, editar una tienda (ej. cargar `estado`/`classification`/coordenadas reales) persiste en `stores` y se refleja al refetch.
3. **Contactos:** crear, editar y eliminar un contacto de una tienda persiste correctamente (el delete borra la fila en Supabase).
4. **Encargado único:** marcar un segundo contacto como encargado desmarca automáticamente al anterior (vía RPC); nunca queda más de un `is_primary AND active` por tienda.
5. **Engagements:** crear una nota y un to-do, y cerrar/reabrir el to-do, persiste en `contact_engagements`.
6. **Tareas:** con una tarea de prueba insertada, el botón "Marcar como completada" la pasa a `resolved` y persiste.
7. **RLS:** un mercaderista (rol merchandiser) NO puede crear/editar contactos ni editar sucursales (la BD rechaza); se verifica vía JWT real.
8. No hay regresión visual ni de lectura: las pantallas siguen mostrando los datos reales correctamente.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Refactor de componentes a "controlados" rompe el render existente | Cambiar solo la fuente de estado (props + callbacks) preservando todo el JSX/estilos; verificar con build + E2E. |
| El RPC `fn_set_primary_contact` falla por RLS al correr como invoker | `contacts_write_staff` ya autoriza a supervisor/admin a UPDATE; se prueba el cambio de encargado E2E como Milagros (criterio 4). |
| Hard delete de contacto deja engagements colgados | `contact_engagements.contact_id` tiene `ON DELETE SET NULL` (ya en schema); el engagement queda sin contacto pero no se pierde. |
| Escritura de coordenadas inválidas (GPS) | Validación de rango lat/lng en la mutación de stores (función pura testeable) antes de enviar. |

## Fuera de alcance (sub-proyectos siguientes)

- **Joins de nombres** para `AnomaliesByClientChart`, `StoresPerMerchandiserChart`, `TasksProgress`, `ActivityFeed` — requieren visitas reales (mobile).
- **Crear sucursales nuevas** desde el hub.
- **Crear tareas manuales** / panel Kanban.
- **Mobile** (login, rutas, sync, fotos) y **Realtime**.

## Enlaces Relacionados
- [[arquitectura/Spec - Cablear Hub a Supabase|Spec — Hub Lectura]] — la fundación sobre la que monta.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — tablas/RLS de escritura.
- [[pendientes/Solicitud de Datos a P&B|Solicitud de Datos a P&B]] — la edición de sucursales es el mecanismo para cargar estos datos.
- [[pendientes/Pendientes|Pendientes]] — pendientes de CRM que esto cierra.
