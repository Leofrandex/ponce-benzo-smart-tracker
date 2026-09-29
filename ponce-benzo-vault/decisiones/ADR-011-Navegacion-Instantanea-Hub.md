---
title: "ADR-011: Navegación instantánea del hub (skeletons, caché SWR y middleware liviano)"
date: 2026-09-29
status: aceptado
tags:
  - adr
  - decisiones
  - hub
  - rendimiento
  - ux
---

# ADR-011: Navegación instantánea del hub

* **Estado**: `aceptado`
* **Fecha**: 2026-09-29
* **Autores**: Agente de IA & Usuario

---

## Contexto
Al hacer click en una sección del hub pasaban tres cosas seguidas:
1. **Espera antes del cambio.** El middleware llamaba a `supabase.auth.getUser()` en *cada* request, también en las navegaciones internas (RSC). Eso suma un round-trip a Supabase Auth antes de poder pintar nada. Además no había ningún `loading.tsx`, así que Next dejaba la sección vieja en pantalla hasta tener la nueva.
2. **Tarjetas en blanco o en cero.** Cada página es cliente y lee con `useSupabaseQuery` al montar, así que siempre partía sin datos.
3. **Todo desde cero al volver.** No había caché: volver a una sección ya vista repetía todas las consultas.

## Decisión
1. **Skeletons.** Se agregó `hub/app/components/ui/Skeleton.tsx`, con piezas base y una pantalla por sección, y la clase `.skeleton` en `globals.css`: gris con un brillo que barre y sin animación si el usuario pide `prefers-reduced-motion`.
   - Cada sección tiene su `loading.tsx` con la forma de su contenido. El título de la sección se pinta real.
   - El Panel se movió al grupo de rutas `panel/(inicio)/`. Así el `panel/loading.tsx` genérico no muestra la forma del dashboard en otras secciones. La URL no cambia.
   - Dentro de cada página, los "Cargando…" y los KPI en "—" pasan a skeleton. `KpiCard` recibe la prop `cargando`.
2. **Caché stale-while-revalidate en `useSupabaseQuery`.** Se activa con un tercer argumento `key`, y el dato se guarda bajo `key + deps`.
   - Al volver a una sección se pinta lo último leído y se refresca por detrás.
   - `loading` solo es `true` cuando no hay nada que mostrar. Un `refetch` después de guardar ya no hace parpadear la lista.
   - Si cambia el periodo, nunca se muestra el dato del periodo anterior.
   - Los requests idénticos en vuelo se comparten: vendedores, tiendas y roster se piden desde varias secciones.
   - Un guard por request evita que una respuesta vieja pise a una nueva.
   - La caché vive en memoria de la pestaña. Se vacía al cerrar sesión o si cambia el usuario (`auth-context`).
3. **Middleware liviano en navegación interna.** Si el request es RSC o prefetch (`RSC: 1` / `Next-Router-Prefetch`), se usa `getSession()`, que lee la cookie sin ir a la red. En la carga completa de un documento se sigue usando `getUser()`, que valida el token contra Supabase Auth.

## Consecuencias
### Positivas 👍
- El cambio de sección es inmediato. Con prefetch en producción, el skeleton de la sección se ve en el mismo frame del click.
- Nunca se ven ceros falsos mientras carga, y el layout no salta cuando llegan los datos.
- Volver a una sección ya vista es instantáneo y hay menos consultas repetidas a Supabase.

### Negativas / Riesgos 👎
- En navegación interna, el middleware confía en la cookie sin validarla contra Auth. **Mitigación:** el middleware es solo la puerta de UX. Los datos los protege RLS con el JWT real, y cada carga completa sigue validando con `getUser()`.
- El dato cacheado puede quedar unos instantes desactualizado hasta que termina la revalidación. Es aceptable para un panel de supervisión.
- Las keys de caché son strings a mano. **Dos fetchers distintos no deben compartir la misma key.** Las keys compartidas hoy son `assignees`, `stores`, `clients`, `merch:roster`, `cumplimiento`, `tasks:full`, `catalog` y `app:versiones`.
- En `next dev` cada ruta se compila la primera vez que se visita, así que ahí siempre se siente más lento que en producción.

## Enlaces Relacionados
- [[decisiones/Registro de Decisiones|Registro de Decisiones]]
- [[logs/Log-2026-09-29|Log 2026-09-29]]
- [[decisiones/ADR-010-Tipografia-Hub|ADR-010]]
