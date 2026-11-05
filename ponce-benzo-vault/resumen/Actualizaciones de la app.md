---
title: "Actualizaciones de la app (sin reinstalar)"
date: 2026-11-05
tags:
  - resumen
  - mobile
  - eas-update
  - runbook
---

# Actualizaciones de la app (sin reinstalar)

Desde la 1.4.0 la app móvil recibe cambios de JavaScript por aire (EAS Update), sin que el mercaderista instale otro APK. Configuración en `mobile/app.json`: `updates.enabled`, `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`, y `runtimeVersion` con política `appVersion`. El canal es `preview` (ver `mobile/eas.json`).

> [!IMPORTANT]
> Solo reciben actualizaciones los teléfonos con la **1.4.0 o posterior**. Las versiones anteriores no traen `expo-updates` activo: esas se actualizan instalando el APK nuevo.

## Cómo funciona

- Al abrir la app, descarga en segundo plano la última actualización compatible.
- Se aplica en la **siguiente apertura**: la primera abre con lo anterior, la segunda con lo nuevo (cierre completo de la app, no solo minimizar).
- Una actualización solo la reciben los APK con el mismo `runtimeVersion` (= `version` de `app.json`) y el mismo canal.

## Publicar una actualización

Desde `mobile/`:

```bash
eas update --channel preview --message "descripción corta del cambio"
```

Antes: pruebas y `npx --no-install tsc --noEmit` en verde.

> [!WARNING]
> Si el cambio depende de una migración de base de datos, aplica la migración **primero**. La actualización llega a los teléfonos en cuanto se publica; si la app nueva consulta columnas o tablas que aún no existen, falla en campo.

## Revertir

Verificado con la ayuda de eas-cli (`eas update:rollback --help`):

- `eas update:rollback`: interactivo, vuelve a una actualización existente o al código embebido en el APK.
- No interactivo: `eas update:republish` (republica una actualización anterior) o `eas update:roll-back-to-embedded`.

Antes de usar cualquiera, revisa los flags con `eas update:republish --help` y `eas update:roll-back-to-embedded --help`. Los teléfonos aplican la reversión igual que una actualización: en la siguiente apertura.

## Qué exige un APK nuevo

Una actualización por aire solo cambia JavaScript y assets. Hace falta `eas build -p android --profile preview` y reinstalar cuando cambia:

- Una librería nativa (agregar, quitar o actualizar un paquete con código nativo).
- Los permisos de Android o los plugins de `app.json`.
- La versión de Expo SDK.
- El campo `version` de `app.json`: `runtimeVersion` lo sigue (`appVersion`), así que los APK viejos dejan de recibir lo nuevo. Cambiar `version` es, en la práctica, partir la flota en dos.

## Dependencias de un release

1. Aplicar primero la migración de base de datos.
2. Publicar la actualización (o repartir el APK si exige uno nuevo).
3. Solo cuando todos estén en la versión nueva, actualizar `VERSION_VIGENTE` en el hub (`hub/app/lib/queries/appVersion.ts`).

Relacionado: [[resumen/Constitucion|Constitución]].
