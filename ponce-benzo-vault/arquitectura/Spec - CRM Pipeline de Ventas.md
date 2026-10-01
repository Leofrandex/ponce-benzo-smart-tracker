---
title: "Spec — Módulo CRM / Pipeline de Ventas (v1)"
date: 2026-09-30
status: diseño aprobado en chat, pendiente de aprobación comercial del cliente
tags:
  - spec
  - crm
  - pipeline
  - hub-modulos
  - arquitectura
---

# Spec — Módulo CRM / Pipeline de Ventas (v1)

> [!NOTE]
> Diseño definido en sesión de brainstorming con Sebastián el 2026-09-30, a partir de [[largo-plazo/Reunion 2026-09-25 - Ajustes Tracker y Pipeline|la reunión con Diego del 2026-09-25]]. La decisión de modelo está en [[decisiones/ADR-012-CRM-Centrado-En-Cuenta|ADR-012]]. El plan de implementación se escribe **después** de que P&B apruebe la propuesta comercial.

## 1. Objetivo

Hoy los vendedores de P&B solo toman pedidos. La dirección quiere que salgan a buscar negocio nuevo y **ver ese esfuerzo y el dinero en juego**. El módulo da a cada vendedor un pipeline propio y a la gerencia la vista consolidada, dentro del mismo hub del tracker.

**Éxito:** los 6 vendedores cargan sus oportunidades desde el primer mes; la gerencia lee dinero por etapa y por vendedor sin pedir un Excel; Diego ajusta etapas y campos sin pedírselo al desarrollador.

## 2. Principios

- **Mismo hub, misma base.** Next.js `hub/` + Supabase. El CRM es un módulo del hub, no una app nueva. La app móvil de mercaderistas es aparte y solo comparte la base.
- **Maestros compartidos.** Clientes, sucursales, contactos, productos y usuarios los usan tracker y CRM; no se duplican.
- **Un solo módulo de Configuración.** Se extiende `/panel/configuracion` (hoy: vendedores y productos).
- **Web adaptada al celular.** Sin app nativa para el CRM.

## 3. Modelo de datos (centrado en la cuenta)

```
                Cliente (account) — estado: prospecto | activo; vendedor(es) dueño(s)
               /        |          \
      Oportunidad    Contactos    Sucursales (activa | en_negociacion)
        |   |   \        |  sucursal opcional
        |   |    \       |
        |   |     Contactos de la oportunidad (rol: decide | compra | influye)
        |   Productos / líneas en juego
        Sucursales en juego (opcional)
```

| Entidad | Cambio | Notas |
|---|---|---|
| `clients` | + `status` (`prospecto`/`activo`), + `custom` jsonb | Un prospecto es un cliente en estado prospecto, sin sucursales obligatorias |
| `client_assignments` | sin cambio | Ya es cliente ↔ vendedor; define "sus clientes" |
| `stores` | + `status` (`activa`/`en_negociacion`) | `en_negociacion` no aparece en rutas, mapa ni métricas del tracker |
| `contacts` | + `client_id` NOT NULL; `store_id` pasa a opcional; + `custom` jsonb | Migración: `client_id` = cliente de su sucursal actual. Tracker (cumpleaños, ficha de tienda, check-in) no cambia |
| `pipelines` | nueva | v1 entrega **uno**; la tabla existe para habilitar más sin rehacer |
| `pipeline_stages` | nueva | `pipeline_id`, `name`, `position`, `kind` (`open`/`won`/`lost`). Ganado y Perdido fijos (no se borran ni cambian de `kind`) |
| `deals` | nueva | `client_id`, `owner_user_id`, `stage_id`, `amount`, `expected_close_date`, `deal_type`, `won_note`, `lost_reason_id`, `closed_at`, `custom` jsonb |
| `deal_contacts` | nueva | `deal_id`, `contact_id`, `role`; el contacto debe ser del mismo cliente |
| `deal_products` | nueva | `deal_id`, `product_id` o `line` |
| `deal_stores` | nueva | `deal_id`, `store_id` (sucursales en juego) |
| `deal_activities` | nueva | `type` (`nota`/`llamada`/`reunion`/`recordatorio`), `body`, `due_date`, `done`, autor |
| `deal_stage_history` | nueva | Cada cambio de etapa con fecha y autor: base de métricas de tiempo en etapa |
| `lost_reasons` | nueva | Catálogo editable por admin |
| `custom_field_defs` | nueva | `entity` (`deal`/`client`/`contact`), `key`, `label`, `type`, `options`, `required`, `required_from_stage_id`, `position`, `active` |

**Tipos de negocio (fijos, `CHECK`):** `cliente_nuevo`, `linea_nueva`, `sucursal_nueva`, `aumento_volumen`. Fijos porque las métricas históricas dependen de ellos.

