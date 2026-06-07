---
title: Ponzivenzo Smart Tracker Second Brain
date: 2026-05-22
tags:
  - home
  - dashboard
---

# 🧠 Ponzivenzo Smart Tracker — Second Brain

Bienvenido al **Segundo Cerebro** del proyecto **Ponzivenzo Smart Tracker**. Este espacio de trabajo en Obsidian centraliza todo el conocimiento, diseño técnico, bitácora de desarrollo y dirección estratégica del proyecto. 

Úsalo como la **Fuente Única de la Verdad (SSOT)** para entender el estado del desarrollo y tomar decisiones informadas sobre la arquitectura.

---

## 🗺️ Mapa de Navegación del Vault

> [!NOTE]
> ### 📖 1. Resumen y Constitución
> Conoce las bases conceptuales, las reglas del juego inmutables y los hallazgos técnicos.
> - [[resumen/Resumen General|Resumen General]] — Visión de negocio, actores y stack tecnológico.
> - [[resumen/Constitucion|Constitución (Invariantes)]] — Leyes de desarrollo, políticas de seguridad y schemas JSON.
> - [[resumen/Findings|Descubrimientos Técnicos (Findings)]] — Limitaciones de navegadores y hallazgos del entorno.

> [!TIP]
> ### 🏗️ 2. Arquitectura y Estructura
> El diseño de ingeniería detrás de la aplicación dual y los procedimientos estándar (SOPs).
> - [[arquitectura/Arquitectura General|Arquitectura Dual (Next.js + Expo)]] — Justificación y división.
> - [[arquitectura/Esquema Base Datos|Esquema de Bases de Datos]] — Tablas Supabase y local SQLite con PostGIS.
> - **Procedimientos Operativos Estándar (SOPs):**
>   - [[arquitectura/01_session_lifecycle|01 - Ciclo de Vida de la Sesión]] (Jornada)
>   - [[arquitectura/02_visit_checkin|02 - Registro de Visitas (Check-In)]]
>   - [[arquitectura/03_offline_sync|03 - Resiliencia y Sincronización Offline]]
>   - [[arquitectura/04_anti_fraud_camera|04 - Cámara Anti-Fraude Nivel Nativo]]

> [!IMPORTANT]
> ### 🎯 3. Control de Progreso y Pendientes
> ¿En qué estamos trabajando hoy y qué nos falta definir?
> - [[roadmap/Roadmap|Roadmap del Proyecto]] — Planificación por fases (de la 0 a la 5).
> - [[pendientes/Pendientes|Lista de Pendientes]] — Bloqueadores del negocio, preguntas abiertas y tareas técnicas.

> [!CAUTION]
> ### 📜 4. Bitácora, Decisiones y Errores
> Registro histórico de sesiones, decisiones arquitectónicas complejas y control de calidad.
> - [[logs/Session Logs|Bitácora de Sesiones (Logs)]] — Historial cronológico de cambios de código.
> - [[decisiones/Registro de Decisiones|Registro de Decisiones (ADRs)]] — Historial y justificación de decisiones clave.
> - [[bugs/Registro de Bugs|Registro de Bugs]] — Tabla de control de bugs corregidos para prevenir reintroducciones.

---

## 📥 Bandeja de Entrada (Inbox)
La carpeta `inbox/` es el punto de entrada para información cruda (transcripts de reuniones, notas rápidas, requerimientos desordenados del cliente). 
Una vez procesados e integrados a las secciones del vault correspondientes, los archivos originales se guardan en `inbox/procesados/` para mantener la bandeja de entrada limpia.

## 🛠️ Cómo Utilizar este Vault
Este vault está diseñado para ser administrado tanto por desarrolladores humanos como por agentes de IA (como Gemini o Claude):
1. **Reglas de Ejecución (`CLAUDE.md`)**: Revisa los comandos comunes de terminal para compilar la web (`hub`) o levantar la app móvil (`mobile`).
2. **Reglas de Mantenimiento (`AGENTS.md`)**: Reglas obligatorias sobre cómo actualizar el vault (ej. crear logs al final de cada sesión, actualizar el roadmap y usar las plantillas de `templates/`).
