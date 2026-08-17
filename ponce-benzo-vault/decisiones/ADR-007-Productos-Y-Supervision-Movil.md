---
title: "ADR-007 — Productos en anomalías, supervisión y reportes sueltos"
date: 2026-08-17
tags:
  - adr
  - decision
  - mobile
  - schema
---

# ADR-007 — Productos en anomalías, supervisión de Jonathan y reportes sueltos

**Estado:** `aceptado`
**Fecha:** 2026-08-17
**Spec:** `docs/superpowers/specs/2026-08-17-productos-y-supervision-movil-design.md`

## Contexto

El cliente pidió tres cambios sobre la app móvil que comparten superficie (el
check-in y el detalle de visita del hub):

1. Que el mercaderista pueda señalar **a qué productos corresponde** una
   anomalía —opcional y múltiple— y que el hub lo muestre. Entregó su catálogo
   (34 SKUs, 8 marcas) en `datos/inbox/SKU EMPRESA.xlsx`; no existía tabla de
   productos.
2. Que quede rastro de **cuándo Jonathan acompaña** a un mercaderista en su
   ruta como supervisor. Jonathan está cargado como `merchandiser` y el rol
   `supervisor` no existe en la base, pese a que `mobile/src/types.ts` lo declara.
3. Que **Jonathan y los admins puedan levantar reportes de cualquier sucursal**
   sin ruta previa: Jonathan cuando cubre a un mercaderista ausente, los admins
   cuando visitan una sucursal y encuentran algo.

## Decisión

### 1. Los productos se vinculan por tipo de anomalía, con tabla puente aditiva

Tabla `visit_anomaly_products (visit_id, anomaly_type, product_id)`, más la
tabla de catálogo `products` (`sku` único, `name`, `brand` derivada, EANs,
unidades, `active`).

**`visits.anomaly_type` se mantiene como `TEXT[]`.** Es coherente con
[[decisiones/ADR-005-Anomaly-Type-Array|ADR-005]], que ya había descartado una
tabla `visit_anomalies` por complejidad de sincronización: el array sigue siendo
la fuente de verdad y el vínculo con productos se agrega al lado, sin tocar el
trigger de tareas, `fn_dash_anomalias` ni el dashboard.

La granularidad es **por tipo de anomalía y no por visita** porque el trigger ya
crea una tarea por cada tipo: así cada tarea arrastra exactamente sus productos.
Un trigger de validación rechaza vínculos cuyo `anomaly_type` no esté en la
visita referenciada.

### 2. `users.is_supervisor` en vez de un rol nuevo

Jonathan conserva `role = 'merchandiser'` y gana la bandera. La bandera habilita
el reporte suelto, lo incluye en el selector "supervisor presente" y lo etiqueta
en el hub.

Se descartó agregar un cuarto rol porque `fn_is_merchandiser()` gobierna las
políticas RLS de `stores`, `clients` y `contacts`
([[decisiones/ADR-006-Alcance-Por-Cliente|ADR-006]]): un rol nuevo obligaría a
reauditarlas todas para que el supervisor no perdiera ruta ni catálogo offline.

### 3. El acompañamiento se registra por visita, no por jornada

`visits.supervisor_present_user_id` (nullable), que **marca el mercaderista** en
el check-in. Se evaluó y descartó que Jonathan lo declarara por jornada desde su
propia app, lo que habría aportado su rastro GPS como evidencia.

### 4. El reporte suelto reutiliza ruta especial + jornada corta

Se aprovecha el andamiaje que existía a medias (`routes.is_special`, `routeMode`,
`StorePickerSheet`) y que hoy no funciona porque lee de `mobile/src/mock-data.ts`
en vez de Supabase. El GPS se enciende al abrir el reporte y se apaga al
enviarlo; no hay rastreo de fondo.

Esto **preserva `NOT NULL` en `sessions.route_id` y `visits.session_id`**, sin
migración de nulabilidad. Requiere reemplazar `UNIQUE (user_id, route_date)` de
`routes` por dos índices únicos parciales, para permitir una ruta normal y una
especial el mismo día.

### 5. El reporte suelto cubre la ruta del ausente

`fn_dash_cumplimiento` deja de exigir `v.user_id = e.uid` en exclusiva: una
parada planificada cuenta como cumplida si la visitó su titular **o** si un
supervisor/admin la reportó como reporte suelto ese día. La función devuelve una
columna `cubiertas` para que el hub muestre el matiz.

## Consecuencias

**A favor**
- Ningún consumidor actual de `visits.anomaly_type` se rompe: todo el cambio de
  productos es aditivo.
- Las políticas RLS probadas en el ADR-006 no se tocan.
- No hace falta migrar nulabilidad de columnas con historial cargado.
- Se salda de paso la deuda de `mock-data.ts` en el selector de tiendas.

**En contra / riesgos**
- El registro del acompañamiento depende de la disciplina del mercaderista y no
  tiene GPS que lo respalde. Si resulta escaso en la práctica, la alternativa
  descartada sigue disponible como iteración futura.
- El cambio en `fn_dash_cumplimiento` puede mover porcentajes históricos. Hoy el
  efecto es nulo —no hay ninguna ruta `is_special` cargada—, pero conviene
  comunicarlo.
- Este bloque **sí exige publicar una app móvil nueva**, a diferencia del
  anterior.
- `mobile/src/types.ts` declara un rol `supervisor` inexistente en la base; se
  corrige al tocar el tipo `User`.
