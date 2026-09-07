---
title: "ADR-008: Cuenta maestra `colaborador` para recorridos de la dirección"
date: 2026-08-31
status: aceptado
tags:
  - adr
  - decisiones
  - roles
  - rls
  - movil
---

# ADR-008: Cuenta maestra `colaborador` para recorridos de la dirección

* **Estado**: `aceptado`
* **Fecha**: 2026-08-31
* **Autores**: Agente de IA & Usuario

---

## Contexto

Desde el [[decisiones/ADR-007-Productos-Y-Supervision-Movil|ADR-007]], la pestaña **Reporte suelto** de la app móvil se habilita para `is_supervisor = true` **o** `role = 'admin'`. Es decir: para registrar un recorrido desde el teléfono, un miembro de la dirección tiene que entrar a la APK **con su cuenta personal de admin** — la misma con la que ve el hub completo.

Eso arrastra tres problemas:

1. **Superficie de riesgo.** La cuenta con visibilidad global de la operación (`fn_is_admin()` abre visitas, tareas, pings y todas las fotos del bucket privado — ver [[bugs/Registro de Bugs|BUG-025]]) queda instalada en un teléfono de campo.
2. **No escala.** Cada persona de dirección que quiera reportar necesita cuenta de admin propia, o pedirle el teléfono a quien la tenga.
3. **Es un rol prestado.** `admin` describe *cómo se usa el hub*, no *que hagas recorridos*. Mezclarlos obliga a reauditar RLS cada vez que cambia una de las dos cosas.

El negocio pidió lo contrario de lo que hay hoy: **una sola cuenta compartida**, conocida por todos, para hacer estos registros.

## Decisión

Se crea un **cuarto rol**, `colaborador`, y una **única cuenta maestra compartida** que lo usa: `colaborador@ponce-benzo.com`.

1. `users.role` amplía su `CHECK` a `('merchandiser', 'vendedor', 'admin', 'colaborador')`.
2. Nueva `public.fn_is_colaborador()` (`SECURITY DEFINER`, mismo patrón que `fn_is_admin()` / `fn_is_merchandiser()`), agregada **solo** a `stores_read` y `clients_select`: el colaborador necesita el catálogo completo de sucursales para buscar cualquiera en el reporte suelto, igual que el mercaderista. **No** se le da la rama global de `fn_is_admin()` sobre visitas, tareas, pings ni storage.
3. La escritura no requiere política nueva: `visits_own`, `sessions_own`, `pings_own`, `comp_reports_own` y el `INSERT` de storage ya recortan por `user_id = auth.uid()`.
4. En la app móvil, `puedeReportarSuelto` pasa de `is_supervisor || role === 'admin'` a `is_supervisor || role === 'colaborador'`, y la pestaña inicial es `Reporte` para el colaborador (no tiene ruta propia que abrir).
5. El `admin` **conserva el acceso a la app** (historial, perfil); lo que pierde es la pestaña de reporte suelto. Es reversible sin tocar cuentas.
6. La cuenta queda registrada en `tools/vendedores.json` + `vendedores.secret.json`, de modo que la ingesta (`stageUsers`) la mantenga idempotente.

## Consecuencias

### Positivas 👍
- La cuenta que anda en teléfonos de campo **ya no ve la operación completa**: el rol de registro y el de supervisión quedan separados.
- Alta de nuevos "reportadores" con **cero trabajo**: se comparte la misma credencial.
- Aditivo. No toca ninguna política del [[decisiones/ADR-006-Alcance-Por-Cliente|ADR-006]]; solo suma un `OR` en dos lecturas de catálogo.
- `role` sigue significando *cómo usás el sistema*, coherente con la separación rol ↔ asignación del ADR-006.

### Negativas / Riesgos 👎
- **La visita deja de identificar a la persona.** Es el precio explícito de una cuenta compartida: `visits.user_id` apunta siempre al colaborador. Mitigación disponible hoy sin código: quien la use se marca en el selector **"supervisor presente"** del check-in (`visits.supervisor_present_user_id`, ADR-007). *Si el negocio necesita trazabilidad dura, hay que convertir ese campo en obligatorio para este rol.*
- **Credencial compartida = credencial que se filtra.** No hay rotación ni expiración; la contraseña vive en [[Credenciales Temporales Piloto|Credenciales Temporales Piloto]].
- Las tareas que genere una anomalía suya quedan **sin asignatario** (`supervisor_id` nulo → `assignee_user_id` nulo). Se siguen viendo en el hub porque `tasks_select` recorta por tienda, no por asignatario. Mismo comportamiento que ya tenía el admin.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[decisiones/ADR-007-Productos-Y-Supervision-Movil|ADR-007]] — origen del reporte suelto
- [[decisiones/ADR-006-Alcance-Por-Cliente|ADR-006]] — rol y asignación como ejes independientes
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]]
- [[logs/Log-2026-08-31|Log 2026-08-31]]
