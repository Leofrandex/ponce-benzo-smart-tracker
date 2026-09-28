---
title: "ADR-009: Reposiciones como registro propio"
date: 2026-09-28
status: aceptado
tags:
  - adr
  - decisiones
  - reposiciones
---

# ADR-009: Reposiciones como registro propio

* **Estado**: `aceptado`
* **Fecha**: 2026-09-28
* **Autores**: Agente de IA & Usuario

---

## Contexto
Diego pidió (reunión 25-sep) que el vendedor pueda registrar la "última reposición" y ver un historial por fecha y producto. Hasta ahora la reposición era solo una columna, `visits.last_restock_date`, que la app llena en el check-in; la ficha de la tienda mostraba siempre "Sin registro". La app de campo no se puede cambiar sin un APK nuevo (Bloque 7).

## Decisión
- Tabla `restocks` (una fila por reposición: tienda, fecha, origen `app`/`panel`, visita, autor, nota) y tabla puente `restock_products`.
- **Trigger `trg_visit_restock` sobre `visits`** (SECURITY DEFINER): copia `last_restock_date` a `restocks` con `restock_id = visit_id`. La app actual no cambia. Una fecha nula o futura no crea reposición y **nunca lanza**, para no romper la sincronización.
- Backfill de las 77 visitas con fecha (45 tiendas).
- Registro desde el panel con la RPC `fn_registrar_reposicion` (SECURITY INVOKER): reposición y productos en una transacción, con RLS aplicada.
- RLS: lectura por `fn_can_see_store`; alta desde el panel para `admin`/`vendedor` activos que ven la tienda, con fecha ≤ hoy de Caracas; borrado por el autor de filas `panel` o un admin.
- Migración `tools/migraciones/2026-09-27-reposiciones.sql`, aplicada en producción el 27-sep con OK del usuario. Verificación: `tools/check_reposiciones.sql`.

## Consecuencias
### Positivas 👍
- Historial real por tienda, con productos, sin tocar la app vieja.
- El Bloque 7 solo tiene que subir `restock_products` para visitas cuya fila ya existe.

### Negativas / Riesgos 👎
- Dos fuentes de verdad para las reposiciones de la app (`visits.last_restock_date` y `restocks`), sincronizadas por trigger.
- Si la app re-envía una visita con fecha nula, se borra la reposición y, en cascada, sus productos.
- Subir productos de una visita sin reposición (fecha nula o futura) falla: la app 1.3.0 debe tratarlo como definitivo, sin reintentar.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[logs/Log-2026-09-27|Log 2026-09-27]]
