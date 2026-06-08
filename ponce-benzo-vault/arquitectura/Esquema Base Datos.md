---
title: Esquema de Base de Datos
date: 2026-05-22
tags:
  - arquitectura
  - base-de-datos
  - sql
  - supabase
  - sqlite
---

# Esquema de Base de Datos — Ponzivenzo Smart Tracker

La base de datos utiliza una estructura híbrida: **Supabase (PostgreSQL + PostGIS)** como fuente centralizada y **SQLite** en los dispositivos móviles para el almacenamiento fuera de línea (*Offline-First*).

---

## 🗃️ Esquema del Servidor (Supabase PostgreSQL)

### 1. Tabla: `users`
Contiene la información de los usuarios y define la jerarquía organizacional.
*   `id` (`UUID`, PK, referencias a `auth.users(id)`).
*   `full_name` (`TEXT`): Nombre completo del mercaderista o supervisor.
*   `email` (`TEXT`): Dirección de correo de acceso.
*   `role` (`TEXT`): Rol del usuario (`merchandiser`, `supervisor`, `admin`).
*   `supervisor_id` (`UUID`, auto-FK -> `users.id`, `ON DELETE SET NULL`): Supervisor responsable del vendedor. Un vendedor tiene como máximo un supervisor (decisión D2 del [[decisiones/ADR-002-Modelo-CRM|ADR-002]]).
*   `active` (`BOOLEAN`, por defecto `true`): Permite suspender temporalmente el acceso.
*   `created_at` (`TIMESTAMPTZ`).

### 2. Tabla: `stores`
El maestro de tiendas cargado desde el archivo `MAESTRO.xlsx`.
*   `store_id` (`UUID`, PK).
*   `name` (`TEXT`): Nombre del comercio.
*   `address` (`TEXT`): Dirección física completa.
*   `master_lat` (`DOUBLE PRECISION`): Latitud maestra para geofencing.
*   `master_lng` (`DOUBLE PRECISION`): Longitud maestra para geofencing.
*   `master_location` (`GEOGRAPHY(POINT, 4326)`): Campo autogenerado en Postgres usando `ST_MakePoint` para habilitar operaciones espaciales.
*   `estado` (`TEXT`): Zona geográfica — estado (desnormalizado, decisión D3).
*   `municipio` (`TEXT`): Zona geográfica — municipio (desnormalizado, decisión D3).
*   `urbanizacion` (`TEXT`): Zona geográfica — urbanización (desnormalizado, decisión D3).
*   `business_channel` (`TEXT`, `CHECK`): Canal de negocio. Valores: `drogueria`, `farmacia`, `supermercado`, `autoservicio`, `mayorista`, `otro` (decisión D4).
*   `classification` (`TEXT`, `CHECK`): Clasificación comercial. Valores: `A`, `B`, `C` (decisión D4).
*   `active` (`BOOLEAN`, por defecto `true`).

### 3. Tabla: `routes`
Planificación diaria de visitas de los mercaderistas.
*   `route_id` (`UUID`, PK).
*   `user_id` (`UUID`, FK -> `users.id`): Mercaderista asignado.
*   `route_date` (`DATE`): Fecha programada de la ruta.
*   `store_ids` (`UUID[]`): Arreglo ordenado con las llaves de tiendas asignadas para ese día.
*   `is_special` (`BOOLEAN`, por defecto `false`): Marca rutas especiales (ej. 24/31 dic).
*   *Restricción:* Llave única compuesta en (`user_id`, `route_date`).

### 4. Tabla: `sessions`
Control de jornada de trabajo diario.
*   `session_id` (`UUID`, PK).
*   `user_id` (`UUID`, FK -> `users.id`).
*   `route_id` (`UUID`, FK -> `routes.route_id`).
*   `session_start` (`TIMESTAMPTZ`): Registra la fecha/hora en que presiona "Empezar Ruta".
*   `session_end` (`TIMESTAMPTZ`, opcional): Registra cuándo presiona "Finalizar Ruta".
*   `start_location` (`JSONB`): Coordenadas iniciales del teléfono `{ lat, lng }`.

