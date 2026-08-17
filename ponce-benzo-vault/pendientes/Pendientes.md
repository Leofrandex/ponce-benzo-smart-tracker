---
title: Lista de Pendientes
date: 2026-05-22
tags:
  - pendientes
  - dudas
  - datos
---

# Lista de Pendientes — Ponzivenzo Smart Tracker

Este documento almacena las preguntas por resolver, datos necesarios por parte del negocio y tareas de investigación técnica pendientes de resolver.

---

## 🚧 Bloqueadores del rediseño del hub (2026-08-12)

Dependencias de la spec [[logs/Log-2026-08-12|Log-2026-08-12]]. Ninguna bloquea el diseño; todas bloquean algún paso de la puesta en producción.

1. **Excel de responsables por cliente** — ✅ *Recibido y procesado (2026-08-12)*. Archivado en `inbox/procesados/`. **Cubre 195 de 197 tiendas activas** sin trabajo manual: las asignaciones salen de las columnas *ASESOR* y *GERENTE DE DISTRITO*, deduplicadas por nombre → **11 personas, 33 filas** (sembradas en producción el 13-ago y verificadas). Pero **invalidó tres supuestos del diseño** — ver [[logs/Log-2026-08-12|Log-2026-08-12]] y §8 de la spec.
2. **Dirección remitente + administrador del DNS de `ponce-benzo.com`** — bloquea solo los correos. Hay que agregar registros SPF/DKIM para no caer en spam. Salida alterna si el cliente no puede tocar su DNS: enviar desde dominio propio con `responder-a` al de ellos.
3. **¿Milagros Fernández usa la APK?** — el rol `supervisor` desaparece y la app móvil aún lo tiene en sus tipos. Si solo entra por el hub, no hay nada que revisar.

### ❓ Preguntas al cliente derivadas del Excel de asesores (2026-08-12)

Ninguna bloquea el plan de implementación. Bloquean la siembra de asignaciones o los correos.

> [!NOTE] Resuelto por el cliente el mismo día
> **El gerente ve todo lo de sus clientes**, y la asignación se queda **a nivel de cliente**: que los 5 asesores de Locatel compartan sus 26 tiendas es aceptable porque todos reportan a Milagros. El gerente se modela como asignaciones explícitas, **sin jerarquía en RLS**. Se descarta `store_assignments`.

1. **¿El gerente de Locatel es Milagros o Jonathan?** El Excel se contradice: la columna del nombre dice `MILAGROS FERNÁNDEZ` en las 9 filas de Locatel y en Farmatención, pero la del correo dice `Jfernandez@`. Se asumió Milagros (el nombre es consistente en sus 23 filas).
2. **`DULCINEA 2019` y `HUMMY`** (1 tienda activa cada uno) no están en el Excel. ¿Quién las atiende?
3. **`FARMATUYA`, `TODO BARATIIICO`, `VIVA SUPERCENTRO`** están en el Excel pero no en el sistema. ¿Se incorporan al tracker?
4. **¿Qué son los buzones `Tracker*@ponce-benzo.com`?** (capital ×22, centroccidente ×4, occidente, FTD). Si son listas de distribución, las notificaciones quizá deban ir ahí.
5. **Iris Mujica, Yelitze Pérez, Nidia Rojas** (administración de ventas): ¿acceso al hub y con qué alcance?

---

## 🛑 Bloqueadores Críticos (Datos Requeridos)

Para realizar la migración completa a producción y conectar a los vendedores reales, el equipo de negocio de Ponce & Benzo debe definir:

