---
title: "ADR-014: Sucursales propuestas desde la app (tabla separada del catálogo)"
date: 2026-10-15
status: aceptado
tags:
  - adr
  - decisiones
  - sucursales
  - mobile
  - hub
---

# ADR-014: Sucursales propuestas desde la app (tabla separada del catálogo)

* **Estado**: `aceptado` (migración escrita en la rama, **no aplicada en producción** hasta el OK de Sebastián)
* **Fecha**: 2026-10-15
* **Autores**: Agente de IA & Usuario

---

## Contexto

Los mercaderistas visitan sucursales que no están en la base (p. ej. las 85 de Maracaibo/Barcelona). Sin coordenadas GPS no se pueden dar de alta, y conseguir el GPS desde la oficina es lo más difícil. Los mercaderistas ya están parados en la sucursal, así que la app tiene que dejarles capturar la ubicación y unos datos mínimos, y el hub tiene que permitir a un admin revisar y crear la sucursal en el catálogo sin scripts ni SQL.

Restricciones que pesan en la decisión:
* Las visitas exigen un `store_id` real del catálogo (no sirven para una sucursal que todavía no existe).
* El catálogo `stores` es la fuente que usan rutas, mapa, reportes y coberturas; no debe llenarse de registros a medio completar.
* Hay que poder registrar sin conexión, igual que las visitas (BUG-029).

## Decisión

Tabla nueva **`store_proposals`**, separada de `stores`, con su propio ciclo de vida (`pendiente` → `aprobada` / `rechazada`).

* Cualquier usuario autenticado y activo de la app registra una propuesta (mercaderista, colaborador o supervisor).
* Aprobar la propuesta (RPC `fn_aprobar_propuesta`, solo admins del hub) crea la fila en `stores` y marca la propuesta con su `store_id`, en una sola transacción. Falla si la propuesta ya no está `pendiente`.
* Rechazar (RPC `fn_rechazar_propuesta`) puede marcarla como duplicada de una sucursal existente, y opcionalmente copiar el GPS de la propuesta a esa sucursal para corregirla.
* Sin `DELETE`: las propuestas se rechazan, no se borran.

## Alternativas descartadas

* **`stores` con `active = false`**: mezcla datos a medio llenar con tiendas reales. Cada consulta del catálogo tendría que filtrar `active`, y un error en un filtro mostraría basura en rutas o reportes.
* **Una nota en `visits`**: las visitas exigen `store_id` real, así que no hay dónde guardar la sucursal nueva sin romper la regla. Además mezclaría el reporte de visita (que aquí no se hace) con el alta.

## Consecuencias

### Positivas 👍
- El catálogo `stores` solo contiene sucursales revisadas por un admin.
- Cada propuesta conserva su foto, nota, GPS original (`lat`/`lng`/`accuracy_m`) y autor; aprobar o rechazar no pierde nada.
- La aprobación es atómica y no se puede hacer dos veces (dos admins a la vez: el segundo recibe "Esta propuesta ya fue revisada").
- Reintentos seguros: el registro se sube con `upsert` por `proposal_id` generado en el teléfono.

### Negativas / Riesgos 👎
- Cualquier usuario de la app puede registrar; el filtro es la revisión del admin, no el permiso de escritura. Si aparece spam, habrá que limitar por rol.
- Aprobar **no** agrega la sucursal a rutas: sigue dependiendo del Excel y del script de carga hasta que exista el editor de rutas. Una sucursal aprobada puede quedar sin ruta asignada.
- Aprobar **no** genera reporte de visita. El mercaderista reporta la sucursal como cualquier otra desde que queda aprobada.
- Cualquier admin aprueba (Sebastián, Diego, Rosli y Jollalvis). No hay asignación por zona.
- Las propuestas pendientes pueden olvidarse; por eso la pestaña Configuración muestra un contador de pendientes.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[decisiones/ADR-004-Nivel-Cliente-Piloto-Farmatodo|ADR-004]] (cliente como cadena, usado como sugerencia opcional en la propuesta)
- [[decisiones/ADR-009-Reposiciones-Como-Registro-Propio|ADR-009]] (precedente de registro propio con sync offline)
- [[roadmap/Roadmap|Roadmap del Proyecto]]
