---
title: "Propuesta — Módulo Pipeline de Ventas (CRM) para Ponce & Benzo"
date: 2026-09-30
version: "v01"
cliente: "poncebenzo"
tags:
  - propuesta
  - crm
  - pipeline
  - hub-modulos
---

# Propuesta de proyecto — Pipeline de Ventas (CRM)

**Preparado para:** Diego Mori · Ponce & Benzo
**Preparado por:** oito · info@oitove.com
**Fecha:** 30 de septiembre de 2026 · **Versión:** v01

---

## 01 · Lo que escuchamos

Hoy los vendedores de Ponce & Benzo toman pedidos, y la meta es que salgan a la calle a **buscar clientes nuevos y abrir negocio en los clientes de siempre**. Para eso la dirección necesita algo que hoy no existe: **ver ese esfuerzo**. Qué negocios hay abiertos, en qué etapa está cada uno, cuánto dinero hay en juego y quién los está moviendo.

En la reunión del 25 de septiembre quedaron claros los requisitos:

- Un **tablero tipo HubSpot** donde cada negocio avanza por etapas hasta **ganado** o **perdido**.
- Cada negocio con **monto estimado** y **fecha estimada de cierre**.
- **Ficha de cada empresa** con sus contactos (nombre, cargo, correo, teléfono) y el registro de lo conversado.
- **Cada vendedor ve lo suyo**; Rosley y la directiva ven toda la fuerza de ventas.
- **Diego configura** los campos y las etapas sin depender del desarrollador.
- **Ganado** solo con contrato firmado o nota que lo justifique; **perdido** siempre con motivo.

> [!NOTE]
> **¿Qué cuenta como negocio?** Un cliente nuevo, un producto o línea nueva en un cliente existente (por ejemplo, Farmatodo codificando el Ice Arnica Spray), una sucursal nueva, o un aumento sostenido del volumen mensual. Una recompra no es un negocio.

---

## 02 · La solución

Un **módulo de ventas dentro del mismo hub** que ya usan con el tracker de mercaderistas: mismo acceso, mismos clientes, mismos productos, sin cargar nada dos veces. Cada persona entra al hub y ve los módulos que tiene habilitados.

**Cómo se organiza la información:**

- El **cliente** es el centro: puede ser un **prospecto** (todavía no compra) o un **cliente activo**.
- Cada cliente tiene sus **contactos** (el comprador de la sede, el encargado de una sucursal) y sus **sucursales**.
- Cada **negocio** pertenece a un cliente y dice **qué se está vendiendo** (productos o líneas), **a quién** (los contactos involucrados y su rol: decide, compra, influye) y, si aplica, **en qué sucursales**.
- Cuando se gana un negocio de sucursal nueva, **esa sucursal queda lista para asignarla a las rutas de los mercaderistas**: lo que vende el vendedor se convierte en trabajo de campo automáticamente.

---

## 03 · Alcance

### Pipeline de negocios
- Tablero con **arrastrar y soltar** entre etapas, con el **total de dinero por etapa**. En el celular, vista de lista.
- **Etapas configurables** por Diego: agregar, quitar, renombrar y reordenar. **Ganado** y **Perdido** son fijas.
- Filtros por vendedor, tipo de negocio y fecha de cierre.
- **Reglas de cierre:** ganado exige contrato o nota; perdido exige motivo (lista editable).

### Ficha del negocio
- Monto, fecha estimada de cierre, **tipo de negocio** (cliente nuevo, línea nueva, sucursal nueva, aumento de volumen).
- Productos o líneas en juego, contactos con su rol y sucursales involucradas.
- **Actividades:** notas, llamadas, reuniones y recordatorios con fecha.
- Historial de etapas: cuándo pasó por cada una y quién la movió.

### Clientes y contactos
- Clientes en estado **prospecto** o **activo**; el vendedor puede crear prospectos nuevos.
- **Aviso de duplicado:** antes de crear un cliente, el sistema avisa si ya existe y quién lo atiende.
- Contactos asociados a la empresa, con la sucursal que atienden cuando aplica. Los contactos que ya existen en el tracker se conservan.

