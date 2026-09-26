---
title: "Reunión 2026-09-25 — Ajustes al Tracker y Pipeline de Ventas"
date: 2026-09-25
tags:
  - reunion
  - cliente
  - hub-modulos
  - crm
  - pipeline
---

# Reunión 2026-09-25 — Diego Mori × Sebastián

Transcripción cruda: `inbox/procesados/2026-09-25 Reunion Diego - Tracker y Pipeline.md`.

## 1. Tracker (módulo actual)

La lista accionable vive en [[pendientes/Pendientes|Pendientes]], sección "Pedidos de la reunión con Diego (2026-09-25)". Resumen:

- **Gobierno:** Diego pasa a ser el dueño del tracker y quiere un usuario que le permita editar asignaciones cliente ↔ vendedor por su cuenta. Ven todo: Rosley, Maximino (nuevo gerente de trade marketing), Diego y su mamá.
- **Limpieza:** desde el lunes 28-sep los vendedores deben cerrar sus tareas. Quiere ver solo las tareas desde el 15-sep.
- **Navegación:** que cada KPI del dashboard lleve a su vista filtrada (anomalías, tareas por antigüedad, cadena, tipo de anomalía, perfil de mercaderista).
- **Filtros:** clientes por municipio y vendedor; tareas con conteos por vendedor; mapa con "ninguna" y filtro por cadena.
- **Campo:** foto obligatoria en toda visita (Diego además va a capacitarlos para estandarizar fotos).
- **Datos nuevos:** historial de reposiciones por producto, anomalías etiquetadas por producto/línea, catálogo de Corpañal.
- **Pendiente del cliente:** clasificación ABC de tiendas y lista de productos de Corpañal.
- **Futuro, ya conversado:** rotación histórica (la carga el mercaderista); mapa de calor de exhibición con IA sobre fotos.

## 2. Pipeline de ventas (módulo nuevo, proyecto aparte)

> [!IMPORTANT]
> Es un **proyecto nuevo con presupuesto propio** (Sebastián lo estimó en un rango parecido al primero y enviará propuesta formal). El fee mensual de mantenimiento se sube y queda **un único fee** para todo el hub. Diego pide fecha de la primera demo. El diseño y la arquitectura se definen en una sesión dedicada.

**Contexto:** hoy los vendedores solo toman pedidos. P&B quiere que salgan a buscar clientes nuevos y necesita visibilidad sobre eso.

**Requisitos expresados:**
- **Pipeline tipo HubSpot** (kanban de tarjetas) con etapas: entrada → hablando → reunión → propuesta → cerrado ganado / cerrado perdido.
- **Por negocio:** monto estimado de la primera compra (pronóstico) y fecha estimada de cierre.
- **Ficha del negocio/cliente:** datos de la empresa y **tarjetas de contactos** (nombre, cargo, correo, teléfono), notas de actividad ("tuvimos reunión, fue exitosa") y estado con fecha.
- **Visibilidad:** Rosley y la directiva ven el pipeline de toda la fuerza de ventas; cada vendedor ve solo el suyo. Los vendedores pueden crear clientes nuevos.
- **Propiedades configurables por admin:** Diego define los campos personalizados sin pedirle cambios al desarrollador.
- **Regla de cierre:** solo se puede pasar a "ganado" con contrato firmado o nota que lo justifique; "perdido" pide el motivo.
- **Qué es un negocio:** cliente nuevo **o** producto/línea nueva en un cliente existente (ej. Farmatodo codificando el Ice Arnica Spray, que no tenía). Una recompra no es negocio; un aumento sostenido del volumen mensual sí lo es.
- **Métricas:** dinero en juego por etapa y por vendedor, negocios cerrados por vendedor y mes, % de nuevos ingresos por vendedor.
- **Tracking GPS de vendedores** (lo pidió la directiva): ubicación de los vendedores en la calle, puerta a puerta. Falta definir si va dentro del tracker o como parte del módulo de ventas.
- **Fase 2 / en duda:**
  - Integración Outlook: log de correos enviados a los contactos de cada empresa. Se puede hacer (vía n8n / Microsoft Graph) pero es laborioso → fase 2.
  - WhatsApp: Diego mismo lo ve poco viable porque los teléfonos corporativos son también personales.

**Siguiente departamento:** Compras. Se acordó **cerrar primero ventas/CRM** y después reunirse con Compras.

## 3. Visión: hub de módulos

P&B quiere un **hub único** donde cada usuario ve las apps (módulos) a las que tiene acceso y entra con un clic. Ver [[largo-plazo/Mapa de Modulos del Hub|Mapa de Módulos del Hub]].
