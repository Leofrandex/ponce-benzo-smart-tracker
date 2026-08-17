---
title: "ADR-006: Alcance por cliente asignado sustituye a la jerarquía supervisor↔mercaderista"
date: 2026-08-13
status: aceptado
tags:
  - adr
  - decisiones
  - rls
  - permisos
  - seguridad
---

# ADR-006: Alcance por cliente asignado sustituye a la jerarquía supervisor↔mercaderista

* **Estado**: `aceptado`
* **Fecha**: 2026-08-13
* **Autores**: Agente de IA & Usuario

---

## Contexto

Hasta ahora la visibilidad del sistema se decidía por **jerarquía directa**: cada política RLS preguntaba "¿soy tu supervisor?" mirando `users.supervisor_id`. Además, `stores`, `clients` y `contacts` los leía **cualquier usuario autenticado sin filtro** (`using (true)`).

El cliente pidió que cada responsable comercial vea **solo sus cadenas**. Al cruzar su Excel de asesores (`Lista de asesores gerente y clientes.xlsx`, 28 razones sociales) contra el sistema aparecieron tres desalineaciones de fondo:

1. **Los mercaderistas también son asesores comerciales.** Cinco de los seis (Willian Fermín, Eduward Martínez, Jonathan Fernández, Carlos Zurita, Elvis Rondón) recorren ruta con la APK **y** son dueños comerciales de cuentas. Un solo rol por persona no representa eso.
2. **Existe un nivel de gerente de distrito** — Milagros Fernández (23 cuentas), Dubraska Pérez (4), Andreina Rangel (1) — que el diseño inicial pretendía eliminar.
3. **La granularidad del Excel no es la de la base.** `LOCATEL` es una fila en `clients` con 26 tiendas activas, pero en el Excel son **9 razones sociales repartidas entre 5 asesores**.

## Decisión

**El alcance pasa a determinarse por asignación explícita usuario ↔ cliente**, no por jerarquía.

* Tabla `client_assignments` (`user_id`, `client_id`, PK compuesta, muchos-a-muchos). 33 filas, 11 personas.
* Cuatro funciones `SECURITY DEFINER`: `fn_my_client_ids()`, `fn_can_see_store()`, `fn_is_merchandiser()` y `fn_replace_client_assignments()`. **`SECURITY DEFINER` no es opcional**: sin él, leer `client_assignments` desde una política sobre esa misma tabla entra en recursión infinita.
* Políticas RLS reescritas en 10 tablas más el bucket `visit-photos`.
* **Rol y asignación son ejes independientes**: `role` define *cómo usas el sistema* (`merchandiser` con APK, `vendedor` solo hub, `admin`); las asignaciones definen *qué te pertenece comercialmente*. Así un mercaderista conserva su rol y además ve sus cuentas, sin rol híbrido.
* El rol `supervisor` desaparece; `users.supervisor_id` se conserva como dato organizativo pero **sale de la lógica de permisos**.
* **El gerente de distrito no se modela con jerarquía**: sus cuentas se insertan como filas propias en `client_assignments`, tomadas de la columna *GERENTE DE DISTRITO* del Excel. Cero recorrido de niveles en RLS.

### Decisiones subordinadas relevantes

* **La granularidad es el cliente, no la tienda.** Se evaluó `store_assignments` por el caso Locatel; el cliente lo descartó: que sus 5 asesores compartan las 26 tiendas es aceptable porque todos reportan al mismo gerente.
* **`sessions`, `location_pings` y `routes` quedan fuera del recorte** (`using (true)` para el equipo interno). Un recorrido GPS es continuo y cruza cadenas; partirlo convertiría el Mapa en otra pantalla. Excepción deliberada.
* **El mercaderista conserva el catálogo completo de 197 tiendas.** La APK cachea el catálogo para trabajar sin señal; recortarlo rompería el sync en campo.
* **La tarea sigue a su tienda**: quien no ve la tienda no ve su tarea. Se conserva `created_by_user_id` para que el mercaderista siga viendo lo que él generó.
* **La siembra de asignaciones es atómica** vía `fn_replace_client_assignments(jsonb)`, que además **rechaza un conjunto vacío**: última defensa contra dejar a todo el equipo sin cartera por un Excel mal leído.

## Consecuencias

### Positivas 👍
- Cada vendedor ve solo su cartera. Verificado con sesiones reales: Betsy Castro 2 clientes / 10 tiendas; Juan León 1 / 6; los admin 19 / 197.
- **Una sola función SQL sirve a los tres roles.** Las funciones de consulta van con `SECURITY INVOKER`, así que RLS filtra dentro del cálculo y no hace falta ninguna rama `if (rol === 'admin')` — que es donde se cuelan las fugas.
- El alcance se aplica en la base, así que vale igual para el hub, la app móvil y cualquier script futuro.
- Queda una red permanente: `tools/verify_rls.ts`, 26 aserciones con login real, que comprueba lo que cada rol ve **y lo que no**.
- Se cerró de paso una **escalada de privilegios preexistente**: `users_own_profile` es `FOR ALL` sin `WITH CHECK`, lo que permitía a cualquiera hacer `update users set role='admin'`. Resuelto revocando el `UPDATE` de tabla y regrantando solo `full_name`.

### Negativas / Riesgos 👎
- **Los mercaderistas siguen viendo los 234 contactos de todas las cadenas**, con teléfonos y cumpleaños de compradores, desde un teléfono en la calle. Es lo aprobado en la matriz —sus rutas cruzan cadenas— pero es la mayor asimetría del modelo: una vendedora ve 10 contactos y un mercaderista 234. *Decisión del usuario (13-ago): se deja así.*
- **Quien puede editar contactos también puede borrarlos.** Al acotar `contacts_write_staff` con `FOR ALL`, el borrado viajó con la edición: 11 personas pueden eliminar contactos de su cartera, antes solo 2. *Decisión del usuario (13-ago): se deja así.*
- **`DULCINEA 2019` y `HUMMY` no tienen vendedor asignado** (no aparecen en el Excel). Sus 4 tareas abiertas quedan fuera de la bandeja de todo vendedor; las siguen viendo los 2 admin y el mercaderista que las creó. Pendiente de que el negocio diga quién los atiende.
- **Un vendedor sin asignaciones ve cero.** Por eso la siembra es prerrequisito duro de activar las políticas, y por eso la función rechaza conjuntos vacíos.
- Siete políticas `*_admin_read` quedaron redundantes. **Dos de ellas NO lo son**: `device_logs_admin_read` es el único acceso del admin a los logs de dispositivo, y `comp_reports_admin_read` el único camino a reportes de competencia con `store_id` nulo. No borrarlas a ciegas.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[logs/Log-2026-08-13|Log-2026-08-13]] — la ejecución.
- [[logs/Log-2026-08-12|Log-2026-08-12]] — el diseño y el cruce del Excel.
- [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]] — el hardening RLS que este ADR reemplaza en su eje jerárquico.
- [[pendientes/Pendientes|Pendientes]] — las preguntas abiertas al cliente.
