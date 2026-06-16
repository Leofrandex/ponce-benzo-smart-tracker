---
title: "Piloto Farmatodo — Reconciliación de Tiendas (RUTAS ↔ Coordenadas)"
date: 2026-06-15
tags:
  - pendientes
  - datos
  - piloto
  - farmatodo
---

# Piloto Farmatodo — Reconciliación de Tiendas

> [!NOTE]
> Alcance del piloto: **solo sucursales de Farmatodo** que estén en `RUTAS 05-12-25 (1).xlsx` **y** tengan data completa (GPS, dirección, encargado) en `Copia de CoordenadasTiendasFarmatodo REVISION.xlsx`. El resto se desactiva hasta tener su data. Ver [[pendientes/Pendientes|Pendientes]] y el spec `docs/superpowers/specs/2026-06-15-nivel-cliente-e-ingesta-farmatodo-design.md`.

## Números

| Concepto | # |
|---|---|
| Tiendas en RUTAS (total) | 190 |
| Farmatodo en RUTAS | 77 |
| No-Farmatodo en RUTAS (fuera del piloto) | 113 |
| Filas en Excel de coordenadas Farmatodo | 45 |
| **Farmatodo con data completa + ruta (PILOTO)** | **36** (+2 duplicados a fusionar) |
| Farmatodo en RUTAS **sin** coordenadas | 39 |
| Con coordenadas pero **sin** ruta | 5 |
| En RUTAS hoja 5 (excluida) | 2 |

---

## ✅ ENTRAN al piloto — Farmatodo con data completa (36)

| # | Nombre en BD/RUTAS | Nombre en Excel coords |
|---|---|---|
| 1 | FTD AMBAR | AMBAR |
| 2 | FTD AUTANA | AUTANA |
| 3 | FTD AVILA | EL AVILA |
| 4 | FTD BARUTA C.C EXPRESO | EXPRESO |
| 5 | FTD CARICUAO | CARICUAO |
| 6 | FTD CARLOTA | CARLOTA |
| 7 | FTD CHUAO | CHUAO |
| 8 | FTD CLAVELINA | CLAVELINAS |
| 9 | FTD CONGRESO | CONGRESO |
| 10 | FTD CORINA | CORINA |
| 11 | FTD CUARTEL | CUARTEL |
| 12 | FTD CUARZO | CUARZO |
| 13 | FTD GRACIELA | GRACIELA |
| 14 | FTD IRENE | IRENE |
| 15 | FTD JOSE MIGUEL | JOSE MIGUEL |
| 16 | FTD LA CASTELLANA | LA CASTELLANA VE |
| 17 | FTD LA JOYA | JOYA |
| 18 | FTD LIDER | LIDER |
| 19 | FTD LOS MONJES | MONJES |
| 20 | FTD MADRE CABRINI | MADRE CABRINI |
| 21 | FTD MANANTIAL | MANANTIAL |
| 22 | FTD METROCENTER | METROCENTER |
| 23 | FTD MIRENA | MIRENA |
| 24 | FTD MONICA | MONICA |
| 25 | FTD MUCURA | MUCURA |
| 26 | FTD NUEVA CARACAS | NUEVA CARACAS |
| 27 | FTD OLIVO | OLIVO |
| 28 | FTD SCARLET | SCARLET |
| 29 | FTD SUSANA | SUSANA |
| 30 | FTD TEO | TEO |
| 31 | FTD TEPUY | TEPUY |
| 32 | FTD TEREPAIMA | TEREPAIMA |
| 33 | FTD TOBOGAN | TOBOGAN |
| 34 | FTD ZAFIRO | ZAFIRO |
| 35 | FTO OCUMITO | OCUMITO |
| 36 | TDF RIO FARO | RIOFARO |

> [!WARNING]
> **Duplicados por typo a fusionar** (apuntan a la misma sucursal del Excel):
> - `FTD TEREPAINA` ↔ `FTD TEREPAIMA` (→ Excel `TEREPAIMA`)
> - `FTD OLIVOS` ↔ `FTD OLIVO` (→ Excel `OLIVO`)

---

## 🚫 NO entran (por ahora) — Farmatodo en RUTAS sin coordenadas (39)

| # | Tienda | # | Tienda | # | Tienda |
|---|---|---|---|---|---|
| 1 | FTD ACONCAGUA | 14 | FTD LOS NARANJOS | 27 | FTD PIRINEOS |
| 2 | FTD ALTO SANO | 15 | FTD LOS SIMBOLOS | 28 | FTD PLAZA CARICUAO |
| 3 | FTD ARCO | 16 | FTD LUZMAR | 29 | FTD PUNEERES |
| 4 | FTD BAROCA | 17 | FTD MACARACUAY | 30 | FTD ROBLE |
| 5 | FTD BELLA VISTA | 18 | FTD MANZANARE | 31 | FTD RUBI |
| 6 | FTD CAMINITO | 19 | FTD MARFIL | 32 | FTD SAMBIL LA. C |
| 7 | FTD CATIA II ⚠️ | 20 | FTD MATERNIDAD | 33 | FTD SAN PASTOR EL MARQUES |
| 8 | FTD EL VALLE ⚠️ | 21 | FTD MONTAÑAL | 34 | FTD TOPACIO |
| 9 | FTD ELEONOR | 22 | FTD NASCAR | 35 | FTD TURQUEZA |
| 10 | FTD GRANATE | 23 | FTD NATALIA | 36 | FTD VENECIA |
| 11 | FTD GRISELDA | 24 | FTD NELLLYS | 37 | FTD VERTIENTE |
| 12 | FTD INDIGO | 25 | FTD OPALO | 38 | FTD VISTA ALEGRE |
| 13 | FTD LA TAHONA | 26 | FTD PARQUE CENTRAL | 39 | FTD ZONA FRANCA |

⚠️ `CATIA II` y `EL VALLE` son las **dudosas**: el Excel trae `BOULEVAR DE CATIA` y `JARDINES DEL VALLE`, pendiente confirmar con Farmatodo si son la misma tienda.

---

## ❓ Con coordenadas pero SIN ruta en RUTAS (5)

Tienen data en el Excel pero ningún mercaderista las visita (no están en ninguna ruta):

- ANTINEA
- LA CANDELARIA *(las "La Candelaria" de RUTAS son Maraplus / Rio Supermarket, no Farmatodo)*
- PEDRO LUIS
- ROMANA
- SETENTA

---

## ⚠️ En RUTAS hoja 5 (el parser la ignora) — fuera por ahora (2)

- MELANIE → `Melani-Los Palos Grandes`
- ALBITA → `Albita-Santa Eduvigis`

Decisión: **no incluirlas todavía** hasta aclarar qué es la mini-ruta de la hoja 5 (el "Aliado Comercial Caracas" pendiente).

---

## No-Farmatodo (fuera del piloto) — 113

Todas las cadenas no-Farmatodo cargadas en RUTAS (Locatel, Gama, Plaza's, Rio, Maraplus, Emporium, etc.) quedan **desactivadas** para el mercaderista hasta tener su data.