1. **Correos Electrónicos de Vendedores:** ✅ *Resuelto (2026-06-07)* — el usuario entregó los correos reales (dominio `@ponce-benzo.com`); se incorporarán como `tools/vendedores.json` (mapeo nombre→correo) en el sub-proyecto de Ingesta.

   **Decisión de alcance (2026-06-07):** la primera ingesta trabaja **solo con las 4 rutas definidas** en `RUTAS 05-12-25 (1).xlsx`. Set inicial de cuentas (6):
   * Merchandisers (con ruta): **Elvis Rondón, Willian Fermín, Eduward Martínez, Carlos Zurita**.
   * Supervisor: **Milagros Fernández** (gerente de los 4 según `ESTRUCTURA P&B - LP`).
   * Admin (ve todo): **Rosli Aponte** (Director de Ventas).

   **Personal pendiente de alta** (sin ruta en este Excel — se agregan cuando sus zonas entren al tracker):
   * Mercaderista sin ruta: Jonathan Fernández.
   * Asesores sin ruta individual: Betsy Castro, Joseph Padilla, Juan León, Martha Viloria.
   * Gerentes de otras zonas (→ supervisor a futuro): Andreina Rangel, Diana Delgado, Dubraska Pérez.
   * Administración (rol por definir): Nidia Rojas, Yelitze Pérez, Iris Mujica.
   * ~~**"Aliado Comercial Caracas"**~~ ✅ *Resuelto (2026-08-12)* — el Excel de asesores lo aclara: `aliadocomercialcaracas@ponce-benzo.com` **es el correo de MARÍA RODRÍGUEZ**, asesora comercial y la que más cuentas tiene (8: Gama, Plazas, Plan Suárez, Emporium, Fresco Market, Viva Supercentro, Río Vida, La Muralla). No es un buzón genérico sin dueño. *(Queda aparte la duda de la **hoja 5 sin nombre** de `RUTAS` — mini-ruta Melani / Albita / Locatel La Castellana.)*
2. **Coordenadas GPS de Tiendas:** 🟢 *Gran avance (2026-07-14)* — el negocio entregó la data ampliada (`datos/fuentes/tiendas.xlsx`, ex `Coordenadas Tiendas 09 07 2026.xlsx`): **red multi-cadena nacional** (~19 cadenas). Ingesta rediseñada cargó **187 sucursales activas** (20 cadenas) con GPS/dirección/encargado + rutas jul→dic 2026. Ver [[logs/Log-2026-07-14|Log 2026-07-14]]. **Pendiente del negocio (Excel de revisión `datos/revision/tiendas-incompletas-2026-07-14.xlsx`, 138 filas):**
   - Completar día de visita / mercaderista / semana de las tiendas incompletas (col "Qué falta").
   - Corregir **4 coordenadas duplicadas** (2 pares: EL AVILA/LA CANDELARIA y INDIGO/RUBI comparten coordenada exacta) → hoy excluidas.
   - Aclarar **1 día ambiguo "MR"** (¿martes o miércoles?).
   Al recibir correcciones, se re-corre la ingesta (idempotente) para ampliar el piloto. *(Histórico: el piloto arrancó con 45 tiendas Farmatodo desde `Copia de CoordenadasTiendasFarmatodo REVISION.xlsx`, ahora superado; ver [[decisiones/ADR-004-Nivel-Cliente-Piloto-Farmatodo|ADR-004]].)*

---

## ⚙️ Pendientes de Desarrollo Técnico

- [x] **Carga del Excel de coordenadas del 2026-08-05** ✅ — validado en seco contra Supabase (`tools/ingesta/diffExcelVsDb.ts`) y cargado con `--commit`: **197 sucursales activas**, 470 rutas / 4.193 visitas hasta diciembre, historial preservado. Corrigió de paso el canal de **74 supermercados** mal clasificados como `otro` (typo "Super**n**ercados" en los Excel previos). Ver [[logs/Log-2026-08-05|Log 2026-08-05]].
  * Pendiente: **avisar a los mercaderistas** que recarguen la ruta — 5 tiendas cambiaron de día (FTD TEREPAIMA MAR→VIE, FTD LA CASTELLANA VE VIE→LUN, FTD ZONA FRANCA JUE→MIE, FTD GRACIELA VIE→MAR, RIO LOS NARANJOS MAR→MIE).
  * Pendiente del negocio: coordenadas de las **2 tiendas SABANA GRANDE** (TIO AMMI y MUNDO TOTAL) — siguen siendo las únicas 2 filas incompletas del archivo.

