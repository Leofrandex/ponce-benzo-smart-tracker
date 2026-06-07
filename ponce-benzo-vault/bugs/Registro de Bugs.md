---
title: Registro de Bugs
date: 2026-05-22
tags:
  - bugs
  - errores
  - indice
---

# Registro de Bugs — Ponzivenzo Smart Tracker

Este documento centraliza el control de errores, fallos técnicos y bugs significativos que han sido detectados y solucionados durante el desarrollo del proyecto. El propósito es documentar las causas raíz y soluciones para evitar la reintroducción de fallos similares en futuras iteraciones.

## 🐛 Historial de Bugs Solucionados

| ID | Fecha | Bug / Descripción | Causa Raíz | Solución |
| :--- | :--- | :--- | :--- | :--- |
| `BUG-002` | 2026-06-02 | `recordVisit` (móvil) escribía siempre `anomaly_type`/`skip_reason`/`last_restock_date` como `null` al insertar la visita, descartando los datos del formulario y rompiendo la invariante anomalía→tarea de ADR-002. | El `insertVisit` tenía esos tres campos hardcodeados a `null` (placeholder del scaffolding inicial). | Pasar los valores reales del `VisitRecord` en el mismo INSERT: `anomaly_type` cuando `status='anomaly'`, `skip_reason` cuando `'skipped'`, y `last_restock_date` siempre. Ver [[logs/Log-2026-06-02-bloque-mobile\|Log Bloque Mobile]]. |
| `BUG-001` | 2026-05-22 | Error `UnicodeEncodeError` en script de verificación de Supabase en Windows. | Uso de emojis de alta densidad (`❌`, `✅`, `⚠️`) en la consola `cmd` / `powershell` que no soporta utf-8 por defecto. | Reemplazar emojis unicode por etiquetas ASCII descriptivas (ej: `[OK]`, `[ERROR]`, `[WARN]`). |

---

## 🛠️ Cómo registrar un nuevo Bug
1. Si descubres o corriges un bug crítico o recurrente, documenta su solución.
2. Agrega una nueva fila al inicio de la tabla en esta página.
3. Si el bug requiere una explicación compleja, crea una nota individual en esta carpeta con el nombre `Bug-Nombre-Bug.md` utilizando la plantilla [[templates/Template - Bug|Template - Bug]] y enlázala en la tabla.