### 5. Tabla: `visits`
Formulario de check-in y evidencias recopiladas en cada tienda.
*   `visit_id` (`UUID`, PK).
*   `session_id` (`UUID`, FK -> `sessions.session_id`).
*   `store_id` (`UUID`, FK -> `stores.store_id`).
*   `user_id` (`UUID`, FK -> `users.id`).
*   `check_in_time` (`TIMESTAMPTZ`).
*   `check_in_location` (`JSONB`): Ubicación del dispositivo al capturar la foto `{ lat, lng }`.
*   `photo_urls` (`TEXT[]`): Enlaces de las fotos cargadas en el storage bucket `visit-photos`.
*   `observations` (`TEXT`).
*   `status` (`TEXT`): Estado de la visita (`completed`, `skipped`, `anomaly`).
*   `anomaly_type` (`TEXT`, `CHECK`): Tipo de anomalía detectada. Valores: `sin_stock`, `cambio_planograma`, `diferencia_precios`, `producto_danado`, `otro`. Dispara el trigger de creación de tareas (ver abajo).
*   `skip_reason` (`TEXT`, `CHECK`): Motivo de omisión cuando `status = 'skipped'`. Valores: `fuera_de_ruta`, `sin_acceso`, `otro`.
*   `last_restock_date` (`DATE`): Fecha de reabastecimiento registrada en esta visita.
*   `synced` (`BOOLEAN`, por defecto `false`): Determina el estatus de la subida a Postgres.

> [!NOTE]
> La **"última fecha de reabastecimiento"** de un cliente es un valor **derivado**, no almacenado en `stores`: se calcula como `MAX(visits.last_restock_date)` por tienda.

> [!IMPORTANT]
> El cliente debe escribir `status = 'anomaly'` y `anomaly_type` en el **mismo INSERT** (regla "Payload Completa"). El trigger depende de `anomaly_type` para generar la tarea correcta.

### 6. Tabla: `location_pings` (Rastreo continuo)
*   `ping_id` (`UUID`, PK).
*   `session_id` (`UUID`, FK -> `sessions.session_id`, nullable — el ping puede llegar antes de resolver la sesión).
*   `user_id` (`UUID`, FK -> `users.id`, `NOT NULL`): Autor del ping (v2.0 — evita inferirlo al sincronizar).
*   `timestamp` (`TIMESTAMPTZ`).
*   `lat` / `lng` (`DOUBLE PRECISION`).
*   `location` (`GEOGRAPHY(POINT, 4326)`, generada): Punto geográfico, con índice GiST para el mapa de calor histórico.

> [!NOTE]
> Creada en el Schema v2.0 (2026-06-07) — el gap histórico quedó resuelto. Ver [[arquitectura/Spec - Supabase Schema v2|Spec v2.0]] y [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]].

---

## 🧩 Tablas CRM (ADR-002)

Las siguientes tablas amplían el modelo para capacidades de CRM. Ver el detalle de diseño en [[decisiones/ADR-002-Modelo-CRM|ADR-002]].

### 7. Tabla: `contacts`
Varios contactos por tienda (encargado, comprador, gerente).
*   `contact_id` (`UUID`, PK).
*   `store_id` (`UUID`, FK -> `stores.store_id`).
*   `full_name` (`TEXT`): Nombre completo del contacto.
*   `role_title` (`TEXT`): Cargo (ej. comprador, gerente).
*   `phone` (`TEXT`).
*   `email` (`TEXT`).
*   `birthday` (`DATE`): Cumpleaños del contacto (alimenta la futura [[largo-plazo/Bitacora Cumpleanos|Bitácora de Cumpleaños]]).
*   `is_primary` (`BOOLEAN`): Marca el contacto principal de la tienda.
*   `active` (`BOOLEAN`).
*   `created_at` (`TIMESTAMPTZ`).
*   *Restricción (v2.0):* índice único parcial `uq_contacts_primary_per_store` — a lo sumo **un** contacto `is_primary AND active` por tienda (encargado único garantizado en BD).

### 8. Tabla: `contact_engagements`
Bitácora estructurada de interacciones con contactos (decisión D5).
*   `engagement_id` (`UUID`, PK).
*   `store_id` (`UUID`, FK -> `stores.store_id`).
*   `contact_id` (`UUID`, FK -> `contacts.contact_id`).
*   `author_user_id` (`UUID`, FK -> `users.id`): Autor del registro.
*   `type` (`TEXT`, `CHECK`): `note` | `todo`.
*   `body` (`TEXT`): Contenido de la nota o pendiente.
*   `status` (`TEXT`, `CHECK`): `open` | `done`.
*   `due_date` (`DATE`): Fecha límite (para `type = 'todo'`).
*   `created_at` (`TIMESTAMPTZ`).

