---
title: "Ingesta — Mapeo de Datos (MAESTRO / RUTAS → Supabase)"
date: 2026-06-08
tags:
  - arquitectura
  - ingesta
  - supabase
  - datos
---

# Ingesta — Mapeo de Datos

> [!SUCCESS]
> **Ejecutado el 2026-06-08.** Pipeline idempotente corrido contra `poncebenzo`: 6 usuarios + 192 tiendas + 20 rutas, verificado E2E. Ver [[logs/Log-2026-06-08|Log-2026-06-08]].

> [!IMPORTANT]
> **Hallazgo central (2026-06-08):** las tiendas del piloto salen de **`RUTAS 05-12-25 (1).xlsx`**, no de MAESTRO. MAESTRO registra las cadenas como **una sola entidad legal por RIF** (no tiene las sucursales retail que visitan los mercaderistas). MAESTRO sí aporta el **canal** a nivel de cadena. Alcance: solo las **4 rutas Jr** (Elvis, Willian, Eduward, Carlos) — ver [[pendientes/Pendientes|Pendientes]].

## Fuentes

| Archivo (raíz del repo) | Para qué |
| :--- | :--- |
| `RUTAS 05-12-25 (1).xlsx` | **Tiendas** (192 sucursales únicas) + asignación tienda→asesor→ruta (hoja = asesor, columna = día/ruta). |
| `MAESTRO.xlsx` | **Jerarquía** (hoja `ESTRUCTURA P&B - LP`, ya en `tools/vendedores.json`) y **canal por cadena** (hoja `CLIENTES NUEVA ID ZONA`, columna `Desc Clase de Cliente`). |

## Mapeo → tabla `stores`

| Campo `stores` | Fuente / Regla |
| :--- | :--- |
| `name` | RUTAS, **tal cual** (con typos: FTO, TDF, CETRAL… no se normalizan — decisión del usuario). |
| `business_channel` | Lookup **cadena → clase de MAESTRO** (tabla abajo); cadenas fuera de MAESTRO → `otro`. Cobertura ≈ 76% (146/192). |
| `master_lat` / `master_lng` | Default Caracas `10.4806, -66.9036` (se corrige en la 1ª visita real). |
| `address`, `estado`, `municipio`, `urbanizacion`, `classification` | `null` — MAESTRO no tiene estos campos a nivel de sucursal. |
| `active` | `true`. |

### Lookup cadena → `business_channel`

| Prefijo en RUTAS | Cadena | Clase en MAESTRO | `business_channel` | Tiendas |
| :--- | :--- | :--- | :--- | :--- |
| FTD / FTO / TDF | Farmatodo | CADENAS - FARMACIAS | `farmacia` | 76 |
| LOCATEL | Locatel | CADENAS - FARMACIAS | `farmacia` | 24 |
| GAMA | Excelsior Gama | CADENAS - SUPERMERCADOS | `supermercado` | 22 |
| PLAZA / PLAZAS | Automercados Plaza's | CADENAS - SUPERMERCADOS | `supermercado` | 22 |
| RED, EMPORIUM, MARAPLUS, RIO, PLAN, TIO, … | varias | (no están en MAESTRO) | `otro` | ~46 |

> [!NOTE]
> **Locatel = `farmacia`** (no `droguería` como el mock): MAESTRO es la fuente de verdad. **Plaza's**: no se enriquece con la hoja `Sucursales` (decisión: mantener simple). Los `business_channel` `otro` los afina el supervisor en el hub.

## Mapeo → Supabase Auth + `users`

6 cuentas (ver `tools/vendedores.json` + [[pendientes/Pendientes|Pendientes]] para el personal pendiente):
- 4 merchandisers (Elvis, Willian, Eduward, Carlos) → supervisor **Milagros**.
- Milagros → `supervisor` (gerente de los 4 en `ESTRUCTURA P&B - LP`).
- Rosli → `admin` (visibilidad global vía `fn_is_admin`, ver [[arquitectura/Esquema Base Datos|Esquema BD]]).
- Contraseñas temporales (únicas, sin patrón): en `Credenciales Temporales Piloto.md` (gitignored).

## Mapeo → tabla `routes`

De cada hoja de asesor en RUTAS: 5 columnas = 5 rutas (Lunes…Viernes), cada una con su lista ordenada de tiendas → `routes` (`user_id`, `route_date`, `store_ids[]`). La asociación asesor↔hoja usa los `excel_aliases` de `vendedores.json` (resuelve WILLIAN/WILLIAM, "CARLOS  ZURITA" doble espacio, acentos).

## Enlaces Relacionados
- [[pendientes/Pendientes|Pendientes]] — alcance de la ingesta y personal pendiente.
- [[arquitectura/Esquema Base Datos|Esquema de Base de Datos]] — tablas destino.
- [[decisiones/ADR-003-Supabase-Desde-Cero|ADR-003]] — schema v2.0.