- [ ] **Fotos del hub para el rol `admin` (BUG-025, 2026-08-05)** — policy RLS corregida **en producción** ✅ y fix de código **desplegado** ✅ (monorepo `b95439e`; commit espejo `e658b1f` en `Leofrandex/ponce-benzo-hub`, deploy Vercel `READY`).
  * Pendiente: confirmar con el coordinador que ya ve las fotos en la ficha de sucursal.
  * A futuro: si entran gerentes de otras zonas, revisar si necesitan acceso a fotos fuera de la cadena supervisor↔mercaderista.

- [x] **Corrección de 5 rutas (Día de visita)** ✅ *(2026-07-23)* — el usuario cargó un Excel actualizado; validado contra Supabase: coordenadas sin cambios, las correcciones eran 5 cambios de día de visita (LA CASTELLANA VE LUN→VIE, RIOFARO JUE→LUN, CLAVELINAS JUE→LUN-JUE, MUCURA LUN→VIE, MONICA LUN→MIE). Aplicadas quirúrgicamente en `datos/fuentes/tiendas.xlsx` + `import-data.ts --commit` (191 sucursales actualizadas, 458 rutas regeneradas, historial preservado). Verificado en `routes`. Ver [[logs/Log-2026-07-23|Log 2026-07-23]].
  * Pendiente: **avisar a los mercaderistas afectados** que recarguen su ruta en la app (los días cambiaron).
  * Pendiente: commitear a git `datos/fuentes/tiendas.xlsx` + archivos del vault.
- [x] **Carga del Excel definitivo de rutas** ✅ *(2026-07-17, sesión 2)* — cargado con `--commit` tras el OK del usuario: 188 sucursales actualizadas + 3 creadas (191 activas), 476 rutas (4.122 visitas) jul→dic, historial preservado. BUG-024 resuelto en la ingesta (llave `cliente+coord+nombre` + matching por nombre en coords compartidas — el negocio descartó el micro-offset). Verificado: la ruta del viernes de Willian ya incluye FTD INDIGO y FTD RUBI; AVILA/LA CANDELARIA reactivadas con su historial. Ver [[logs/Log-2026-07-17|Log 2026-07-17]].
  * Pendiente: coordenadas de las 2 filas **SABANA GRANDE** (Eduward, MIE) — siguen fuera del catálogo por falta de coord.
  * Pendiente: commitear a git los cambios de `tools/ingesta/`.
  * Avisar a Willian que recargue la ruta en la app para ver las 2 tiendas hoy.
- [ ] **Post mejoras hub (2026-07-16, sesión 2):**
  * ~~Mergear a `master` y pushear~~ ✅ hecho (merge `fc11f29`, push a origin con los 27 commits acumulados). **Desplegado en Vercel** ✅ (commit espejo `1d21873` en `Leofrandex/ponce-benzo-hub`).
  * > [!IMPORTANT] **Deploy del hub**: Vercel despliega desde el repo espejo `Leofrandex/ponce-benzo-hub` (contenido de `hub/` en la raíz), NO desde el monorepo. Tras cambios en `hub/`: espejar `app/`+`public/`+configs al repo espejo y pushear a `master` con autor `sebastiancm7162@gmail.com` (Vercel bloquea el email autogenerado de la máquina). A futuro: unificar apuntando Vercel al monorepo con root `hub/`.
  * Semántica de "Resueltas" en el dashboard: cuenta tareas resueltas *creadas* en el período (no existe `resolved_at`); decidir si se agrega la columna para contar por fecha de resolución.
  * ~~Limpieza de datos: el cliente viejo "Farmatodo"~~ ✅ *(2026-07-17)* — eliminado junto con sus 84 tiendas huérfanas del seed; FTD AVILA y FTD LA CANDELARIA (con historial) reasignadas a `FARMATODO,C.A.`. Además, nombres de clientes estandarizados a MAYÚSCULAS (`GAMA`, `LOCATEL`, `PLAZA'S`). Ver [[logs/Log-2026-07-17|Log 2026-07-17]].
  * ~~Refactor menor: helper compartido `signPhotoPaths()` (3 copias en `reports.ts`/`visitDetail.ts`) con manejo del error de firmado~~ ✅ *(2026-08-05)* — hecho como parte de `BUG-025`: `hub/app/lib/queries/photos.ts` (`signVisitPhotos`/`signedPhotoUrls`), las 3 copias eliminadas y las fotos sin permiso ya no se renderizan como imagen rota. Queda pendiente la a11y de thumbnails (role/tabIndex) como barrida única.