### Campos personalizados
- Diego crea sus propios campos en **negocios, clientes y contactos**: texto, número, monto, fecha, lista desplegable, sí/no o usuario.
- Cada campo puede ser **obligatorio**, incluso solo a partir de cierta etapa (por ejemplo, "N° de contrato" para pasar a Ganado).

### Permisos
| Rol | Ve | Puede |
|---|---|---|
| **Vendedor** | Sus negocios y sus clientes | Crear clientes, contactos y negocios; mover sus tarjetas; registrar actividades |
| **Gerencia** (Rosley, directiva) | Toda la fuerza de ventas y las métricas | Todo lo anterior y reasignar negocios |
| **Administrador** (Diego) | Todo | Todo lo anterior y configurar etapas, campos, motivos de pérdida y accesos |

### Métricas
- Dinero en juego **por etapa** y **por vendedor**.
- Negocios **cerrados por vendedor y por mes**.
- **% de ingreso nuevo** por vendedor, separado por tipo de negocio.
- Tasa de conversión y principales motivos de pérdida.

### No incluye (se puede cotizar después)
- Ubicación GPS de los vendedores en la calle.
- Varios pipelines en paralelo (el sistema queda preparado para habilitarlos).
- Integración con Outlook para registrar correos a los contactos.
- Integración con WhatsApp.
- App nativa del CRM (el CRM se usa desde el navegador, también en el celular).

---

## 04 · Cronograma

Seis semanas, en tres fases, con una **primera demo en la semana 3**.

| Fase | Semanas | Qué se entrega |
|---|---|---|
| **1 · Núcleo** | 1–3 | Tablero de negocios, fichas de negocio y cliente, contactos, permisos por rol y acceso por módulo en el hub. **Primera demo.** |
| **2 · Configuración y métricas** | 4–5 | Etapas y campos personalizados, motivos de pérdida, reglas de cierre y tablero de métricas. |
| **3 · Cierre** | 6 | Paso de sucursales ganadas al tracker, pruebas con el equipo y capacitación. |

**Fechas estimadas:** con aprobación y anticipo la semana del 5 de octubre, la **primera demo sería alrededor del 23 de octubre** y la **entrega final alrededor del 13 de noviembre**.

Trabajamos en entregas semanales con un punto de revisión al cierre de cada semana. El inicio está sujeto a la recepción del anticipo.

---

## 05 · Lo que necesitamos de Ponce & Benzo

- **Lista de vendedores** que usarán el módulo y quiénes forman la gerencia (Rosley, directiva, Maximino).
- **Etapas iniciales** del pipeline (partimos de: entrada → hablando → reunión → propuesta → ganado / perdido) y **motivos de pérdida** frecuentes.
- **Campos iniciales** que Diego quiera ver en negocios, clientes y contactos.
- **Negocios en curso** que quieran cargar desde el inicio (si existen en Excel, los importamos).
- Una persona de referencia (Diego) para validar cada entrega semanal.

---

## 06 · Inversión

| Concepto | Monto |
|---|---|
| **Implementación del módulo Pipeline de Ventas** (pago único) | **$2.000 USD** |
| **Mantenimiento unificado del hub** (tracker + ventas) | **$250 USD / mes** |

El mantenimiento **reemplaza** al actual: queda **un único fee mensual** para todo el hub, e incluye hosting, soporte, monitoreo y ajustes menores de ambos módulos. Aplica desde la entrega final.

### Condiciones de pago
| Hito | % | Monto |
|---|---|---|
| Aprobación de la propuesta (anticipo) | 40 % | $800 |
| Primera demo (fin de la fase 1) | 30 % | $600 |
| Entrega final (fin de la fase 3) | 30 % | $600 |

Al menos el 50 % de cada pago en divisas; el resto a tasa Binance del día del pago.

---

## Aceptación

Para arrancar, basta con responder aprobando esta propuesta. Con el anticipo reservamos el cupo del equipo y agendamos la fecha de la primera demo.
