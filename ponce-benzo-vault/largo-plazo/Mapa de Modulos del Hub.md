---
title: "Mapa de Módulos del Hub P&B"
date: 2026-09-25
tags:
  - hub-modulos
  - vision
  - largo-plazo
---

# Mapa de Módulos del Hub P&B (borrador)

> [!NOTE]
> Borrador para discutir. Nace de [[largo-plazo/Reunion 2026-09-25 - Ajustes Tracker y Pipeline|la reunión del 2026-09-25]] y de la idea de Sebastián de convertir el software en un hub de módulos con acceso por rol. Nada de esto está aprobado ni presupuestado, salvo el Pipeline (en propuesta).

## Principio

Un solo login y **una sola base de datos compartida**: clientes, tiendas, contactos, productos y usuarios son **maestros comunes**, y cada módulo los consume. El acceso se da por **usuario × módulo × rol** (ver, editar, admin).

## Módulos

| Módulo | Estado | Qué hace |
|---|---|---|
| **Tracker de trade marketing** | En producción | Rutas, visitas, anomalías, tareas, mapa de mercaderistas |
| **Pipeline de ventas (CRM)** | Propuesta lista (2026-09-30) — [[largo-plazo/Propuesta - Pipeline de Ventas CRM\|propuesta]] · [[arquitectura/Spec - CRM Pipeline de Ventas\|spec]] | Kanban de negocios, contactos, actividades, pronóstico, métricas por vendedor |
| **Maestro de clientes y tiendas** | Hoy vive dentro del tracker | Cadenas, sucursales, municipio, vendedor asignado, clasificación ABC. Pasa a ser compartido |
| **Contactos** | Parcial (compradores en el tracker) | Personas por empresa (cargo, correo, teléfono, cumpleaños). Lo usan el tracker y el CRM |
| **Productos y catálogos** | Parcial | Catálogo P&B y catálogo Corpañal; líneas y marcas; lo usan anomalías, reposiciones y negocios del CRM |
| **Configuración / Admin** | No existe | Usuarios y permisos por módulo, asignación cliente ↔ vendedor, **propiedades personalizadas** del CRM, etapas del pipeline, catálogos, motivos de pérdida |
| **Tracking de vendedores** | Fuera de la propuesta CRM (2026-09-30); diseño listo en el spec §7 | Ubicación GPS de los vendedores en la calle; puede reutilizar el motor de ubicación del móvil |
| **Compras** | Por descubrir | Pendiente de una reunión con el departamento de Compras, después de cerrar ventas |

## Dependencias clave

1. **Configuración/Admin** y el **modelo de permisos por módulo** son la base: sin ellos, el pedido de Diego ("que yo edite sin pedírtelo") no se puede resolver bien.
2. **Maestros compartidos** (clientes, contactos, productos) tienen que salir del tracker antes de que el CRM los duplique. Relacionado con [[decisiones/ADR-002-Modelo-CRM|ADR-002 Modelo CRM]].
3. El shell del hub (lanzador de módulos) es un cambio de navegación del `hub/` Next.js actual, no una app nueva.

> [!WARNING]
> Diseño y arquitectura del Pipeline se definen en una sesión dedicada (brainstorming → spec → ADR) antes de escribir código.