- [ ] **🔥 Post BUG-022 (2026-07-16) — ingesta debe hacer *match-y-actualizar*:**
  * Corregir `tools/ingesta/` para que al re-ingestar haga match de tiendas existentes (cliente+coordenada o dirección normalizada) y las **actualice** en vez de desactivar-y-crear; si no, cada re-ingesta vuelve a dejar el historial (visitas/contactos/tareas/rutas) huérfano. Ver [[logs/Log-2026-07-16|Log 2026-07-16]].
  * Decidir con el negocio qué hacer con **FTD AVILA** y **FTD LA CANDELARIA** (Sambil La Candelaria, 1 visita c/u): *(avance 2026-07-17)* reasignadas al cliente `FARMATODO,C.A.` (inactivas, historial visible bajo el cliente correcto); entrarán al catálogo cuando se resuelva BUG-024 y se cargue el Excel del 17-jul.
  * Borrar las tablas de respaldo `_mig_*_20260716` de Supabase cuando se confirme en el hub que el historial migrado se ve bien.
- [ ] **🔥 Post-fix motor offline (2026-07-15, BUG-020/021) — validación en campo:**
  * Pedir a Eduward y Elvis abrir la app con WiFi ~2 min (antes de salir a ruta) para rescatar los registros del 15-jul atrapados en sus teléfonos; validar contra la DB (jornada de Elvis completa + visitas de Eduward posteriores a las 12:46 UTC).
  * Distribuir el build con los fixes (OTA vía `expo-updates` si el canal lo permite — no se agregaron módulos nativos a propósito; si no, APK nuevo).
  * Investigar por qué el teléfono de Elvis no subió ni los `device_logs` del 15-jul (¿app nunca abierta con conexión? ¿auth caducada?).
  * Considerar dead-letter para fotos con URI perdida (hoy reintentan por siempre; el registro ya está a salvo).
- [x] **Configuración de Variables de Entorno:** ✅ *(2026-06-07)* `hub/.env.local` y `.env` raíz con las claves del proyecto nuevo `poncebenzo`; handshake Python verificado.
- [x] **Modificar Ingesta de Excel:** ✅ *(2026-06-08)* `tools/import-data.ts` reescrito como pipeline idempotente (`tools/ingesta/`). Cargó 6 usuarios + 192 tiendas + 20 rutas. **Cambio de fuente:** las tiendas salen de `RUTAS`, no de MAESTRO (ver [[arquitectura/Ingesta - Mapeo de Datos|Mapeo]]). Falta el **enriquecimiento** de sucursales (dirección/encargado/clasificación/GPS) → [[pendientes/Solicitud de Datos a P&B|Solicitud a P&B]].
- [ ] **Validación de RLS Móvil:**
  * Probar que las llamadas a la base de datos de Supabase desde la app móvil respeten estrictamente la restricción de que un mercaderista solo vea sus propias visitas y rutas.
- [ ] **Compresión de Imágenes:**
  * Implementar compresión automática de imágenes utilizando `expo-image-manipulator` en la aplicación móvil antes de guardarlas en disco para evitar saturación del storage.

---

## 🧩 Pendientes del Modelo de Datos CRM (ADR-002)