### 9. Tabla: `tasks`
Tareas accionables. Se asignan al **supervisor del vendedor** (decisión D1).
*   `task_id` (`UUID`, PK).
*   `assignee_user_id` (`UUID`, FK -> `users.id`): Responsable (típicamente el supervisor).
*   `created_by_user_id` (`UUID`, FK -> `users.id`).
*   `store_id` (`UUID`, FK -> `stores.store_id`).
*   `source_visit_id` (`UUID`, FK -> `visits.visit_id`): Visita que originó la tarea (si vino de una anomalía).
*   `task_type` (`TEXT`): Tipo de tarea (ej. `reponer_stock`, `contactar_comprador`, `contactar_gerente`, `revisar_anomalia`).
*   `title` (`TEXT`).
*   `description` (`TEXT`, v2.0): Detalle/contexto — el trigger copia `visits.observations`; las tareas manuales futuras la usan como texto libre.
*   `status` (`TEXT`, `CHECK`, v2.0): `open` | `resolved` (alineado con el UI del hub; sin `priority` por decisión de producto).

### 10. Tabla: `competitor_brands`
Catálogo editable de marcas de la competencia (decisión D6 — lookup, no enum fijo).
*   `brand_id` (`UUID`, PK).
*   Campos de identificación de la marca (nombre, etc.).

### 11. Tabla: `competition_reports`
Reportes de actividad de la competencia observada en tienda.
*   `report_id` (`UUID`, PK).
*   `session_id` (`UUID`, FK -> `sessions.session_id`).
*   `visit_id` (`UUID`, FK -> `visits.visit_id`, v2.0): Check-in al que está ligado el reporte (la competencia se reporta dentro del check-in desde 2026-06-06).
*   `store_id` (`UUID`, FK -> `stores.store_id`).
*   `user_id` (`UUID`, FK -> `users.id`).
*   `brand_id` (`UUID`, FK -> `competitor_brands.brand_id`).
*   `activation_type` (`TEXT`, `CHECK`): `promocion`, `material_pop`, `espacios_exhibiciones`, `impulso_activacion`, `degustacion`, `otro`.
*   `photo_urls` (`TEXT[]`): Fotos de la actividad de competencia.
*   `notes` (`TEXT`).
*   `created_at` (`TIMESTAMPTZ`).
*   `synced` (`BOOLEAN`): Estatus de sincronización desde el espejo local.

---

## ⚡ Trigger: Anomalía → Tarea

Cuando una visita se inserta con `status = 'anomaly'`, el trigger `trg_visit_anomaly_task` genera automáticamente una tarea para el **supervisor del vendedor** (`users.supervisor_id`).

- **Función principal:** `fn_create_task_from_anomaly` — crea la fila en `tasks` con el `assignee_user_id` = supervisor del vendedor de la visita.
- **Función de mapeo:** `fn_task_type_from_anomaly` — traduce `anomaly_type → task_type`:

| `anomaly_type` | `task_type` generado |
| :--- | :--- |
| `sin_stock` | `reponer_stock` |
| `cambio_planograma` | `contactar_comprador` |
| `diferencia_precios` | `contactar_comprador` |
| `producto_danado` | `contactar_gerente` |
| `otro` | `revisar_anomalia` |

> [!NOTE]
> Ambas funciones aplican `SET search_path = ''` como medida de *hardening* (evita secuestro de esquema). La invariante de "Payload Completa" exige que `anomaly_type` viaje en el mismo INSERT que `status = 'anomaly'`.

> [!IMPORTANT]
> **v2.0:** `fn_create_task_from_anomaly` es `SECURITY DEFINER` (el lookup del supervisor y el INSERT en `tasks` no dependen del RLS del caller); la tarea nace con `status = 'open'` y `description = visits.observations`. Ambas funciones tienen `REVOKE EXECUTE` para `anon`/`authenticated` (no son invocables vía RPC).

---

## 🔒 Row Level Security (RLS) en Supabase

Para garantizar que los mercaderistas no puedan ver información confidencial de otros vendedores ni sabotear rutas ajenas, se habilitan las siguientes políticas:

- **Tabla `stores`:** Todos los usuarios autenticados tienen permisos de lectura (`SELECT`) globales. **v2.0:** `supervisor`/`admin` además pueden `INSERT`/`UPDATE` (CRUD de sucursales del hub); sin `DELETE` — se desactiva con `active = false`.
- **Tabla `users`:** El mercaderista solo puede ver/modificar su propio perfil (`auth.uid() = id`).
- **Tabla `routes`:** El mercaderista solo puede leer rutas asignadas a él (`auth.uid() = user_id`).
- **Tabla `sessions`:** Permisos completos (`ALL`) concedidos si el creador de la sesión coincide con `auth.uid()`.
- **Tabla `visits`:** Permisos completos (`ALL`) concedidos si el check-in pertenece a `auth.uid()`.

### Políticas CRM nuevas (ADR-002)

