---
title: "ADR-012: CRM centrado en la cuenta (contacto cuelga del cliente)"
date: 2026-09-30
status: aceptado
tags:
  - adr
  - decisiones
  - crm
  - base-de-datos
---

# ADR-012: CRM centrado en la cuenta (contacto cuelga del cliente)

* **Estado**: `aceptado` (diseño; se implementa si P&B aprueba la propuesta)
* **Fecha**: 2026-09-30
* **Autores**: Agente de IA & Usuario

---

## Contexto

El módulo de pipeline de ventas ([[arquitectura/Spec - CRM Pipeline de Ventas|Spec]]) necesita asignar oportunidades a clientes y contactos. Hoy `contacts.store_id` es obligatorio: cada contacto pertenece a una **sucursal**, porque el modelo nació del tracker de mercaderistas.

En P&B la venta a cadenas (Farmatodo, Gama, Red Vital) se decide en la **sede**: el comprador de categoría no pertenece a ninguna sucursal. Un prospecto recién creado tampoco tiene sucursales. Se evaluó la cadena Oportunidad → Cliente → Sucursal → Contacto y una sucursal ficticia "Oficina principal"; ambas fuerzan el modelo del tracker sobre la venta.

## Decisión

- La **oportunidad pertenece al cliente** (account).
- El **contacto pertenece al cliente**; `store_id` pasa a **opcional** e indica a qué sucursal atiende.
- A la oportunidad se asignan contactos **del mismo cliente**, con rol (decide / compra / influye), además de productos o líneas y sucursales en juego.
- Un prospecto es un cliente con `status = 'prospecto'`. Las sucursales nuevas en negociación usan `stores.status = 'en_negociacion'` y se activan al ganar.
- Tipos de negocio **fijos** (cliente nuevo, línea nueva, sucursal nueva, aumento de volumen). Etapas del pipeline **configurables**, con Ganado y Perdido fijos. **Un pipeline** en v1, con la tabla `pipelines` lista para varios.

## Consecuencias
### Positivas 👍
- Contactos corporativos y de prospectos tienen dónde vivir sin sucursales falsas.
- El tracker no cambia: los contactos actuales conservan su sucursal.
- Lo que se gana en el CRM (sucursales nuevas) pasa al tracker sin cargarse dos veces.

### Negativas / Riesgos 👎
- Migración de `contacts` (llenar `client_id` desde la sucursal); las consultas que asumen `store_id` no nulo deben revisarse.
- Las sucursales `en_negociacion` deben excluirse en todas las funciones del tracker (rutas, mapa, dashboard).

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[decisiones/ADR-002-Modelo-CRM|ADR-002]]
- [[roadmap/Roadmap|Roadmap del Proyecto]]
