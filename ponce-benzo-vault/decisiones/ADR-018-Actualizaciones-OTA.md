---
title: "ADR-018: Actualizaciones OTA de la app móvil"
date: 2026-11-06
status: aceptado
tags:
  - adr
  - decisiones
  - mobile
---

# ADR-018: Actualizaciones OTA de la app móvil

* **Estado**: `aceptado`
* **Fecha**: 2026-11-06
* **Autores**: Agente de IA & Usuario

---

## Contexto
Cada corrección de la app exigía compilar un APK y conseguir que cada mercaderista lo instalara. Varios teléfonos quedaron meses en versiones viejas.

## Decisión
Los cambios de JavaScript se publican con `eas update`, en el canal `preview`. `runtimeVersion` sigue la versión de la app, así que una actualización solo llega a los teléfonos con esa misma versión. La app busca versiones al abrir, descarga en segundo plano y la aplica en la siguiente apertura. `UpdateBanner` muestra el progreso y pide cerrar y abrir la app.

Comando: `eas update --channel preview --environment preview --platform android`.

> [!CAUTION]
> `--environment preview` es obligatorio: sin `.env` local, el paquete saldría sin la URL de Supabase. Tras publicar, comprobar la URL en el `.hbc` y el commit en el manifiesto.

## Consecuencias
### Positivas 👍
- Las correcciones llegan sin reinstalar.
- El sello de Perfil dice qué commit corre cada teléfono.

### Negativas / Riesgos 👎
- Una actualización llega a todos los teléfonos de esa versión, sin etapa previa. Willian recibió estas sin que estuviera previsto.
- Hace falta abrir la app dos veces, y no busca versiones mientras sigue abierta.
- Los cambios nativos siguen exigiendo APK.
- Sin probar: con una ruta activa, el GPS de fondo podría mantener viva la app al cerrarla y retrasar la actualización.
