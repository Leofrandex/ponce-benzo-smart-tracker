# Ponzivenzo Smart Tracker - Plan de Arquitectura Supabase

Este documento sirve como registro oficial de la arquitectura de base de datos diseñada para la **Fase 3** del proyecto "Ponzivenzo Smart Tracker". Su propósito es guiar a cualquier desarrollador o IA en la implementación técnica de Supabase, asegurando que se cumplan todos los requisitos de negocio, seguridad y sincronización offline discutidos.

---

## 1. Contexto y Fuentes de Datos

La aplicación pasará de un estado 100% Mock Data a producción. Para inicializar la base de datos, se procesarán dos archivos Excel clave proporcionados por el negocio:

1.  **`MAESTRO.xlsx`**: Contiene la data estructural estática.
    *   *Hoja `CLIENTES NUEVA ID ZONA`*: Información de las tiendas (direcciones, ids).
    *   *Hoja `ESTRUCTURA P&B - LP`*: Estructura organizativa (quién supervisa a quién).
    *   *Hoja `SKU`*: Catálogo de productos.
2.  **`RUTAS 05-12-25 (1).xlsx`**: Contiene la planificación dinámica.
    *   Múltiples hojas por Asesor Comercial detallando qué tiendas deben visitar según el día de la semana (Lunes a Viernes).

### Bloqueadores Críticos (Acción Requerida antes de Migrar)
Para que el sistema sea funcional, el equipo de negocio debe proporcionar o se deben generar artificialmente para pruebas:
1.  **Correos Electrónicos:** Los Excel contienen nombres de Asesores y Supervisores, pero Supabase Auth exige correos electrónicos para el login.
2.  **Coordenadas GPS de Tiendas:** Los Excel contienen direcciones de texto. El sistema anti-fraude requiere latitud/longitud numérica.

---

## 2. Esquema de Base de Datos (Supabase PostgreSQL)

La arquitectura consta de 8 tablas principales. Se utilizará la extensión **PostGIS** para los cálculos geográficos.

### Tablas Maestras (Data Importada y Estática)

#### 1. `users` (Usuarios y Jerarquía)
Vinculada directamente a la tabla `auth.users` de Supabase.
*   `id` (UUID, Primary Key, foreign key a auth.users).
*   `email` (String).
*   `full_name` (String) -> *Ej: CARLOS ZURITA*
*   `role` (Enum: `merchandiser`, `supervisor`, `admin`).
*   `supervisor_id` (UUID, Foreign Key a `users.id`) -> *Define el organigrama. Permite que el supervisor solo vea a su equipo.*
*   `active` (Boolean).

#### 2. `stores` (Tiendas / Clientes)
El catálogo de ubicaciones físicas a visitar.
*   `store_id` (UUID, Primary Key).
*   `customer_number` (String) -> *Ej: J317255208 (Del MAESTRO)*
*   `name` (String) -> *Nombre comercial o Nombre Corto.*
*   `address` (Text) -> *Concatenación de Dirección 1 y 2.*
*   `city` / `state` (String).
*   `master_location` (Geography Point) -> *Coordenadas GPS maestras requeridas para el anti-fraude.*
*   `active` (Boolean) -> *Basado en la columna ESTATUS del Maestro.*

#### 3. `routes` (Asignación de Rutas)
El cronograma semanal extraído del archivo RUTAS.
*   `id` (UUID, Primary Key).
*   `merchandiser_id` (UUID, Foreign Key a `users.id`).
*   `store_id` (UUID, Foreign Key a `stores.store_id`).
*   `day_of_week` (Integer o Enum: 1=Lunes, 2=Martes...) -> *Permite a la app filtrar la vista "Mi Ruta" según el día actual.*

#### 4. `products` (Catálogo de SKUs - Opcional/Futuro)
*   `sku_id` (String, Primary Key).
*   `description` (String).
*   `brand` / `family` / `packaging` (String).

---

