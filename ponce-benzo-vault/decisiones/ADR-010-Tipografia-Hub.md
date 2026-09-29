---
title: "ADR-010: Tipografía del hub — Plus Jakarta Sans y escala fija"
date: 2026-09-29
status: aceptado
tags:
  - adr
  - decisiones
  - diseno
---

# ADR-010: Tipografía del hub — Plus Jakarta Sans y escala fija

* **Estado**: `aceptado`
* **Fecha**: 2026-09-29
* **Autores**: Agente de IA & Usuario

---

## Contexto
Al usuario la letra del hub le parecía fea y los subrayados le restaban diseño. El origen estaba en `globals.css`: importaba Inter con un `@import` de Google Fonts colocado después de las directivas `@tailwind`, y el build de Next lo descartaba. En producción, la fuente real era la de respaldo `sans-serif`, que en Windows es **Arial**. Además había unos 15 tamaños de letra sueltos (de 8 a 44 px, mucho texto de 10 px), pesos de 800 mezclados con 600 y 700, links del dashboard subrayados al pasar el mouse y las etiquetas de los gráficos subrayadas siempre.

## Decisión
- **Fuente:** Plus Jakarta Sans, cargada con `next/font/google` en `app/layout.tsx`. Next la sirve desde el propio dominio y la expone como variable `--font-sans`. El token `--font` usa `system-ui` como respaldo.
- **Escala fija** con tokens en `:root`: `--text-2xs` 11 · `xs` 12 · `sm` 13 · `base` 14 · `md` 16 · `lg` 20 · `xl` 28 · `kpi` 40. El mínimo legible es 11 px y ya no hay tamaños sueltos, ni en CSS ni inline. Los iconos y emojis quedan fuera de la escala.
- **Pesos:**
  - 400 para el texto.
  - 500 para etiquetas.
  - 600 para títulos y cifras.
  - 700 solo para el KPI principal y las cifras grandes de 40 px.
  - El 800 se elimina.
- **Acabado:** `--tracking-tight` (−0.02em) en títulos y cifras. Interlineado de 1.5 en el `body` y 1.2 en los títulos, con `text-wrap: balance`.
- **Sin subrayados:** `a { text-decoration: none }` a nivel global. `.dash-link` marca el hover solo con el color de acento y el foco con anillo. Las etiquetas de gráfico que navegan van en gris secundario con peso 500 y pasan a acento al pasar el mouse.
- **Alcance:** solo el hub. La app móvil conserva Inter (`@expo-google-fonts/inter`).

## Consecuencias
### Positivas 👍
- La fuente elegida se ve de verdad, sin petición a Google y sin salto de fuente al cargar.
- Una sola escala: los cambios futuros de tamaño se hacen en un token, no en 300 estilos inline.

### Negativas / Riesgos 👎
- El hub (Jakarta) y la app (Inter) ya no comparten tipografía.
- Sin subrayado, los links dentro de un texto dependen del color y de flechas para distinguirse.
- Los tamaños cambiaron levemente: 10 px pasa a 11, 22 a 28 en los títulos de página y 44 a 40 en el KPI. Queda pendiente mirarlo en pantalla.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[logs/Log-2026-09-29|Log 2026-09-29]]
