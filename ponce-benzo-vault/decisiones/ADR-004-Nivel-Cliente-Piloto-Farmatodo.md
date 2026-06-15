---
title: "ADR-004: Nivel Cliente (cadena) + Piloto Farmatodo como fuente de verdad"
date: 2026-06-15
status: aceptado
tags:
  - adr
  - decisiones
  - clientes
  - farmatodo
---

# ADR-004: Nivel Cliente (cadena) + Piloto Farmatodo como fuente de verdad

* **Estado**: `aceptado`
* **Fecha**: 2026-06-15
* **Autores**: Agente de IA & Usuario

---

## Contexto
El sistema solo modelaba **sucursales** (`stores`). El negocio necesita un nivel superior: un **cliente** dueño de varias sucursales, y poder filtrar por cliente. Además, las tiendas cargadas desde `RUTAS` estaban incompletas (sin GPS real, sin encargado) y no tendrán su data pronto, salvo **Farmatodo**, que entregó un Excel completo (`Copia de CoordenadasTiendasFarmatodo REVISION.xlsx`) con coordenadas, dirección, encargado **y las rutas nuevas** (mercaderista responsable + día de la semana).

## Decisión
1. **Cliente = cadena comercial** (Farmatodo, Locatel, Gama, Plaza's…), derivada del prefijo del nombre de la tienda. Se descartó modelar el cliente como entidad legal por RIF (MAESTRO) para el piloto: exigía vincular cada tienda a un RIF que no tenemos para las que salieron de RUTAS. Nueva tabla `clients` + FK `stores.client_id` (+ `ciudad`, `region`).
2. **El Excel de Farmatodo es la fuente de verdad del piloto.** Se re-pobló la BD con sus 45 sucursales (36 actualizadas + 9 creadas como `FTD <nombre>`), su encargado (tabla `contacts`) y sus **rutas** (mercaderista + día), traducidas al modelo `routes` (por fecha) generando un horizonte rodante de 4 semanas. Las rutas viejas de RUTAS se reemplazaron.
3. **Solo el piloto queda activo:** las 154 tiendas no-Farmatodo / sin data se desactivaron (`active=false`). El mercaderista solo verá las 45 Farmatodo.
4. **Alta de Jonathan Fernández** (merchandiser) para cubrir 2 sucursales del Excel.

## Consecuencias
### Positivas 👍
- Filtro por cliente y página de cadenas en el hub; modelo extensible a otras cadenas.
- Piloto coherente: 45 tiendas con GPS real → el geofencing anti-fraude puede validar.
- Sin cambios en el móvil ni en el schema de `routes` (la recurrencia semanal se materializa en fechas).

### Negativas / Riesgos 👎
- Las rutas son fechadas con horizonte finito (4 semanas): hay que **regenerarlas** periódicamente (el `pickRoute` del móvil mitiga con fallback).
- Posibles **duplicados** por typos en RUTAS (`FTD TEREPAINA`↔`FTD TEREPAIMA`, `FTD OLIVOS`↔`FTD OLIVO`) y 2 dudosas (`BOULEVAR DE CATIA`, `JARDINES DEL VALLE`) pendientes de confirmar/fusionar.
- El cliente como cadena (no RIF) puede requerir migración futura si el negocio exige la entidad legal.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
- [[pendientes/Piloto Farmatodo - Reconciliacion Tiendas|Reconciliación de Tiendas]]
- [[logs/Log-2026-06-15|Log 2026-06-15]]
