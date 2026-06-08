---
title: "Solicitud de Datos a Ponce & Benzo — Smart Tracker"
date: 2026-06-08
tags:
  - pendientes
  - datos
  - solicitud
  - negocio
---

# Solicitud de Datos — Ponce & Benzo Smart Tracker

> [!NOTE]
> Documento para **compartir con el equipo de negocio de P&B**. Resume los datos que la aplicación necesita y que **no existen** (o están incompletos) en los archivos actuales (`MAESTRO.xlsx`, `RUTAS 05-12-25`). El objetivo es que P&B reúna esta información en el formato indicado para completar la carga a producción.

---

## 1. Contexto (por qué pedimos esto)

`MAESTRO.xlsx` es la base **comercial / de ventas** de P&B: describe **a quién se le factura** (distribuidores y cadenas como cuenta legal, identificadas por RIF). La aplicación Smart Tracker, en cambio, opera a nivel de **punto de venta retail**: cada **sucursal física** que el mercaderista visita (ej. "Farmatodo Los Monjes", "Gama Boleíta"), con su encargado, su ubicación GPS y su clasificación.

Al cruzar ambos mundos encontramos que **MAESTRO no contiene los datos a nivel de sucursal**:

- De las **192 sucursales** que aparecen en las rutas, solo **10 (5%)** coinciden con un registro de MAESTRO por nombre.
- Las cadenas figuran en MAESTRO como **una sola entidad legal** (1 fila "FARMATODO, C.A." para 76 sucursales distintas; 1 fila "EXCELSIOR GAMA" para 22 sucursales).
- MAESTRO **no tiene** encargado de tienda, teléfono del local, ni GPS por sucursal.

Esto **no es un error**: son dos universos de datos distintos. Lo que sigue es lo que necesitamos que P&B reúna.

---

## 2. Resumen de lo que falta

| # | Dato requerido | ¿Está hoy en MAESTRO? | Quién lo necesita |
|:-:|:---|:---|:---|
| 1 | **Dirección por sucursal** | ❌ Solo la sede legal del RIF | Geolocalización / contexto |
| 2 | **Coordenadas GPS por sucursal** | ❌ No existe | Anti-fraude (geofencing de fotos) |
| 3 | **Encargado de tienda** (nombre, teléfono, cargo) | ❌ No existe | Módulo CRM / contacto |
| 4 | **Clasificación de tienda (A/B/C)** | ❌ Solo "Potencial zona" (S/P/B/C) a nivel cliente | Priorización de rutas |
| 5 | **Canal de cadenas faltantes** | ⚠️ Parcial (76%) | Segmentación |
| 6 | **Nombres oficiales de sucursales** (hay errores de tipeo) | ⚠️ Inconsistente | Identidad de la tienda |
| 7 | **"Aliado Comercial Caracas" / ruta sin asesor** | ❓ Sin aclarar | Asignación de cuentas |
| 8 | **Correos del personal pendiente** | ⚠️ Parcial | Altas de usuarios |

> [!TIP]
> Los puntos **1, 2 y 3** pueden capturarse progresivamente **en campo** con la propia app (el mercaderista toma el GPS en la primera visita y registra al encargado). Si P&B ya tiene parte de esta data consolidada, acelera el arranque; si no, no bloquea el piloto.

---

## 3. Detalle de cada punto

### 1, 2 y 3 — Datos por sucursal (dirección, GPS, encargado)
Para cada sucursal que visitan los mercaderistas, necesitamos idealmente:
- **Dirección física** completa (calle, urbanización, municipio, estado).
- **Coordenadas GPS** (latitud, longitud) — si no se tienen, se capturan en la primera visita.
- **Encargado:** nombre, cargo (ej. comprador, gerente), teléfono y, si aplica, correo y cumpleaños.

### 4 — Clasificación de tienda (A / B / C)
La app prioriza tiendas por una clasificación **A / B / C**. MAESTRO solo tiene "Potencial Zona" (valores S / P / B / C) y a nivel de cliente, no de sucursal. **Necesitamos que P&B defina:**
- ¿Qué criterio define A, B, C? (¿volumen de compra, potencial, frecuencia?)
- ¿Existe ya esa clasificación por sucursal, o hay que construirla?
- Si "Potencial Zona" (S/P/B/C) es el equivalente, indicar la correspondencia (ej. ¿S→A?).

