---
title: "ADR-005: Anomaly Type como Array (TEXT[] en Supabase + JSON en SQLite)"
date: 2026-06-22
status: aceptado
tags:
  - adr
  - decisiones
  - supabase
  - mobile
  - anomalias
  - schema
---

# ADR-005: Anomaly Type como Array (TEXT[] en Supabase + JSON en SQLite)

* **Estado**: `aceptado`
* **Fecha**: 2026-06-22
* **Autores**: Agente de IA & Usuario

---

## Contexto

El modelo original de visitas (`visits`) soportaba una única anomalía por visita (`anomaly_type TEXT`). El negocio requiere que un mercaderista pueda reportar **múltiples anomalías en una sola visita** (por ejemplo, producto mal etiquetado y faltante de stock simultáneamente). Adicionalmente, el trigger `fn_create_task_from_anomaly` debía seguir generando una **tarea supervisor por cada anomalía**, manteniendo la trazabilidad.

Las restricciones técnicas relevantes son:
- **SQLite en el móvil** (Expo SQLite): no tiene tipo array nativo.
- **Supabase**: soporta `TEXT[]` con CHECK por elemento.
- **Motor de sync offline**: el payload de sync debe traducir el formato local al remoto sin pérdida.
- **Sin datos previos**: en el momento de la migración, `visits` y `tasks` tenían 0 filas, eliminando el riesgo de pérdida de datos.

## Decisión

Se adoptó el siguiente modelo de tres capas:

| Capa | Tipo | Detalle |
|---|---|---|
| SQLite (móvil) | `TEXT` | Array serializado como JSON (`["ETIQUETA","FALTANTE"]`) — mismo patrón que `competition_reports.photo_uri` |
| Supabase (`visits`) | `TEXT[]` | Columna con CHECK de elemento válido; migración `ALTER COLUMN` directa |
| Trigger `fn_create_task_from_anomaly` | — | Recorre el array con `UNNEST` y crea una task por elemento, con dedup `ON CONFLICT (source_visit_id, title) DO NOTHING` |

El payload de sync (`payloads.ts` en el móvil) parsea el JSON de SQLite y lo envía directamente como array a Supabase.

### Alternativa descartada: tabla relacional `visit_anomalies`

Se evaluó crear una tabla `visit_anomalies (id, visit_id, anomaly_type)` con una fila por anomalía.

**Razones del descarte:**
1. **Complejidad de sync**: el motor offline actual hace upserts atómicos por entidad; una tabla auxiliar requeriría gestionar FKs adicionales, orden de inserción y dedup más complejo.
2. **Migración más invasiva**: implica crear tabla, migrar datos (si los hubiera) y cambiar el trigger; el cambio de columna es más quirúrgico.
3. **Overhead sin beneficio claro**: el conjunto de anomalías es un enum acotado y no requiere indexación ni joins adicionales en los accesos actuales.

> [!NOTE]
> Si en el futuro se necesita consultar anomalías individualmente (p. ej. "todas las visitas con anomalía FALTANTE"), la columna `TEXT[]` de Supabase soporta `ANY(anomaly_type)` eficientemente. La tabla relacional seguiría siendo una alternativa válida si los requisitos de consulta crecieran.

## Consecuencias

### Positivas 👍
- **Cambio mínimo**: la lógica de sync existente no cambia estructuralmente; sólo se agrega un `JSON.parse` en `payloads.ts`.
- **Una task por anomalía se preserva**: el trigger con `UNNEST` + dedup mantiene la trazabilidad supervisor→anomalía.
- **Migración no destructiva**: 0 filas previas → `ALTER COLUMN` sin pérdida.
- **Consistente con patrones existentes**: JSON-en-TEXT ya se usa en `competition_reports.photo_uri`.

### Negativas / Riesgos 👎
- **Cambio de tipo breaking**: si existieran datos previos (filas con `anomaly_type TEXT`), la migración requeriría un cast explícito. Documentar este riesgo para futuras migraciones cuando haya datos en producción.
- **Validación de formato en SQLite delegada a la app**: SQLite no puede validar el contenido JSON; una corrupción del campo quedaría sin detectar hasta el sync. Mitigación: el `BottomSheetMultiSelect` sólo produce arrays bien formados.
- **Serialización acoplada**: si se añade un nuevo campo array en el futuro, el mismo patrón debe aplicarse manualmente (no hay mecanismo automático de serialización).

## Enlaces Relacionados
- [[logs/Log-2026-06-22|Log 2026-06-22 (Filtros Geo + Anomalías Múltiples)]]
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[arquitectura/Spec - Supabase Schema v2|Spec - Supabase Schema v2]]