- **Tablas `contacts`, `contact_engagements`, `tasks`, `competitor_brands`, `competition_reports`:** habilitadas con políticas propias para los flujos de CRM.
- **`tasks` (v2.0):** sin política de `INSERT` para clientes — solo el trigger `SECURITY DEFINER` crea tareas. `tasks_select`/`tasks_update` para asignado, creador o supervisor del creador (el viejo `WITH CHECK (true)` quedó eliminado).
- **`competition_reports` (v2.0):** el autor gestiona lo suyo (`comp_reports_own`); el supervisor tiene **solo lectura** sobre los reportes de sus vendedores (`comp_reports_supervisor_read`).

### Visibilidad de Supervisor

Se agregan políticas de lectura para que un supervisor vea a su equipo, comparando `users.supervisor_id = auth.uid()`:

- **`users_supervisor_read`:** el supervisor lee los perfiles de sus vendedores.
- **`routes_supervisor_read`:** el supervisor lee las rutas de sus vendedores.
- **`visits_supervisor_read`:** el supervisor lee las visitas de sus vendedores.
- **`sessions_supervisor_read` (v2.0):** el supervisor lee las jornadas de sus vendedores (mapa en vivo).
- **`pings_supervisor_read` (v2.0):** el supervisor lee los pings GPS de sus vendedores (mapa de calor).

> [!IMPORTANT]
> **Visibilidad global del rol `admin` (2026-06-08).** El Director de Ventas (Rosli Aponte) tiene rol `admin` y debe ver **todo** — gerentes y, en cascada, los asesores de esos gerentes. Como la visibilidad de supervisor es de un solo nivel (`supervisor_id = auth.uid()`), se agregaron políticas `*_admin_read` de lectura global sobre `users`, `routes`, `sessions`, `location_pings`, `visits`, `tasks` y `competition_reports`. El chequeo usa la función `public.fn_is_admin()` (`SECURITY DEFINER`, `REVOKE EXECUTE` de `anon`) para **evitar la recursión infinita** que provocaría una política sobre `users` que consulte `users`. Verificado E2E: el admin ve datos dos niveles abajo; un mercaderista no-admin sigue viendo solo lo suyo.

### Storage (v2.0)

Bucket privado **`visit-photos`** con políticas por carpeta de usuario (`{user_id}/{visit_id}/{timestamp}.jpg`): el usuario autenticado solo sube bajo su propia carpeta (`storage.foldername(name)[1] = auth.uid()`); leen el dueño y su supervisor.

---

## 📱 Esquema Local (Mobile SQLite)

Para el funcionamiento offline de la app móvil, se inicializa el archivo `poncebenzo.db` con tres tablas locales espejo que retienen los pings y las visitas temporalmente:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  session_id   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  route_id     TEXT NOT NULL,
  session_start TEXT NOT NULL,
  session_end  TEXT,
  start_lat    REAL,
  start_lng    REAL,
  synced       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS location_pings (
  ping_id      TEXT PRIMARY KEY,
  session_id   TEXT,
  timestamp    TEXT NOT NULL,
  lat          REAL NOT NULL,
  lng          REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  visit_id     TEXT PRIMARY KEY,
  session_id   TEXT,
  store_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  check_in_time TEXT NOT NULL,
  lat          REAL,
  lng          REAL,
  photo_uri    TEXT,
  observations TEXT,
  status       TEXT NOT NULL,
  anomaly_type TEXT,
  skip_reason  TEXT,
  last_restock_date TEXT,
  synced       INTEGER NOT NULL DEFAULT 0
);
```

> [!NOTE]
> Las columnas `anomaly_type`, `skip_reason` y `last_restock_date` (en `visits`), `visit_id` (en `competition_reports`) y `user_id` (en `location_pings`) se agregan mediante **migraciones idempotentes** (helper `addColumnsIfMissing` vía `PRAGMA table_info`) en `mobile/src/services/db.ts`, para no romper instalaciones existentes.

Adicionalmente, se crea la tabla espejo local `competition_reports` que retiene los reportes de competencia capturados offline antes de subirlos a Supabase (con su flag `synced` y, desde v2.0, `visit_id` que la liga al check-in).

> [!TIP]
> **v2.0:** `insertLocationPingSync` (llamada desde el task de background, fuera del contexto React) resuelve la **jornada abierta** (`session_end IS NULL`) de forma síncrona para poblar `session_id` y `user_id` del ping — el sync a Supabase no necesita inferir el autor.

---

## Enlaces Relacionados
- [[Constitucion]] — Reglas y esquemas JSON correspondientes.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — Decisiones de diseño del esquema CRM.
- [[03_offline_sync]] — Lógica del motor de sincronización SQLite -> Supabase.
