---
title: Registro de Decisiones Arquitectónicas (ADRs)
date: 2026-05-22
tags:
  - decisiones
  - adr
  - indice
---

# Registro de Decisiones Arquitectónicas (ADRs) — Ponzivenzo Smart Tracker

Este documento actúa como índice histórico de todas las decisiones importantes tomadas sobre la arquitectura, diseño técnico y stack tecnológico del proyecto. Cada decisión se detalla en una nota individual siguiendo el formato estándar de un ADR (Architectural Decision Record).

## 📂 Registro de ADRs

| Código | Decisión / Título | Estado | Fecha | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| [[decisiones/ADR-001-Next-RN-Split\|ADR-001]] | Split de Arquitectura Dual (Next.js + React Native Expo) | `aceptado` | 2026-05-22 | Separación del PWA en panel supervisor web y app móvil nativa por límites de geolocalización. |
| [[decisiones/ADR-002-Modelo-CRM\|ADR-002 — Modelo de Datos CRM]] | Modelo de Datos CRM (Contactos, Tareas, Competencia y Anomalías) | `aceptado` | 2026-06-01 | Expansión del esquema para CRM: contactos, bitácora, tareas, competencia, jerarquía supervisor y trigger anomalía→tarea. |
| [[decisiones/ADR-003-Supabase-Desde-Cero\|ADR-003]] | Recrear el proyecto Supabase desde cero con Schema v2.0 consolidado | `aceptado` | 2026-06-07 | Proyecto nuevo + schema de una sola capa alineado 1:1 con el UI; hardening RLS (SECURITY DEFINER, tasks sin INSERT de cliente); priority eliminado del producto. |
| [[decisiones/ADR-004-Nivel-Cliente-Piloto-Farmatodo\|ADR-004]] | Nivel Cliente (cadena) + Piloto Farmatodo como fuente de verdad | `aceptado` | 2026-06-15 | Tabla `clients` (cadena) + FK en stores; Excel de Farmatodo como SSOT del piloto (45 tiendas con datos + rutas); resto desactivado; alta de Jonathan. |
| [[decisiones/ADR-005-Anomaly-Type-Array\|ADR-005]] | Anomaly Type como Array (TEXT[] en Supabase + JSON en SQLite) | `aceptado` | 2026-06-22 | `visits.anomaly_type` migrado de `TEXT` a `TEXT[]`; móvil usa JSON-en-TEXT en SQLite; trigger `fn_create_task_from_anomaly` con UNNEST crea una task por anomalía con dedup. Alternativa `visit_anomalies` descartada por mayor complejidad de sync. |

| [[decisiones/ADR-006-Alcance-Por-Cliente\|ADR-006]] | Alcance por cliente asignado sustituye a la jerarquia supervisor-mercaderista | `aceptado` | 2026-08-13 | Tabla `client_assignments` (33 filas, 11 personas) + 4 funciones `SECURITY DEFINER`; RLS reescrita en 10 tablas y el bucket de fotos; rol `vendedor` en vez de `supervisor`; **rol y asignacion son ejes independientes** (un mercaderista puede tener cuentas); el gerente de distrito se modela como asignaciones explicitas, sin jerarquia en RLS. Cerrada de paso una escalada de privilegios preexistente en `users_own_profile`. |

| [[decisiones/ADR-007-Productos-Y-Supervision-Movil\|ADR-007]] | Productos en anomalías, supervisión de Jonathan y reportes sueltos | `aceptado` | 2026-08-17 | Catálogo `products` (34 SKUs) + tabla puente `visit_anomaly_products` **por tipo de anomalía**, aditiva: `visits.anomaly_type` sigue siendo `TEXT[]` (coherente con ADR-005). `users.is_supervisor` en vez de un cuarto rol, para no reauditar las políticas del ADR-006. `visits.supervisor_present_user_id` lo marca el mercaderista por visita. El reporte suelto reutiliza ruta especial + jornada corta (GPS solo durante el reporte) y **cubre la ruta del ausente** en `fn_dash_cumplimiento`. Índice único de `routes` partido en dos parciales. |

| [[decisiones/ADR-008-Cuenta-Maestra-Colaborador\|ADR-008]] | Cuenta maestra `colaborador` para recorridos de la dirección | `aceptado` | 2026-08-31 | Cuarto rol `colaborador` + **una sola cuenta compartida** que sustituye al `admin` entrando a la APK con su cuenta personal. `fn_is_colaborador()` se suma con `OR` **solo** a `stores_read`/`clients_select` (catálogo completo para el reporte suelto); **no** hereda la rama global de `fn_is_admin()` sobre visitas, tareas, pings ni storage. La escritura ya estaba cubierta por las políticas `*_own`. El admin conserva el login móvil, pierde la pestaña de reporte. Precio explícito: la visita no identifica a la persona — mitigable con el selector de acompañante del ADR-007. |

---

## 🛠️ Cómo registrar un nuevo ADR
1. Crea un nuevo archivo en esta carpeta con el nombre `ADR-XXX-Nombre-ADR.md`.
2. Utiliza la plantilla [[templates/Template - ADR|Template - ADR]] para estructurarlo.
3. Rellena los metadatos YAML y las secciones correspondientes.
4. Agrega una nueva fila al final o inicio de la tabla en esta página enlazando la nota.
5. Los estados posibles son: `propuesto`, `aceptado`, `rechazado`, `superado`.
