---
title: "Histórico de Rotación de Productos"
date: 2026-06-01
status: idea
tags:
  - largo-plazo
  - feature
  - crm
  - producto
---

# Histórico de Rotación de Productos

> [!NOTE]
> Feature de **visión a futuro**. Aún no está planificada para un sprint; vive en `largo-plazo/` hasta que se resuelva su bloqueador de recolección de datos.

## 🎯 Idea

Registrar la **rotación de productos por sucursal** para visualizar qué se mueve más en cada tienda. El objetivo es que supervisores y el negocio identifiquen, por punto de venta, qué SKUs rotan rápido y cuáles se estancan, y así afinar el reabastecimiento y la priorización de rutas.

## 🛑 Bloqueador

No existe aún un mecanismo de **recolección de esa data**. El check-in actual captura visitas, fotos y anomalías, pero no cantidades vendidas/repuestas por producto a lo largo del tiempo. Se debe definir:

- Quién captura la rotación (mercaderista en campo, sistema del cliente, integración externa).
- Con qué frecuencia y a qué granularidad (por SKU, por categoría).
- Dónde se almacena (¿nueva tabla de movimientos de inventario en Supabase?).

> [!CAUTION]
> Sin una fuente de datos confiable, cualquier reporte de rotación sería engañoso. Resolver la recolección es prerrequisito.

## 🔗 Enlaces Relacionados
- [[pendientes/Pendientes|Pendientes]] — Pendiente de definir recolección de data.
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[largo-plazo/Anaquel Exhibicion Ideal|Anaquel de Exhibición Ideal]]