### 5 — Canal de las cadenas no presentes en MAESTRO
Pudimos derivar el canal del **76%** de las tiendas usando la clase de MAESTRO:

| Cadena | Canal asignado |
|:---|:---|
| Farmatodo (FTD) | Farmacia |
| Locatel | Farmacia |
| Gama | Supermercado |
| Plaza's | Supermercado |

**Falta confirmar el canal** de estas cadenas/tiendas que **no están en MAESTRO** (≈24%):
`RED VITAL`, `EMPORIUM`, `MARAPLUS`, `RIO / RIO SUPERMARKET`, `PLAN (Plansuárez)`, `TIO`, `PARAMO`, `FRESCO`, `MUNDO`, `AUTOMERCADO`, y varias tiendas sueltas.

### 6 — Nombres oficiales (errores de tipeo en las rutas)
El archivo de rutas tiene variantes/errores que conviene oficializar para no duplicar tiendas:
- `FTO`, `TDF` → presumiblemente **FTD (Farmatodo)**.
- `CETRAL`, `CENTAL` → presumiblemente **Central**.
- Confirmar el **nombre oficial** de cada sucursal (idealmente un identificador único por tienda).

### 7 — "Aliado Comercial Caracas" y la ruta sin asesor
- En la lista de correos aparece `aliadocomercialcaracas@ponce-benzo.com`, **sin una persona asociada**. ¿A qué/quién corresponde?
- El archivo de rutas tiene una **5.ª hoja sin nombre de asesor** (paradas: Melani-Los Palos Grandes, Albita-Santa Eduvigis, Locatel La Castellana). ¿Quién atiende esa ruta? ¿Se relaciona con el correo anterior?

### 8 — Personal pendiente de alta
Estas personas tienen correo pero **aún no participan del piloto** (no tienen ruta definida en el archivo actual). Confirmar si deben darse de alta y con qué ruta:
- **Asesores sin ruta individual:** Betsy Castro, Joseph Padilla, Juan León, Martha Viloria.
- **Mercaderista sin ruta:** Jonathan Fernández.
- **Gerentes de otras zonas:** Andreina Rangel, Diana Delgado, Dubraska Pérez.
- **Administración:** Nidia Rojas, Yelitze Pérez, Iris Mujica (definir si necesitan acceso y con qué rol).

---

## 4. Plantilla sugerida para reunir los datos de sucursales

Una sola hoja de cálculo con una fila por **sucursal** y estas columnas:

| Columna | Ejemplo | Obligatorio |
|:---|:---|:---:|
| Nombre oficial de la sucursal | Farmatodo Los Monjes | ✅ |
| Cadena | Farmatodo | ✅ |
| Canal | Farmacia | ✅ |
| Clasificación (A/B/C) | A | ✅ |
| Estado | Distrito Capital | ⬜ |
| Municipio | Libertador | ⬜ |
| Urbanización / Zona | Los Monjes | ⬜ |
| Dirección | Av. … local … | ⬜ |
| Latitud | 10.4806 | ⬜ |
| Longitud | -66.9036 | ⬜ |
| Encargado — nombre | — | ⬜ |
| Encargado — cargo | Comprador | ⬜ |
| Encargado — teléfono | 0414-… | ⬜ |
| Mercaderista asignado | Carlos Zurita | ✅ |

> [!IMPORTANT]
> Lo marcado ✅ es lo mínimo para operar; lo demás (⬜) puede completarse luego, incluso capturándose en campo con la app. **El piloto puede arrancar sin esperar todos estos datos.**

---

## Enlaces Relacionados
- [[arquitectura/Ingesta - Mapeo de Datos|Mapeo de Datos de Ingesta]] — detalle técnico del cruce MAESTRO/RUTAS.
- [[pendientes/Pendientes|Pendientes]] — alcance del piloto y bloqueadores.
