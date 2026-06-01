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

## 🛑 Bloqueadores Críticos (Datos Requeridos)

Para realizar la migración completa a producción y conectar a los vendedores reales, el equipo de negocio de Ponce & Benzo debe definir:

1. **Correos Electrónicos de Vendedores:**
   * *Problema:* El archivo `MAESTRO.xlsx` y `RUTAS` contienen nombres como `MILAGROS FERNANDEZ` y `EDUWARD MARTÍNEZ`, pero Supabase Auth requiere correos electrónicos válidos para crear los accesos.
   * *Acción:* Mapear los nombres a correos corporativos o provisionales (ej. `eduward.martinez@poncebenzo.com`).
2. **Coordenadas GPS de Tiendas:**
   * *Problema:* Los Excel solo contienen direcciones de texto (ej. "Av. Principal local 3"). El geofencing anti-fraude requiere latitud/longitud numérica para verificar la cercanía de la foto.
   * *Acción:* Obtener las coordenadas maestras. Provisionalmente, la base de datos se inicializará con coordenadas del centro de Caracas (`10.4806, -66.9036`), que deberán actualizarse en la primera visita real del mercaderista (captura de posición inicial).

---

## ⚙️ Pendientes de Desarrollo Técnico

- [ ] **Configuración de Variables de Entorno:**
  * Obtener e ingresar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `hub/.env.local`.
- [ ] **Modificar Ingesta de Excel:**
  * Adaptar `tools/import-data.ts` para que lea correctamente `hub/MAESTRO.xlsx` (Hoja *CLIENTES NUEVA ID ZONA* y *ESTRUCTURA P&B - LP*) y `hub/RUTAS 05-12-25 (1).xlsx`, cruzando los IDs de tiendas con los IDs de los vendedores creados.
- [ ] **Validación de RLS Móvil:**
  * Probar que las llamadas a la base de datos de Supabase desde la app móvil respeten estrictamente la restricción de que un mercaderista solo vea sus propias visitas y rutas.
- [ ] **Compresión de Imágenes:**
  * Implementar compresión automática de imágenes utilizando `expo-image-manipulator` en la aplicación móvil antes de guardarlas en disco para evitar saturación del storage.

---

## 🧩 Pendientes del Modelo de Datos CRM (ADR-002)

- [ ] **Normalizar zona geográfica:** mover `stores.estado` / `municipio` / `urbanizacion` (hoy texto libre, decisión D3) a tablas lookup normalizadas a futuro para evitar inconsistencias de escritura.
- [ ] **Reconciliar tipos de tareas del hub:** los tipos mock de UI del hub (`SupervisorTask` / `TaskType`, en inglés) deben reconciliarse con la tabla `tasks` / `DbTaskType` al construir la UI del CRM.
- [ ] **Ingesta de `MAESTRO.xlsx` (columnas CRM):** mapear las columnas de estado / municipio / urbanización / canal / clasificación del Excel a las nuevas columnas de `stores`.
- [ ] **GAP — Crear `location_pings` en Supabase:** la tabla `location_pings` está definida en la arquitectura y en el SQLite local pero **NO existe** en el esquema Supabase (`tools/supabase_schema.sql`). Falta crearla (en una migración aparte, fuera del alcance CRM) para poder sincronizar los pings de GPS.
- [ ] **Endurecer RLS `tasks_assignee`:** actualmente `WITH CHECK (true)`. Aceptable mientras las tareas se generen sólo por trigger/servidor; revisar si el cliente llega a escribir tareas directamente.
- [ ] **Recolección de data para features de largo plazo:** definir quién y cómo recolecta la data para el histórico de rotación de productos y el anaquel de exhibición ideal. Ver [[largo-plazo/Historico Rotacion Productos|Histórico de Rotación]] y [[largo-plazo/Anaquel Exhibicion Ideal|Anaquel de Exhibición Ideal]].

---

## Enlaces Relacionados
- [[roadmap/Roadmap|Roadmap del Proyecto]] — Hitos del desarrollo general.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]] — Decisiones del esquema CRM.
- [[resumen/Constitucion|Constitución]] — Reglas y restricciones a respetar en las soluciones.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — Tablas destino de los datos a importar.
