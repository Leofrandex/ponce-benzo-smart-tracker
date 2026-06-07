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

---

## 🛠️ Cómo registrar un nuevo ADR
1. Crea un nuevo archivo en esta carpeta con el nombre `ADR-XXX-Nombre-ADR.md`.
2. Utiliza la plantilla [[templates/Template - ADR|Template - ADR]] para estructurarlo.
3. Rellena los metadatos YAML y las secciones correspondientes.
4. Agrega una nueva fila al final o inicio de la tabla en esta página enlazando la nota.
5. Los estados posibles son: `propuesto`, `aceptado`, `rechazado`, `superado`.