**Campos personalizados:** valores en `custom` jsonb por entidad, validados contra `custom_field_defs` en servidor. Tipos: texto, número, moneda, fecha, lista (única/múltiple), sí/no, usuario. Borrar un campo lo desactiva (no se pierden valores históricos).

## 4. Reglas de negocio

1. **Ganado** exige `won_note` (contrato o justificación) y los campos marcados como obligatorios para esa etapa.
2. **Perdido** exige `lost_reason_id`.
3. Al ganar: las `deal_stores` en `en_negociacion` pasan a `activa` (quedan disponibles para rutas del tracker) y el cliente prospecto pasa a `activo`.
4. Una recompra no es oportunidad (regla de uso, se comunica en la capacitación).
5. Borrar una etapa con oportunidades exige moverlas antes a otra etapa.
6. Antes de crear un cliente, búsqueda por nombre/RIF: si existe, se avisa quién lo atiende (no se crea el duplicado).

## 5. Roles y permisos

| Rol | Ve | Puede |
|---|---|---|
| **Vendedor** | Sus oportunidades y sus clientes asignados; busca en todos los clientes (solo nombre y quién lo atiende) | Crear clientes, contactos y oportunidades; mover sus tarjetas; registrar actividades |
| **Gerencia** (Rosley, directiva, Maximino) | Todo el pipeline y las métricas | Lo del vendedor + reasignar oportunidades |
| **Admin** (Diego) | Todo | Lo anterior + configurar pipeline, etapas, campos, motivos de pérdida y permisos |

- Acceso **por módulo**: tabla `user_modules` (`user_id`, `module`, `role`). El hub muestra un **lanzador** con los módulos habilitados de cada usuario.
- Se aplica con **RLS** en Supabase, siguiendo el patrón de alcance por cliente de [[decisiones/ADR-006-Alcance-Por-Cliente|ADR-006]].

## 6. Pantallas

1. **Pipeline (kanban):** columnas por etapa con total de dinero; arrastrar tarjetas; filtros por vendedor, tipo de negocio y fecha de cierre. Vista lista alternativa (en el celular por defecto).
2. **Ficha de oportunidad:** datos, campos personalizados, contactos con rol, productos, sucursales, actividades y el historial de etapas.
3. **Ficha de cliente:** estado, vendedores, contactos, sucursales, oportunidades abiertas y cerradas.
4. **Métricas:** dinero por etapa y por vendedor, cierres por mes, % de ingreso nuevo por tipo de negocio, tasa de conversión y motivos de pérdida.
5. **Configuración** (extiende la actual): etapas, campos personalizados, motivos de pérdida, permisos por módulo.

## 7. GPS de vendedores — fuera de alcance

> [!NOTE]
> Se diseñó y luego **salió del alcance** (2026-09-30, decisión de P&B). Si vuelve: un navegador no envía ubicación en segundo plano, así que el camino es un **modo vendedor** en la app móvil actual (inicio/fin de jornada + `location_pings`, sin rutas ni check-in) y un filtro por tipo de usuario en el mapa del hub. Estimado ≈ 1 semana.

## 8. Fuera de alcance (v1)

- Varios pipelines (la base queda lista).
- GPS de vendedores (ver §7).
- Integración con Outlook (fase 2) y WhatsApp (descartado).
- App nativa del CRM.
- Campos personalizados en sucursal y producto (los usa la app móvil).

## 9. Fases y cronograma

| Fase | Entrega | Semanas |
|---|---|---|
| 1 | Kanban, oportunidades, clientes y contactos (migración incluida), roles, lanzador de módulos — **primera demo** | 1–3 |
| 2 | Configuración (etapas, campos personalizados, motivos, reglas de cierre) y métricas | 4–5 |
| 3 | Puente sucursal → tracker, pruebas y capacitación | 6 |

Con anticipo la semana del 5-oct: demo ≈ 23-oct, entrega ≈ 13-nov.

## 10. Pruebas

- Tests de reglas de cierre, validación de campos personalizados y permisos (RLS por rol, con usuarios de prueba por rol).
- Migración de contactos verificada contra conteos antes/después; el tracker (cumpleaños, ficha de tienda) debe dar los mismos resultados.
- Humo en el celular del kanban en vista lista.

## 11. Condiciones comerciales (referencia)

Implementación **$2.000** (precio con descuento sobre una lista de $2.400 sin GPS) (40 % al aprobar, 30 % en la demo, 30 % en la entrega). Mantenimiento unificado del hub **$250/mes**. Detalle en la propuesta al cliente.

## Enlaces

- [[decisiones/ADR-012-CRM-Centrado-En-Cuenta|ADR-012]]
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 Modelo CRM]]
- [[largo-plazo/Mapa de Modulos del Hub|Mapa de Módulos del Hub]]
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]
