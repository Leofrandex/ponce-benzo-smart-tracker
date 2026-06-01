---
title: "ADR-002: Modelo de Datos CRM (Contactos, Tareas, Competencia y Anomalías)"
date: 2026-06-01
status: aceptado
tags:
  - adr
  - decisiones
  - arquitectura
  - crm
  - base-de-datos
  - supabase
---

# ADR-002: Modelo de Datos CRM (Contactos, Tareas, Competencia y Anomalías)

* **Estado**: `aceptado`
* **Fecha**: 2026-06-01
* **Autores**: Agente de IA & Usuario

---

## Contexto

El esquema original del **Ponzivenzo Smart Tracker** (ver [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]) cubría el ciclo operativo mínimo: rutas, sesiones, visitas, fotos anti-fraude y pings de GPS. Sin embargo, el negocio de Ponce & Benzo requiere capacidades de **CRM** para gestionar la relación comercial con cada tienda más allá del check-in geolocalizado:

- Segmentar las tiendas por **zona geográfica**, **canal de negocio** y **clasificación comercial** (A/B/C).
- Mantener **varios contactos por tienda** (encargado, comprador, gerente) y una **bitácora de interacciones** con ellos.
- Convertir las **anomalías detectadas en campo** (sin stock, cambio de planograma, diferencia de precios, producto dañado) en **tareas accionables** dirigidas al supervisor responsable del vendedor.
- Registrar la **actividad de la competencia** (promociones, material POP, degustaciones, etc.) que el mercaderista observa en la tienda.
- Soportar una **jerarquía supervisor → vendedor** para la visibilidad de datos y la asignación de tareas.

Este ADR documenta la expansión del esquema para cubrir estas necesidades, manteniendo los invariantes definidos en la [[resumen/Constitucion|Constitución]] (especialmente la regla de "Payload Completa").

El diseño detallado y el plan de ejecución se encuentran en el spec `docs/superpowers/specs/2026-06-01-modelo-datos-crm-design.md` y su plan asociado en `docs/superpowers/`.

## Decisión

Se extiende el esquema de Supabase (PostgreSQL) y su espejo local en SQLite, junto con los tipos TypeScript de `mobile/` y `hub/`. Las decisiones de diseño clave son:

- **D1 — Anomalía → Tarea al supervisor**: cuando una visita se inserta con `status = 'anomaly'`, un trigger genera automáticamente una tarea (`tasks`) asignada al **supervisor del vendedor** (`users.supervisor_id`). El mapeo `anomaly_type → task_type` se realiza en una función dedicada.
- **D2 — Un supervisor por vendedor**: la jerarquía se modela con una auto-FK `users.supervisor_id` (`ON DELETE SET NULL`). Cada vendedor tiene como máximo un supervisor.
- **D3 — Zona geográfica como 3 columnas de texto**: `stores.estado`, `stores.municipio` y `stores.urbanizacion` se modelan como `TEXT` simples. La normalización a tablas lookup queda pendiente a futuro (ver [[pendientes/Pendientes|Pendientes]]).
- **D4 — Canal y clasificación como enums fijos**: `stores.business_channel` (drogueria, farmacia, supermercado, autoservicio, mayorista, otro) y `stores.classification` (A, B, C) se modelan con restricciones `CHECK`.
- **D5 — Engagements como bitácora estructurada**: las interacciones con contactos se registran en `contact_engagements` con `type` (note | todo) y `status` (open | done), en lugar de texto libre suelto.
- **D6 — Marca competidora como lookup editable**: `competitor_brands` es una tabla de catálogo editable referenciada por `competition_reports`, en vez de un enum fijo, para permitir agregar marcas sin migraciones.

### Trigger anomalía → tarea

`trg_visit_anomaly_task` (sobre `visits`) invoca `fn_create_task_from_anomaly`, que usa `fn_task_type_from_anomaly` para mapear:

| `anomaly_type` | `task_type` generado |
| :--- | :--- |
| `sin_stock` | `reponer_stock` |
| `cambio_planograma` | `contactar_comprador` |
| `diferencia_precios` | `contactar_comprador` |
| `producto_danado` | `contactar_gerente` |
| `otro` | `revisar_anomalia` |

Ambas funciones aplican `SET search_path = ''` como medida de *hardening*.

> [!IMPORTANT]
> **Invariante de Payload Completa (anomalías):** el cliente debe escribir `status = 'anomaly'` y `anomaly_type` en el **mismo INSERT**. El trigger depende de que `anomaly_type` esté presente al momento de la inserción para generar la tarea correcta. Esto extiende la regla de "Payload Completa" de la [[resumen/Constitucion|Constitución]].

### Nueva carpeta `largo-plazo/`

Con aprobación explícita del usuario, se crea la carpeta `ponce-benzo-vault/largo-plazo/` para incubar features de visión a futuro que aún carecen de mecanismo de recolección de datos: histórico de rotación de productos, anaquel de exhibición ideal y bitácora de cumpleaños de contactos. Ver [[largo-plazo/Historico Rotacion Productos|Histórico de Rotación]], [[largo-plazo/Anaquel Exhibicion Ideal|Anaquel de Exhibición Ideal]] y [[largo-plazo/Bitacora Cumpleanos|Bitácora de Cumpleaños]].

## Consecuencias

### Positivas 👍
- **CRM accionable**: las anomalías de campo se traducen automáticamente en tareas para el supervisor correcto, sin intervención manual.
- **Trazabilidad comercial**: contactos y bitácora estructurada permiten reconstruir la relación con cada tienda.
- **Segmentación**: canal y clasificación habilitan reportería y priorización de rutas.
- **Inteligencia de competencia**: los reportes de competencia capturan la actividad rival directamente en campo.
- **Seguridad por jerarquía**: las nuevas políticas RLS permiten que un supervisor vea a sus vendedores, rutas y visitas sin exponer datos de otros equipos.

### Negativas / Riesgos 👎
- **Zona geográfica desnormalizada (D3)**: tres columnas de texto libre son propensas a inconsistencias de escritura; requerirá normalización futura.
- **Tipos mock del hub sin reconciliar**: los tipos de UI `SupervisorTask` / `TaskType` (en inglés) del hub aún no se alinean con la tabla `tasks` / `DbTaskType`. Pendiente al construir la UI del CRM.
- **Política `tasks_assignee` permisiva**: actualmente `WITH CHECK (true)`; aceptable mientras las tareas se generen sólo por trigger/servidor, pero debe endurecerse si el cliente llega a escribir tareas directamente.
- **Duplicidad de modelos**: refuerza el riesgo ya señalado en [[decisiones/ADR-001-Next-RN-Split|ADR-001]] de mantener tipos sincronizados entre `hub` y `mobile`.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[decisiones/ADR-001-Next-RN-Split|ADR-001 — Split de Arquitectura Dual]]
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]
- [[resumen/Constitucion|Constitución del Proyecto]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[pendientes/Pendientes|Pendientes]]