### Tablas Transaccionales (Generadas dinámicamente por la App)

#### 5. `sessions` (Jornadas de Trabajo)
Control de asistencia diario.
*   `session_id` (UUID, Primary Key).
*   `merchandiser_id` (UUID, Foreign Key a `users.id`).
*   `start_time` (Timestamptz) -> *Cuando el usuario hace clic en "Iniciar Jornada".*
*   `end_time` (Timestamptz, Nullable) -> *Cuando finaliza el día.*

#### 6. `location_pings` (Rastreo GPS Continuo)
Alimenta el "Mapa de Calor" histórico y el rastreo "En Vivo" del Supervisor.
*   `id` (UUID, Primary Key).
*   `merchandiser_id` (UUID, Foreign Key).
*   `session_id` (UUID, Foreign Key).
*   `timestamp` (Timestamptz) -> *Hora exacta del reporte.*
*   `location` (Geography Point) -> *Ubicación del dispositivo en ese instante.*
*   *Nota técnica:* Esta tabla crecerá rápidamente. La PWA debe enviar pings en background vía Service Worker cada X minutos.

#### 7. `visits` (Reportes de Check-in)
La confirmación de la visita a una tienda.
*   `visit_id` (UUID, Primary Key).
*   `store_id` (UUID, Foreign Key).
*   `merchandiser_id` (UUID, Foreign Key).
*   `session_id` (UUID, Foreign Key).
*   `status` (Enum: `completed`, `skipped`, `anomaly`).
*   `check_in_time` (Timestamptz).
*   `check_in_location` (Geography Point) -> *La ubicación del teléfono exactamente al tomar la foto. Se comparará vía PostGIS contra `stores.master_location`.*
*   `observations` (Text).
*   `photo_url` (String) -> *Ruta al archivo guardado en Supabase Storage.*

#### 8. `tasks` (Gestión de Tareas)
Asignadas por el supervisor y resueltas por el mercaderista.
*   `task_id` (UUID, Primary Key).
*   `store_id` (UUID, Foreign Key).
*   `created_by` (UUID, Foreign Key a `users.id` - Supervisor).
*   `assigned_to` (UUID, Foreign Key a `users.id` - Mercaderista).
*   `type` (Enum: `restock`, `contact_manager`, `pricing_issue`, `display_damage`, `other`).
*   `priority` (Enum: `high`, `medium`, `low`).
*   `status` (Enum: `open`, `in_progress`, `resolved`).
*   `description` (Text).
*   `created_at` / `resolved_at` (Timestamptz).

---

## 3. Seguridad (Row Level Security - RLS)

La implementación en Supabase debe estar protegida desde el esquema inicial:

*   **Política de Mercaderistas:**
    *   Pueden hacer `SELECT` en `stores` solo si el `store_id` está asociado a su `auth.uid()` a través de la tabla `routes`.
    *   Pueden hacer `INSERT` en `visits` y `location_pings` asegurando que `merchandiser_id = auth.uid()`.
    *   Pueden actualizar el status de `tasks` asignadas a ellos.
*   **Política de Supervisores:**
    *   Tienen acceso de solo lectura (`SELECT`) a `visits`, `location_pings` y `sessions` donde el `merchandiser_id` pertenezca a un usuario cuyo `supervisor_id` coincida con el `auth.uid()` del supervisor.
    *   Tienen permisos de escritura (`INSERT/UPDATE`) globales sobre la tabla `tasks`.

---

## 4. Notas de Sincronización Offline-First

Para garantizar la robustez de la app en zonas sin cobertura:
1.  Las operaciones de escritura (Check-in, Guardar foto, Location pings) deben intentar enviarse a Supabase primero.
2.  Si la red falla, se guardan localmente en **IndexedDB (Dexie)** con un flag `synced: false`.
3.  Un Service Worker se encargará del Background Sync para vaciar la cola de Dexie hacia Supabase cuando se restablezca la conexión.