- [ ] **Normalizar zona geográfica:** mover `stores.estado` / `municipio` / `urbanizacion` (hoy texto libre, decisión D3) a tablas lookup normalizadas a futuro para evitar inconsistencias de escritura.
- [x] **Restricción `tasks.status` en Supabase:** ✅ *(2026-06-07)* el schema v2.0 nace con `CHECK (status IN ('open','resolved'))`, columna `description` (el trigger copia las observaciones del check-in) y sin `priority` (eliminada también del UI del hub). Tipo `Task` del hub reconciliado.
- [/] **Cablear el bloque hub a Supabase:** ✅ *lectura hecha (2026-06-08)* — las 5 superficies leen datos reales vía RLS (`queries/*.ts` + `useSupabaseQuery`), auth real con `@supabase/ssr`. Ver [[logs/Log-2026-06-08-hub|Log Hub]]. **Falta la ESCRITURA** (CRUD de contactos/sucursales/engagements, resolver tareas) y los joins de nombres para los gráficos del dashboard y el feed de tareas (hoy en estado vacío). Ver siguiente ítem.
- [x] **Cablear hub — escritura (CRM):** ✅ *(2026-06-08)* `EngagementsPanel` crear/cerrar, CRUD de `contacts` (encargado único vía RPC) y edición de `stores`, resolver `tasks`. Mutación+refetch, verificado E2E. Ver [[logs/Log-2026-06-08-hub-escritura|Log]].
- [ ] **Hub — joins de nombres (depende del mobile):** reconciliar `SupervisorTask` (UI mock) con `Task`/`FullTaskRow` y joinar `visits`→`users`/tienda para mostrar nombres en `ActivityFeed`, `AnomaliesByClientChart`, `StoresPerMerchandiserChart`, `TasksProgress` (hoy en estado vacío). Inútil hasta que el mobile genere visitas. Pendiente menor: desmarcar encargado actual; crear sucursales nuevas desde el hub.
- [ ] **CRM funcional (cablear engagements):** `EngagementsPanel` funciona sobre estado local (mock) desde la sesión 2026-06-06; al cablear, persistir crear/cerrar en `contact_engagements` de Supabase.
- [ ] **Cablear CRUD de contactos y de sucursales:** desde 2026-06-06 la ficha del cliente permite crear/editar/eliminar contactos (encargado único) y editar toda la info de la sucursal (zona, canal, clasificación, GPS, activa/desactivar); la lista de Clientes permite crear sucursales nuevas. Todo sobre estado local. Al cablear: INSERT/UPDATE/DELETE en `contacts` (el delete debe borrar también en Supabase), INSERT/UPDATE en `stores`. ~~Garantizar encargado único en BD~~ ✅ resuelto en schema v2.0 (índice único parcial `uq_contacts_primary_per_store`); las políticas de escritura de `stores` para staff también ya existen.
- [ ] **Ingesta de `MAESTRO.xlsx` (columnas CRM):** mapear las columnas de estado / municipio / urbanización / canal / clasificación del Excel a las nuevas columnas de `stores`.
- [x] **GAP — Crear `location_pings` en Supabase:** ✅ *(2026-06-07)* creada en el schema v2.0 con GEOGRAPHY generada, índices (incl. GiST) y RLS (dueño escribe/lee, supervisor lee). El SQLite local ganó `user_id` para el sync 1:1.
- [x] **Endurecer RLS `tasks_assignee`:** ✅ *(2026-06-07)* reemplazada en v2.0 por `tasks_select` + `tasks_update` (sin INSERT de cliente — solo el trigger `SECURITY DEFINER` crea tareas).
- [ ] **Recolección de data para features de largo plazo:** definir quién y cómo recolecta la data para el histórico de rotación de productos y el anaquel de exhibición ideal. Ver [[largo-plazo/Historico Rotacion Productos|Histórico de Rotación]] y [[largo-plazo/Anaquel Exhibicion Ideal|Anaquel de Exhibición Ideal]].

---

## 📱 Bloque Mobile (completado 2026-06-02)

