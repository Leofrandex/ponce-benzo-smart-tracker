---
title: "Bitácora de Cumpleaños"
date: 2026-06-01
status: idea
tags:
  - largo-plazo
  - feature
  - crm
  - contactos
---

# Bitácora de Cumpleaños

> [!NOTE]
> Feature de **visión a futuro**. El dato base ya se captura; falta la vista de consumo.

## 🎯 Idea

Una **vista de cumpleaños** de los encargados/contactos de tienda, planteada como una **bitácora de experiencias** para fortalecer la relación comercial (felicitaciones, detalles, registro de interacciones alrededor de la fecha).

## ✅ Dato ya disponible

El cumpleaños ya se captura en `contacts.birthday` (ver [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] y [[decisiones/ADR-002-Modelo-CRM|ADR-002]]). A diferencia de las otras features de `largo-plazo/`, aquí **no hay bloqueador de recolección de datos**: el origen ya existe.

## 🛠️ Lo que falta

- Construir la **vista de consumo**: listado/calendario de próximos cumpleaños de contactos por tienda o por vendedor.
- Definir el componente de "bitácora de experiencias" asociado a cada contacto.

## 🔗 Enlaces Relacionados
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — Campo `contacts.birthday`.
- [[decisiones/ADR-002-Modelo-CRM|ADR-002 — Modelo de Datos CRM]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
