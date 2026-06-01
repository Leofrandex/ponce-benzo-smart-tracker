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
*   `session_id` (`UUID`, FK -> `sessions.session_id`).
*   `timestamp` (`TIMESTAMPTZ`).
*   `location` (`GEOGRAPHY(POINT, 4326)`): Punto geográfico del dispositivo en movimiento.

> [!WARNING]
> `location_pings` está definida en esta arquitectura y en el SQLite local, pero **aún no existe** en el esquema Supabase (`tools/supabase_schema.sql`). Falta crearla en una migración aparte para poder sincronizar los pings. Ver [[pendientes/Pendientes|Pendientes]].

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
*   `status` (`TEXT`, `CHECK`): `pending` | `in_progress` | `done`.

### 10. Tabla: `competitor_brands`
Catálogo editable de marcas de la competencia (decisión D6 — lookup, no enum fijo).
*   `brand_id` (`UUID`, PK).
*   Campos de identificación de la marca (nombre, etc.).

### 11. Tabla: `competition_reports`
Reportes de actividad de la competencia observada en tienda.
*   `report_id` (`UUID`, PK).
*   `session_id` (`UUID`, FK -> `sessions.session_id`).
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

---

## 🔒 Row Level Security (RLS) en Supabase

Para garantizar que los mercaderistas no puedan ver información confidencial de otros vendedores ni sabotear rutas ajenas, se habilitan las siguientes políticas:

- **Tabla `stores`:** Todos los usuarios autenticados tienen permisos de lectura (`SELECT`) globales.
- **Tabla `users`:** El mercaderista solo puede ver/modificar su propio perfil (`auth.uid() = id`).
- **Tabla `routes`:** El mercaderista solo puede leer rutas asignadas a él (`auth.uid() = user_id`).
- **Tabla `sessions`:** Permisos completos (`ALL`) concedidos si el creador de la sesión coincide con `auth.uid()`.
- **Tabla `visits`:** Permisos completos (`ALL`) concedidos si el check-in pertenece a `auth.uid()`.

### Políticas CRM nuevas (ADR-002)

- **Tablas `contacts`, `contact_engagements`, `tasks`, `competitor_brands`, `competition_reports`:** habilitadas con políticas propias para los flujos de CRM.
- **`tasks_assignee`:** el responsable accede a sus tareas. Actualmente con `WITH CHECK (true)` — aceptable mientras las tareas se generen sólo por trigger/servidor; debe endurecerse si el cliente llega a escribir tareas directamente (ver [[pendientes/Pendientes|Pendientes]]).

### Visibilidad de Supervisor

Se agregan políticas de lectura para que un supervisor vea a su equipo, comparando `users.supervisor_id = auth.uid()`:

- **`users_supervisor_read`:** el supervisor lee los perfiles de sus vendedores.
- **`routes_supervisor_read`:** el supervisor lee las rutas de sus vendedores.
- **`visits_supervisor_read`:** el supervisor lee las visitas de sus vendedores.

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
> Las columnas `anomaly_type`, `skip_reason` y `last_restock_date` se agregan a la tabla local `visits` mediante una **migración idempotente** (vía `PRAGMA table_info`) en `mobile/src/services/db.ts`, para no romper instalaciones existentes.

Adicionalmente, se crea la tabla espejo local `competition_reports` que retiene los reportes de competencia capturados offline antes de subirlos a Supabase (con su flag `synced`).

---

## Enlaces Relacionados
- [[Constitucion]] — Reglas y esquemas JSON correspondientes.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — Decisiones de diseño del esquema CRM.
- [[03_offline_sync]] — Lógica del motor de sincronización SQLite -> Supabase.