- [x] **Bloque Mobile (UI/UX):** rutas especiales (personalizables), agregar/quitar sucursal, fecha de última reposición en el check-in, dropdowns de omisión y anomalía (Ionicons, bottom-sheet), y reportaje de competencia (slide-over). Implementado mock-first sobre SQLite. Ver [[logs/Log-2026-06-02-bloque-mobile|Log Bloque Mobile]] y [[pendientes/Bloque Mobile|Bloque Mobile — Requisitos]].
- [ ] **Follow-ups menores de calidad (no bloqueantes):**
  * ~~`CompetitionTab` usa `top: 200` fijo~~ — la pestaña fue rediseñada (más finita, `top: 170`) y ahora vive dentro del check-in (2026-06-06). Verificar alineación en pantallas chicas durante QA de dispositivos.
  * `addStoreToRoute` hace no-op silencioso si el `storeId` no existe — agregar `console.warn` al cablear data real.
  * Evaluar (decisión de producto) si el botón "Agregar sucursal" debe ocultarse mientras la sesión está activa (hoy se oculta sólo al finalizar la ruta).
- [x] **Cablear el bloque mobile a Supabase:** ✅ *(2026-06-15)* login + rutas (2026-06-08) y **motor de sync** (2026-06-15): cola SQLite→Supabase de sessions/pings/visits/competencia + subida de fotos a Storage (`photo_uri` JSON local → `photo_urls`), casi en vivo e idempotente. Ver [[logs/Log-2026-06-15-mobile-sync|Log Mobile Sync]]. **Pendiente:** E2E en dispositivo. ✅ *signed URLs en el hub (2026-06-18, BUG-007)*; ✅ *sync de pings en background + pings por tiempo (2026-06-18, BUG-010)* — falta validar en build EAS (el background sólo corre en APK, no en Expo Go). ✅ *estado de sesión por día / no reiniciar ruta finalizada (2026-06-18, BUG-009)*.
- [ ] **Al cablear visitas a Supabase:** `visits.photo_uri` local guarda JSON de URIs → subir a Storage (`visit-photos`) y mapear a `photo_urls`. Aplica tanto a fotos de la visita como al reporte de competencia adjunto.
- [x] **Caché offline de ruta:** ✅ *(2026-07-05)* `routeCache.ts` guarda un snapshot (ruta+tiendas) en la tabla `meta` de SQLite; `loadRoute` pasa a network-first con fallback a caché → un cold-start **sin conexión** muestra la ruta guardada y deja empezar la jornada (antes: pantalla de error, trabado). Banner "Modo offline" en `RouteScreen`. 6 tests TDD. Ver [[logs/Log-2026-07-05|Log 2026-07-05]]. **Pendiente:** validar en dev client Android.
- [x] **Bloque Productos, Supervisión y Reportes Sueltos:** ✅ *(2026-08-17)* tabla `products` (34 SKUs), vínculos `visit_anomaly_products`, banderas de supervisión `users.is_supervisor` / `visits.supervisor_present_user_id`, selector de productos en check-in, servicio offline/sync, pestaña "Reporte" para supervisores/admins y cálculo de cobertura en el hub. 31/31 tests pasando. Ver [[logs/Log-2026-08-17|Log 2026-08-17]] y [[decisiones/ADR-007-Productos-Y-Supervision-Movil|ADR-007]].
  * **Pendiente:** Distribuir nuevo build móvil (APK / OTA) a mercaderistas y supervisores.
  * **Pendiente:** Avisar a Jonathan (`jfernandez@ponce-benzo.com`) sobre su nueva pestaña "Reporte" y el registro de acompañamiento.
- [ ] **Pruebas manuales en Expo** (emulador/dispositivo) del flujo completo mobile.

## Enlaces Relacionados
- [[pendientes/Bloque Mobile|Bloque Mobile — Requisitos de UI/UX]] — alcance detallado de la próxima sesión.
- [[roadmap/Roadmap|Roadmap del Proyecto]] — Hitos del desarrollo general.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — Decisiones del esquema CRM.
- [[resumen/Constitucion|Constitución]] — Reglas y restricciones a respetar en las soluciones.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — Tablas destino de los datos a importar.
