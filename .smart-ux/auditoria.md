---
fecha: 2026-09-29
alcance: todo el proyecto (hub Next.js + app móvil Expo)
metodo: solo código
commit: 1cb9bbf
sistema_de_diseno: hub/app/globals.css (:root) + mobile/src/theme.ts
---

# Auditoría smart-ux — Ponzivenzo Smart Tracker

## Resumen
El método fue solo leer el código, porque el hub pide login contra Supabase en vivo y la app necesita dispositivo. Los anchos y alturas en móvil son estimaciones sacadas del CSS y conviene confirmarlos en un teléfono real.

Hay **77 hallazgos: 16 alta, 34 media y 27 baja**. De ellos, 13 son **decide**. Los patrones de fondo son cinco:
1. **Errores que se disfrazan de vacío o se tragan.** Un fetch que falla muestra "0%" o "no encontrado". Un guardado que falla cierra el modal y borra lo escrito. En móvil, los fallos de visita y cámara se pierden en silencio.
2. **Accesibilidad de teclado y lector.** Hay foco invisible (`all: unset`, `outline: none`), inputs sin label, Select sin flechas, y switch, chips y segmentos sin estado anunciado. En móvil no hay ni un `accessibilityRole`.
3. **El hub en el teléfono del supervisor.** La barra inferior de 7 ítems se sale de la pantalla, el mapa queda en 56px, la tabla de Tiendas se aplasta, los targets miden menos de 44px y el hover se queda pegado.
4. **Presupuesto de rojo gastado.** Cada tarea abierta, las barras de anomalías, cerrar sesión y "Finalizar Ruta" van en rojo, así que la excepción real no destaca.
5. **Motion sin `prefers-reduced-motion`,** y con el feedback de toque a 200ms.

> Bug colateral (no es UX): `DateRangeChips.tsx:12-17` calcula "Últimos 7 días" con UTC y abarca 8 días, así que después de las 20:00 en Caracas "Hoy" cae en mañana. Está dentro de SX-065.

## Hallazgos

### SX-001 · alta · Un fetch que falla se muestra como vacío o "0"
- **Dónde:** `hub/app/(panel)/panel/page.tsx:49-58` (10 consultas ignoran `error`; los KPI dan `0%` en rojo también mientras cargan; `CumplimientoChart.tsx:29` dice "No hay rutas planificadas") · `hub/app/(panel)/panel/tiendas/[storeId]/page.tsx:35-42,102-106` ("Cliente no encontrado") · `ContactList.tsx:44` · `hub/app/(panel)/panel/mapa/page.tsx:38-40,81` · `MapHistoryView.tsx:37` · `mercaderistas/[id]/page.tsx:41-44,158` · `tiendas/page.tsx:69-72` · `RestockFormModal.tsx:24,112` · `mobile/src/screens/RouteScreen.tsx:68` · `mobile/src/screens/VisitHistoryScreen.tsx:49,115`
- **Regla:** smart-estados-ux · empty-states.md · 4 (Hay cuatro tipos de vacío — diseña cada uno)
- **Hoy:** un error de red se ve igual que "no hay datos". El supervisor lee "0% de cumplimiento" o "cliente no encontrado".
- **Arreglo:** leer `error` de cada `useSupabaseQuery` y mostrar el error de esa sección con Reintentar (`refetch`). Mientras `data === null`, un placeholder en vez de `0`. En móvil, guardar el error y mostrarlo con reintento.
- **Estado:** aplicado — `SectionError` compartido (ui/SectionError.tsx) con Reintentar por sección; "—" sin color mientras carga. Panel (10 consultas + 8 widgets de dashboard aceptan null/error/onRetry), tiendas/[storeId] (7 consultas; "no encontrado" solo si no existe), ContactList, EngagementsPanel, RestockFormModal (catálogo), tiendas/page, mercaderistas/[id], MapHistoryView. Móvil (RouteScreen/VisitHistory) no se tocó en este hallazgo.

### SX-002 · alta · Un guardado que falla borra lo que el usuario escribió
- **Dónde:** `hub/app/components/clientes/ContactFormModal.tsx:233-241` · `StoreFormModal.tsx:109-122` · `EngagementsPanel.tsx:20-25` (con `tiendas/[storeId]/page.tsx:79-83`, que hace `alert` y no lanza error)
- **Regla:** smart-estados-ux · optimistic-ui.md · 3 (El camino de falla — deshacer solo)
- **Hoy:** llama a `onSave` y enseguida a `onClose()`, o hace `setBody("")`, sin esperar. Si falla, sale un alert y el texto ya se perdió.
- **Arreglo:** que `onSave` devuelva `{ error }` y el modal solo se cierre si salió bien. Mientras tanto, el botón muestra "Guardando…" y el error aparece dentro del modal. Es el patrón que ya usa `RestockFormModal.tsx:50-58`.
- **Estado:** aplicado — handlers de tiendas/[storeId] devuelven `{ error }` (sin alert); Store/ContactFormModal esperan, "Guardando…"/"Eliminando…", error inline role="alert", cierran solo si OK; EngagementsPanel limpia solo si guardó. Queda `onRestockDelete` con confirm/alert (va con SX-028).

### SX-003 · alta · Los formularios pierden lo escrito al cerrarse sin querer
- **Dónde:** `StoreFormModal.tsx:131,76` · `ContactFormModal.tsx:96,69` · `RestockFormModal.tsx:66,40` (clic en el fondo y Esc) · `mobile/src/screens/CheckInScreen.tsx:199` (atrás y back de Android) · `mobile/src/components/CompetitionPanel.tsx:96,102` · `ProductPickerSheet.tsx:229`
- **Regla:** smart-formularios-ux · wizard.md · 5 (Guardar el estado en cada paso)
- **Hoy:** con un clic fuera o Esc, el modal se cierra sin preguntar. En el check-in, un toque en atrás tira fotos, estado, motivos y observaciones.
- **Arreglo:** si el form está sucio, el fondo y Esc no cierran o piden "¿Descartar cambios?". En CheckIn, guardar un borrador por `store_id` en el SQLite local y confirmar el descarte con `beforeRemove`.
- **Estado:** aplicado (solo la parte del hub; la parte móvil se revirtió y quedó en `.smart-ux/mobile-altas-2026-09-29.patch`) — hub: franja "Tenés cambios sin guardar. [Seguir editando] [Descartar]" (DiscardChangesBar) en los 3 modales ante fondo/Esc con form sucio. Móvil: borrador del check-in por usuario+tienda en SQLite `meta` (services/checkinDraft.ts + test), restaurado al volver (fotos borradas se avisan), `beforeRemove` con confirmación; CompetitionPanel y ProductPickerSheet confirman el descarte.

### SX-004 · alta · El registro de visita en móvil se traga los errores
- **Dónde:** `mobile/src/screens/CheckInScreen.tsx:190-193` · `mobile/src/context/RouteContext.tsx:299-341` (anomalías, productos repuestos y competencia solo van a `console.warn`)
- **Regla:** smart-estados-ux · optimistic-ui.md · 3 (El camino de falla — "Avisa en un toast breve")
- **Hoy:** si `insertVisit` o los datos secundarios fallan, el promotor ya volvió a la ruta y nadie le avisa.
- **Arreglo:** mantener el cierre inmediato, pero si falla mostrar un aviso en la ruta ("No se pudo guardar la visita a X · Reintentar") que diga qué parte no se guardó.
- **Estado:** revertido (2026-09-29, el rediseño es solo del hub; cambios en `.smart-ux/mobile-altas-2026-09-29.patch`) — antes: aplicado — `recordVisit` guarda cada parte por separado; aviso persistente en RouteScreen que dice qué no se guardó, con Reintentar solo de lo fallido y log `visit_save_fail`. El aviso vive en memoria (se pierde si se reinicia la app; el borrador sí persiste).

### SX-005 · alta · "Finalizar Ruta" es irreversible, va de un toque y ocupa el lugar del botón primario
- **Dónde:** `mobile/src/screens/RouteScreen.tsx:154-156` → `mobile/src/context/RouteContext.tsx:210-224` (`endSession`)
- **Regla:** smart-estados-ux · acciones-destructivas.md · 3 (Fuera del camino feliz) y 2 (Nombra la acción)
- **Hoy:** ocupa la misma posición que "Empezar Ruta". Un toque cierra la jornada, y el estado se marca antes de `stopBackground`/`ssEnd`, sin manejar fallos.
- **Arreglo:** confirmar con el verbo y lo que se pierde ("Quedan 3 tiendas pendientes y no vas a poder editar las visitas de hoy. [Seguir en ruta] [Finalizar ruta]"), sacarlo de la posición del primario y marcar el fin solo después de persistirlo.
- **Estado:** revertido (2026-09-29, el rediseño es solo del hub; cambios en `.smart-ux/mobile-altas-2026-09-29.patch`) — antes: aplicado — "Finalizar Ruta" al final de la lista, confirmación con tiendas pendientes y botón destructivo; el fin se persiste antes de cambiar la UI, error inline si falla; "Finalizando…".

### SX-006 · alta · "Empezar Ruta" no muestra indicador y falla en silencio si se niega el GPS
- **Dónde:** `mobile/src/screens/RouteScreen.tsx:153-158` · `mobile/src/context/RouteContext.tsx:172-173`
- **Regla:** smart-estados-ux · carga.md · 2 (Spinner dentro del botón) y empty-states.md · 4 (Error → Retry)
- **Hoy:** el botón queda quieto 3 s o más mientras obtiene el GPS. Si se niega el permiso, `gpsState='error'` no se muestra y el toque parece no hacer nada.
- **Arreglo:** exponer `starting` y pasar `loading` al `Button` ("Empezando…"). Si se niega el permiso, un mensaje en línea con "Abrir ajustes / Reintentar".
- **Estado:** revertido (2026-09-29, el rediseño es solo del hub; cambios en `.smart-ux/mobile-altas-2026-09-29.patch`) — antes: aplicado — contexto expone `starting`/`startError`; botón "Empezando…" (prop `loadingLabel` en Button); permiso denegado u otro fallo → mensaje en línea con "Abrir ajustes" y "Reintentar".

### SX-007 · alta · Si la cámara falla, se cierra sola sin decir nada
- **Dónde:** `mobile/src/components/CameraModal.tsx:54-56`
- **Regla:** smart-estados-ux · upload.md · 3 (Reintento en línea)
- **Hoy:** si `takePictureAsync` falla, se llama a `handleClose()` y el promotor no sabe que la foto no quedó.
- **Arreglo:** quedarse en la cámara con "No se pudo tomar la foto · Intentá de nuevo".
- **Estado:** revertido (2026-09-29, el rediseño es solo del hub; cambios en `.smart-ux/mobile-altas-2026-09-29.patch`) — antes: aplicado — CameraModal queda abierto con "No se pudo tomar la foto · Intentá de nuevo".

### SX-008 · alta · Foco de teclado invisible
- **Dónde:** `hub/app/components/tareas/TaskSummary.tsx:11,35,105,121` (`all: unset` y `.summary-cell:focus-visible { outline: none }`) · `components/mapa/MapFilterSidebar.tsx:57,110` · `components/ui/MultiSelect.tsx:43` · `hub/app/globals.css:411-433` (`.form-input` con `outline: none` y un halo del 8%)
- **Regla:** smart-navegacion-ux · tabs.md · 3 (el anillo de foco nunca comparte color con el activo) · smart-formularios-ux · busqueda.md · 4 (Focus ring de 2px, nunca invisible) · smart-visual-ux · SKILL.md · Tell 1 (el acento es para el foco)
- **Hoy:** al navegar con Tab no se ve qué elemento tiene el foco.
- **Arreglo:** usar una clase global `.focus-ring:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`, que es el patrón que ya existe en `dashboard.css:22-27`. Aplicarla a todos los `all: unset` y a `.form-input:focus-visible`.
- **Estado:** aplicado — `.focus-ring` (outline `!important` para ganarle a `all: unset` inline) en TaskSummary, MapFilterSidebar, MultiSelect, Segmented y nav; `.form-input/.form-textarea/.form-select:focus-visible` con outline 2px var(--accent); quitado el `outline:none` de `.summary-cell`.

### SX-009 · alta · Campos sin etiqueta accesible
- **Dónde:** `StoreFormModal.tsx:31-40` y `ContactFormModal.tsx:30-39` (`Field` con el label en un `<div>`) · `RestockFormModal.tsx:14` (`FieldLabel`, líneas 92, 102 y 130) · `TaskResolutionNote.tsx:327` (`<label>` sin `htmlFor`) · `mobile/src/screens/LoginScreen.tsx:59-60,73-75,84` (el ojo es un emoji sin `accessibilityLabel`) · `CheckInScreen.tsx:433-434` · `CompetitionPanel.tsx:143-144` · `StorePickerSheet.tsx:125` · `ProductPickerSheet.tsx:237`
- **Regla:** smart-formularios-ux · SKILL.md · regla transversal (cada control es un sistema, con forma de hacerlo con teclado)
- **Hoy:** el lector de pantalla anuncia "campo de texto" o lee el placeholder. Nombre, Latitud y Longitud no tienen ningún nombre.
- **Arreglo:** en el hub, `<label htmlFor>` con un `useId()`. En RN, `accessibilityLabel` en cada `TextInput`, y en el ojo `accessibilityLabel="Mostrar contraseña"` con `accessibilityRole="button"`.
- **Estado:** aplicado (solo la parte del hub; la parte móvil se revirtió y quedó en `.smart-ux/mobile-altas-2026-09-29.patch`) — hub: Field/FieldLabel con `<label htmlFor>` + useId, TaskResolutionNote con htmlFor, grupos con aria-labelledby. Móvil: accessibilityLabel en todos los TextInput listados, ojo del login ("Mostrar/Ocultar contraseña"), volver, quitar foto y obturador.

### SX-010 · alta · El Select y el MultiSelect del hub no funcionan con teclado
- **Dónde:** `hub/app/components/ui/Select.tsx:30-31,45,46-61,78-92` · `hub/app/components/ui/MultiSelect.tsx:25,62-70`
- **Regla:** smart-formularios-ux · dropdown.md · 3 (Teclado siempre)
- **Hoy:** no responde a ↑↓ ni al salto por letra. No tiene `aria-expanded`, `aria-haspopup`, `role="listbox"` ni `role="option"`. El label no está vinculado, así que el nombre accesible es el valor ("Todos"). Al cerrar con Esc, el foco cae al `body`.
- **Arreglo:** agregar los roles ARIA y `aria-labelledby`, ↑↓ con índice activo, Enter para elegir, Esc para cerrar devolviendo el foco al trigger, y typeahead.
- **Estado:** aplicado — Select y MultiSelect: aria-haspopup/expanded/controls, label en el nombre accesible, role listbox/option + aria-selected, aria-activedescendant, ↑↓/Home/End, Enter/Espacio, Esc devuelve el foco, typeahead (`typeaheadIndex` exportado). API sin cambios.

### SX-011 · alta · El switch, los chips y los segmentos no anuncian su estado
- **Dónde:** `StoreFormModal.tsx:168,179,197-217` (switch "Sucursal activa") · `ContactFormModal.tsx:130-142` · chips: `ClientesFilters.tsx:56`, `DateRangeChips.tsx:118,122`, `TimePeriodSelector.tsx:59`, `configuracion/productos/page.tsx:70`, `configuracion/vendedores/page.tsx:206,209` · segmentos: `tiendas/[storeId]/page.tsx:143-165`, `ActivityFeed.tsx:58`, `mapa/page.tsx:152-161`, `TaskSummary.tsx:92-93`, `EngagementsPanel.tsx:77` · móvil: `RouteModeToggle.tsx:16-49`, `CheckInScreen.tsx:269-272`, `BottomSheetSelect.tsx`, `BottomSheetMultiSelect.tsx` (opciones)
- **Regla:** smart-formularios-ux · toggle.md · 3 (`role="switch"` + `aria-checked`) · smart-navegacion-ux · tabs.md · 3 (`role="tablist"`, roving tabindex, flechas)
- **Hoy:** el estado solo se distingue por el color. En `mobile/src` no hay ni un `accessibilityRole` ni un `accessibilityState`.
- **Arreglo:** el switch con `role="switch" aria-checked`. Los chips con `aria-pressed`. Un componente `Segmented` compartido con `tablist`/`tab`, `aria-selected`, roving tabindex y ←→, Home y End. En RN, `accessibilityRole` (`tab`/`radio`) con `accessibilityState={{ selected }}`.
- **Estado:** aplicado (solo la parte del hub; la parte móvil se revirtió y quedó en `.smart-ux/mobile-altas-2026-09-29.patch`) — componente `ui/Segmented.tsx` (tablist, roving tabindex, ←→/Home/End) en tiendas/[storeId], ActivityFeed, mapa y TaskSummary; switch con role="switch"/aria-checked; aria-pressed en chips (StoreForm, estrella, ClientesFilters, DateRangeChips, TimePeriodSelector, productos, vendedores, filtros de ActivityFeed, Nota/To-do). Móvil: accessibilityRole/State en RouteModeToggle (tab), estado de visita (radio), BottomSheetSelect (radio), BottomSheetMultiSelect y ProductPicker (checkbox), Button (disabled/busy).

### SX-012 · alta · decide · La barra inferior del hub se sale de la pantalla para el admin (7 ítems)
- **Dónde:** `hub/app/(panel)/layout.tsx:25-35,126-144` · `hub/app/globals.css:135-168` (`.nav-item` con `flex:1` y sin `min-width:0`)
- **Regla:** smart-navegacion-ux · tabs.md · 2 (Overflow: nunca salirse de una fila) y 4 (Móvil: más de 5 → bottom sheet)
- **Hoy:** los 7 ítems necesitan unos 440px en un teléfono de 360-412px. La barra es fija y el body tiene `overflow-x: hidden`, así que Mapa y Configuración no se pueden alcanzar.
- **Arreglo:** por debajo de 1024px, 4 ítems fijos y un "Más" que abra un bottom sheet con el resto. Como mínimo inmediato, `min-width:0` y ellipsis en `.nav-item`.
- **Pregunta:** ¿qué 4 secciones usa más un supervisor desde el teléfono?
- **Estado:** aplicado — decisión: Panel, Tareas, Tiendas, Mapa fijos + "Más" (bottom sheet en portal con Clientes, Mercaderistas y Configuración según rol; Esc/fondo/navegar cierran, foco atrapado y devuelto, filas de 48px). `.nav-item` con min-width:0, ellipsis y 44px. Sidebar de escritorio igual.

### SX-013 · alta · En el teléfono, el mapa queda en unos 56px de ancho
- **Dónde:** `hub/app/(panel)/panel/mapa/page.tsx:137-149` · `hub/app/components/mapa/MapFilterSidebar.tsx:52` (`width: 250, flexShrink: 0`)
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 3 (Contenido escondido: darle un hogar real, bottom sheet)
- **Hoy:** a 360px, el filtro de 250px deja el mapa casi sin ancho.
- **Arreglo:** por debajo de ~768px, ocultar el filtro detrás de un botón "Filtros (resumen)" que lo abra en un bottom sheet, y dejar el mapa a todo el ancho.
- **Estado:** aplicado — <768px el filtro se oculta por CSS y aparece "Filtros (resumen)" que lo abre en bottom sheet; mapa a todo el ancho. Prop `inSheet` en MapFilterSidebar.

### SX-014 · alta · La lista de Tiendas en el teléfono mete 6 columnas en una línea
- **Dónde:** `hub/app/components/clientes/ClientesTable.tsx:22,40-86` · `hub/app/globals.css:1225-1235` · `hub/app/components/clientes/RestocksPanel.tsx:6,36,43`
- **Regla:** smart-tablas-ux · movil.md · 1 (Rankear), 2 (Apilar) y 4 (Etiquetar)
- **Hoy:** el nombre es la única celda que se encoge y queda en "Fa…". El header está oculto, así que la fecha y la clase aparecen sin etiqueta.
- **Arreglo:** dos líneas por fila. Línea 1: nombre, con los pendientes a la derecha. Línea 2: canal · clase · "Visita 2026-03-04" en texto secundario. En RestocksPanel, línea 1: productos y fecha; línea 2: origen · autor.
- **Estado:** aplicado — ClientesTable en dos líneas en ≤600px (nombre + pendientes / "Canal · Clase X · Visita <fecha>"); RestocksPanel (productos + fecha / origen · autor). Media query 600px (se mantuvo la del proyecto; container query sigue en SX-042).

### SX-015 · alta · El Historial móvil muestra el UUID de la tienda en vez de su nombre
- **Dónde:** `mobile/src/screens/VisitHistoryScreen.tsx:14,17-19,78`
- **Regla:** smart-tablas-ux · movil.md · 1 (Rankear: la identidad es de quién es la fila)
- **Hoy:** `getStoreName` busca en `mockStores`, así que con los ids reales cae a `storeId` y muestra el UUID.
- **Arreglo:** tomar el nombre del catálogo en caché (`catalogCache`/`RouteContext`).
- **Estado:** revertido (2026-09-29, el rediseño es solo del hub; cambios en `.smart-ux/mobile-altas-2026-09-29.patch`) — antes: aplicado — el nombre sale de la ruta del día (online o caché, vía RouteContext); fallback "Tienda sin nombre". Tiendas fuera de ruta (reporte suelto) caen al fallback.

### SX-016 · alta · decide · El Perfil móvil muestra cifras inventadas
- **Dónde:** `mobile/src/screens/ProfileScreen.tsx:65-67` (tres StatCard con `value="0"` fijo) y `:83` ("Activo" siempre)
- **Regla:** smart-visual-ux · SKILL.md · Tell 5 (números que no suman se leen como falso) y Tell 3 (jerarquía plana)
- **Hoy:** el mercaderista ve 0 visitas aunque ya haya hecho la ruta.
- **Arreglo:** calcular las cifras desde el store local, o quitar la fila.
- **Pregunta:** ¿el perfil debe mostrar productividad real (y cuál sería la métrica primaria), o se quita la fila?
- **Estado:** pendiente — decide sin resolver: el usuario eligió "no tocar todavía" (2026-09-29).

### SX-017 · media · decide · El rojo como estado por defecto, no como excepción
- **Dónde:** `hub/app/(panel)/panel/tareas/page.tsx:30,202` (toda "Abierta" lleva `badge-danger` y borde rojo; el filtro por defecto es `open`) · `hub/app/(panel)/panel/page.tsx:106` (KPI de anomalías rojo con cualquier valor mayor que 0) · `AnomaliasPorTipo.tsx:92` · `TiendasCriticas.tsx:26` · `TiendasSinVisita.tsx:15,31`
- **Regla:** smart-visual-ux · SKILL.md · Tell 2 (el rojo es un presupuesto) · smart-estados-ux · acciones-destructivas.md · 4 (El rojo es un presupuesto)
- **Hoy:** en `/panel` hay rojo en 5-6 bloques a la vez, así que la tienda realmente crítica no se distingue.
- **Arreglo:** "Abierta" en neutro y rojo solo para las vencidas (+15/+30 días). Barras de anomalías en navy o neutro. KPI y números en rojo solo por encima de un umbral.
- **Pregunta:** ¿qué tasa de anomalías es la alarma? ¿Una tarea abierta de menos de 7 días es una excepción o lo esperado (o el rojo es a propósito para presionar al vendedor)?
- **Estado:** pendiente

### SX-018 · media · Rojo en acciones rutinarias
- **Dónde:** `hub/app/perfil/page.tsx:112` y `mobile/src/screens/ProfileScreen.tsx:88-90` (Cerrar sesión) · `mobile/src/screens/RouteScreen.tsx:156` (Finalizar Ruta) · `mobile/src/screens/CheckInScreen.tsx:370,424,626-630` (X para limpiar un campo)
- **Regla:** smart-visual-ux · SKILL.md · Tell 2 ("si lo gastas en un logout… ya no alarma")
- **Hoy:** salir, terminar el día o vaciar un campo opcional usan el mismo rojo que un borrado.
- **Arreglo:** usar `secondary`/`ghost` para cerrar sesión y Finalizar Ruta, y una X neutra (`textMuted` sobre `bgElevated`).
- **Estado:** pendiente

### SX-019 · media · Texto de demo o de otra app en producción
- **Dónde:** `mobile/src/screens/LoginScreen.tsx:98` ("Demo: czurita@ponce-benzo.com", que expone una cuenta real en el APK) · `hub/app/page.tsx:53,56,84` ("ver tu ruta del día" en el hub de supervisores; placeholder `demo@…`) · `hub/app/perfil/page.tsx:20-22` ("1.0.0 (demo)", "PWA", "Offline-first")
- **Regla:** smart-visual-ux · SKILL.md · Tell 5 (copy placeholder)
- **Hoy:** el copy viene del mockup y no describe el producto real.
- **Arreglo:** quitar la pista de demo, poner "Panel de supervisión" en el login del hub, y en `/perfil` leer la versión real o quitar el bloque.
- **Estado:** pendiente

### SX-020 · media · El mapa colorea las tiendas por canal con 6 colores y sin leyenda
- **Dónde:** `hub/app/components/mapa/StoreMarkersLayer.tsx:7-10`
- **Regla:** smart-visual-ux · SKILL.md · Tell 2 (el color semántico se reserva para el estado)
- **Hoy:** no hay leyenda, y el color de supermercado es exactamente `--success`, así que se lee como "OK".
- **Arreglo:** añadir una leyenda en el mapa o en el sidebar, y sacar del set de canales los colores iguales a los tokens de estado.
- **Estado:** pendiente

### SX-021 · media · decide · La clase A/B/C y "activa" usan colores de estado
- **Dónde:** `hub/app/components/clientes/ClientesTable.tsx:12-14,57,65`
- **Regla:** smart-visual-ux · SKILL.md · Tell 2 (una categoría se codifica con una sola familia de color)
- **Hoy:** una fila puede llevar hasta 4 colores, y la clase B en ámbar se lee como un problema.
- **Arreglo:** la clase como badge neutro, y quitar el punto de "activa" (marcar solo las inactivas).
- **Pregunta:** ¿la clase B o C es algo sobre lo que el supervisor tiene que actuar, o solo es una categoría comercial?
- **Estado:** pendiente

### SX-022 · media · Errores de guardado del hub con `alert()` nativo y mensaje crudo
- **Dónde:** `hub/app/(panel)/panel/tiendas/[storeId]/page.tsx:56,63,69,75,81,87,94` · `tareas/page.tsx:95` · `tiendas/page.tsx:107` (un "Agregar sucursal" que solo responde con un alert)
- **Regla:** smart-estados-ux · notificaciones.md · 2 (La severidad elige la superficie) y empty-states.md · 2 (Tono)
- **Hoy:** un modal bloqueante del navegador muestra el error del backend concatenado.
- **Arreglo:** mostrar el error en línea con `role="alert"`, como `productos/page.tsx:99`. Ocultar o deshabilitar "Agregar sucursal" con una explicación visible.
- **Estado:** pendiente

### SX-023 · media · Los estados de error no ofrecen Reintentar y muestran el error técnico
- **Dónde:** `tareas/page.tsx:165-170` · `clientes/page.tsx:56` · `tiendas/page.tsx:92-93` · `configuracion/productos/page.tsx:59` · `configuracion/vendedores/page.tsx:64` · `mercaderistas/page.tsx:60` · `mercaderistas/[id]/page.tsx:70` · `hub/app/global-error.tsx:44-45` · `hub/app/error.tsx:20` · `mobile/src/screens/AdhocReportScreen.tsx:25`
- **Regla:** smart-estados-ux · empty-states.md · 4 (Error → Retry) y 2 (Tono)
- **Hoy:** muestra "Error al cargar" con el `{error}` crudo y ningún botón.
- **Arreglo:** un solo componente de error con copy de producto y un botón Reintentar (`refetch`). El detalle técnico, si hace falta, en un `<details>`.
- **Estado:** pendiente

### SX-024 · media · Después de guardar, el refetch reemplaza la página por "Cargando…"
- **Dónde:** `hub/app/lib/hooks/useSupabaseQuery.ts:17` · `tareas/page.tsx:173-180` · `tiendas/[storeId]/page.tsx:98`
- **Regla:** smart-estados-ux · carga.md · 5 (bajo 300ms, el destello "se lee como un bug")
- **Hoy:** al completar una tarea, la lista se desmonta y se pierden el scroll y la tarjeta abierta.
- **Arreglo:** condicionar el cargador a `loading && !data`, como ya hacen `productos`, `vendedores` y `mercaderistas`.
- **Estado:** pendiente

### SX-025 · media · Los cargadores no respetan la duración ni la forma
- **Dónde:** en el hub, un "Cargando…" centrado en `tareas/page.tsx:175`, `ClientesTable.tsx:26`, `RestocksPanel.tsx:27`, `productos/page.tsx:60`, `vendedores/page.tsx:65`, `mercaderistas/page.tsx:61`, `mercaderistas/[id]/page.tsx:71`, `tiendas/[storeId]/page.tsx:99` y `configuracion/layout.tsx:27`, y el spinner inmediato de `hub/app/page.tsx:116` · en móvil, `RouteScreen.tsx:89-90`, `VisitHistoryScreen.tsx:43,66-69` (spinner en cada focus para leer SQLite), `navigation/AppNavigator.tsx:24-27` y `components/Button.tsx:24`
- **Regla:** smart-estados-ux · carga.md · 1 (Skeleton cuando conoces la forma), 2 y 5 (nada bajo 300ms) · smart-motion-ux · por-componente.md · Carga
- **Hoy:** ningún indicador tiene retraso, y las listas de forma conocida usan texto o spinner en vez de skeleton.
- **Arreglo:** skeletons con la silueta de filas y tarjetas que aparezcan después de ~300ms. En los re-focus del historial, no mostrar indicador si ya hay datos.
- **Estado:** pendiente

### SX-026 · media · Los vacíos no distinguen "sin datos", "filtrado" y "todo al día"
- **Dónde:** `tareas/page.tsx:182-187` · `ClientesTable.tsx:28-34` · `clientes/page.tsx:81-85` · `configuracion/productos/page.tsx:91-92` · `configuracion/vendedores/page.tsx:225-226` · `RestockFormModal.tsx:111-112` · `MapFilterSidebar.tsx:126` · `mobile/src/components/ProductPickerSheet.tsx:81,270` · `StorePickerSheet.tsx:62,149-151`
- **Regla:** smart-estados-ux · empty-states.md · 4 (cuatro tipos de vacío) y 3 (Acción primaria obligatoria) · smart-formularios-ux · busqueda.md · 5 (Cero resultados)
- **Hoy:** el mismo texto sirve para situaciones distintas, y el vacío no tiene salida.
- **Arreglo:** para lo filtrado, "Ocultas por los filtros · N no coinciden [Quitar filtros]". Sin abiertas, "Todo al día [Ver completadas]". En búsquedas, "[Limpiar búsqueda]". En vendedores, separar "sin cadenas" de "todas tienen vendedor".
- **Estado:** pendiente

### SX-027 · media · decide · El banner de sync dice "Sin conexión" cuando el que rechaza es el servidor
- **Dónde:** `mobile/src/context/SyncContext.tsx:31` → `mobile/src/sync/bannerState.ts:37-38`
- **Regla:** smart-estados-ux · notificaciones.md · 3 (Banner) y SKILL.md (honesta sobre lo que falta)
- **Hoy:** cualquier fallo, ya sea RLS, FK o un payload inválido, se muestra como "Sin conexión · N en cola", para siempre y sin forma de reintentar.
- **Arreglo:** distinguir un fallo de red de un rechazo ("N registros no se pudieron subir · Reintentar" con `flushNow`).
- **Pregunta:** ante un rechazo permanente, ¿el promotor avisa al supervisor, o la app lo reporta o lo descarta sola?
- **Estado:** pendiente

### SX-028 · media · Las confirmaciones de borrado son genéricas y tienen el volumen equivocado
- **Dónde:** `tiendas/[storeId]/page.tsx:92` (`confirm` nativo que no dice qué reposición) · `configuracion/productos/page.tsx:55` (`confirm` para desactivar, que es reversible) · `ContactFormModal.tsx:303-307` ("¿Confirmar eliminación?", y cierra sin esperar el resultado)
- **Regla:** smart-estados-ux · acciones-destructivas.md · 2 (Nombra la acción) y Escalera de fricción · optimistic-ui.md · 5
- **Hoy:** son diálogos que se confirman por reflejo, y el contacto se da por borrado antes de que el servidor lo confirme.
- **Arreglo:** un diálogo propio "¿Eliminar la reposición del 12 sept (3 productos)? [Conservar] [Eliminar reposición]". Para el contacto, "Eliminar a {nombre}" esperando el resultado. Desactivar un producto sin confirm, con "Desactivado · Deshacer".
- **Estado:** pendiente

### SX-029 · media · Selects largos sin búsqueda y listas de 190+ filas sin virtualizar
- **Dónde:** `TaskFilters.tsx:60,66` · `ClientesFilters.tsx:37` · `GeoFilters.tsx:21-29` (sobre `Select.tsx:75`) · `mobile/src/components/StorePickerSheet.tsx:134` · `ProductPickerSheet.tsx:246`
- **Regla:** smart-formularios-ux · dropdown.md · 4 (más de 10 → búsqueda; más de 100 → virtualizar)
- **Hoy:** el Select del hub no tiene filtro. Los sheets móviles renderizan todas las filas en un `ScrollView`.
- **Arreglo:** un input de filtro en el Select cuando `options.length > 10`, y `FlatList` en los sheets.
- **Estado:** pendiente

### SX-030 · media · El menú del Select no voltea en el borde y el sidebar del mapa lo recorta
- **Dónde:** `Select.tsx:68` · `MultiSelect.tsx:63` · `MapFilterSidebar.tsx:52` · `configuracion/vendedores/page.tsx:237`
- **Regla:** smart-formularios-ux · dropdown.md · 2 (Voltear en el borde)
- **Hoy:** siempre abre hacia abajo, y queda recortado por un contenedor con `overflowY: auto` o fuera de la ventana.
- **Arreglo:** medir con `getBoundingClientRect()` y abrir hacia arriba si no hay espacio. En el sidebar, renderizarlo en un portal.
- **Estado:** pendiente

### SX-031 · media · Validación a destiempo
- **Dónde:** `StoreFormModal.tsx:88,191-195,223` · `ContactFormModal.tsx:75,125-127,170` · `RestockFormModal.tsx:51-52,139-141` · `hub/app/page.tsx:20-21,60-74` · `mobile/src/screens/LoginScreen.tsx:20-21,90-94`
- **Regla:** smart-formularios-ux · validacion.md · 1 (Al enviar, foco al primer error), 2 (En cada tecla, demasiado pronto), 3 (On blur) y 5 (Confirmar lo correcto)
- **Hoy:** las coordenadas se marcan en rojo mientras se escriben, Guardar queda deshabilitado sin decir por qué, email y teléfono no se validan, y el error de fecha aparece lejos del campo.
- **Arreglo:** validar on blur y revalidar en vivo después del primer error. El mensaje debajo del campo con cómo arreglarlo, un texto en vez del botón deshabilitado mudo, y el foco al primer inválido al enviar.
- **Estado:** pendiente

### SX-032 · media · El calendario de rango no se puede usar con teclado
- **Dónde:** `hub/app/components/mapa/DateRangeChips.tsx:59,61,73,94-101`
- **Regla:** smart-formularios-ux · date-picker.md · 4 (Teclado: escribir, moverse, validar)
- **Hoy:** Esc no cierra, no hay flechas ni PageUp/PageDown, y los chevrons no tienen `aria-label`.
- **Arreglo:** Esc cierra y devuelve el foco. Roving tabindex con flechas y PageUp/PageDown, `aria-label` en los chevrons, y dos `<input type="date">` arriba de la grilla.
- **Estado:** pendiente

### SX-033 · media · El rango se elige a ciegas y en un solo mes
- **Dónde:** `DateRangeChips.tsx:41-57,71`
- **Regla:** smart-formularios-ux · date-picker.md · 2 (Rango: hover y duración) y 3 (Dos meses)
- **Hoy:** no hay vista previa con hover, no se muestra la duración, y el calendario es de un solo mes de 252px.
- **Arreglo:** guardar `hoverDay` para pintar el rango en vista previa, mostrar "5 may → 18 may · 14 días", y dos meses en escritorio.
- **Estado:** pendiente

### SX-034 · media · Los targets del hub miden menos de 44px y no hay `@media (pointer: coarse)`
- **Dónde:** `hub/app/globals.css:612-623` (`.filter-chip`, ~28px, que también se usa como acción en `tiendas/[storeId]/page.tsx:123`, `ContactList.tsx:39` y `RestocksPanel.tsx:20`) · `(panel)/layout.tsx:96-116` (Salir) · `KpiCard.tsx:70-75` · `ContactList.tsx:67-68` · `RestocksPanel.tsx:59` · `EngagementsPanel.tsx:43-44` · `MapFilterSidebar.tsx:17,26,29,56-57` · `DateRangeChips.tsx:59,61,73-74` · `TimePeriodSelector.tsx:72-82` · `TaskSummary.tsx:10-13` · `MultiSelect.tsx:42-43` · `Select.tsx:51-57` (37px y sin `:hover`)
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 4 (Tap targets de 44px) y 2 (`pointer: coarse`) · smart-formularios-ux · dropdown.md · 1 (que se vea clicable)
- **Hoy:** en el teléfono del supervisor, los iconos de acción miden entre 12 y 28px.
- **Arreglo:** un bloque `@media (pointer: coarse)` con `min-height: 44px` que crezca el padding sin cambiar los iconos. Pasar a clases los botones con estilo inline. Añadir `:hover` al trigger del Select.
- **Estado:** pendiente

### SX-035 · media · Botones de la app móvil de menos de 44px y sin `hitSlop`
- **Dónde:** `CheckInScreen.tsx:199,246-252,554,590-594,626-627` · `CompetitionPanel.tsx:102,130-136,202,220-224` · `CompetitionTab.tsx:26-29` · `RouteModeToggle.tsx:46-49`
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 4 (Tap targets) y tabs.md · 4 (zona del pulgar)
- **Hoy:** "Quitar foto" es un círculo de 20px. Solo `StoreCard.tsx:53` usa `hitSlop`.
- **Arreglo:** `hitSlop={12}` o `minWidth/minHeight: 44` en volver, cerrar y quitar foto. Subir el padding del toggle. `CompetitionTab` a 44 de ancho.
- **Estado:** pendiente

### SX-036 · media · El hover se queda pegado en táctil
- **Dónde:** `hub/app/globals.css:170-173` (`.nav-item:hover` usa el mismo estilo que `.active`), `:211,232,470,516,625-628,1188,1237,1293,1302` · `configuracion/layout.tsx:54,60` · `TaskSummary.tsx:121` · `Select.tsx:90-91` (`onMouseEnter`)
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 1 (Sticky hover) y 2 (Media query)
- **Hoy:** después de tocar, parece que hay dos ítems activos en la barra inferior.
- **Arreglo:** envolver todos los `:hover` en `@media (hover: hover)`, separar el estilo `.nav-item:hover` de `.active`, y pasar el Select a CSS.
- **Estado:** pendiente

### SX-037 · media · Texto recortado que solo se lee entero con `title`
- **Dónde:** `RestocksPanel.tsx:46,49` (la nota de la reposición no tiene otra vista) · `configuracion/productos/page.tsx:106` · `MapFilterSidebar.tsx:77,79,112,120` · `TaskSummary.tsx:109` · `mercaderistas/page.tsx:95` · `mercaderistas/[id]/page.tsx:63` ("Actualizar la app") · `ClientesTable.tsx:77`
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 3 (Contenido escondido detrás de hover)
- **Hoy:** en el teléfono, el `title` nunca aparece.
- **Arreglo:** que la fila de la reposición se expanda o tenga "ver más", y mostrar un badge visible "Actualizar" para la versión desactualizada.
- **Estado:** pendiente

### SX-038 · media · El campo "Línea" solo parece editable con hover
- **Dónde:** `hub/app/(panel)/panel/configuracion/layout.tsx:62-64` · `configuracion/productos/page.tsx:111-112`
- **Regla:** smart-navegacion-ux · touch-y-hover.md · 3 (el hover revela extras, nunca la acción primaria)
- **Hoy:** en táctil se ve como texto gris "Sin línea".
- **Arreglo:** dentro de `@media (hover: none)`, mostrar siempre el borde y el fondo del input.
- **Estado:** pendiente

### SX-039 · media · Las pestañas de la tienda se desbordan en el teléfono
- **Dónde:** `hub/app/(panel)/panel/tiendas/[storeId]/page.tsx:143-163`
- **Regla:** smart-navegacion-ux · tabs.md · 2 (Overflow)
- **Hoy:** con los badges, la tira necesita ~370px y en un teléfono de 360px hay unos 314 útiles, así que la página hace scroll horizontal.
- **Arreglo:** en el teléfono, solo el ícono con su badge, o `min-width:0` con ellipsis, o scroll horizontal con fades en los bordes.
- **Estado:** pendiente

### SX-040 · media · La barra de pestañas de la app tiene alto fijo con edge-to-edge activo
- **Dónde:** `mobile/src/navigation/MainTabs.tsx:38-44` · `mobile/app.json:25`
- **Regla:** smart-navegacion-ux · tabs.md · 4 (targets y zona del pulgar)
- **Hoy:** `height: 60, paddingBottom: 8` anulan el área segura, así que la barra del sistema puede tapar las pestañas. No está verificado en un dispositivo.
- **Arreglo:** usar `useSafeAreaInsets()` (`60 + insets.bottom`) o quitar los dos overrides.
- **Estado:** pendiente

### SX-041 · media · decide · "Cerrar sesión" en la app no pide confirmación
- **Dónde:** `mobile/src/screens/ProfileScreen.tsx:87-92` · `mobile/src/context/AuthContext.tsx:75-82`
- **Regla:** smart-navegacion-ux · settings.md · 5 (Danger zone: la fricción escala con la severidad)
- **Hoy:** con un toque se cierra la sesión, y sin señal no se puede volver a entrar.
- **Arreglo:** un `Alert.alert` que avise si hay datos sin sincronizar o si no hay conexión.
- **Pregunta:** ¿hay que impedir cerrar sesión con datos pendientes, o basta con avisar?
- **Estado:** pendiente

### SX-042 · media · El breakpoint de las tablas depende del viewport y no del contenedor
- **Dónde:** `hub/app/globals.css:1261-1279` con `:1080-1093` · `ClientesTable.tsx:22,39` · `RestocksPanel.tsx:6`
- **Regla:** smart-tablas-ux · movil.md · 6 (Breakpoint: container query)
- **Hoy:** entre 601 y 1023px se ve una grilla de 6 columnas dentro de un contenedor de 600px.
- **Arreglo:** `container-type: inline-size` en el wrapper y `@container (max-width: 700px)`.
- **Estado:** pendiente

### SX-043 · media · Las `<table>` del hub no tienen forma móvil ni identidad fija
- **Dónde:** `mercaderistas/page.tsx:188-228` · `configuracion/productos/page.tsx:79-127` (la primera columna es el SKU) · `configuracion/vendedores/page.tsx:214-251`
- **Regla:** smart-tablas-ux · movil.md · 1-2 · escritorio.md · 4 (Sticky `left:0`)
- **Hoy:** hay scroll horizontal y al desplazarse se pierde de quién es la fila. Vendedores se desborda.
- **Arreglo:** la columna de nombre con `position:sticky; left:0` (el patrón de `TaskSummary.tsx:17`). Lo ideal es dos líneas por debajo de 700px.
- **Estado:** pendiente

### SX-044 · media · En el resumen de Tareas, el cero se muestra como guion
- **Dónde:** `hub/app/components/tareas/TaskSummary.tsx:20,44`
- **Regla:** smart-tablas-ux · escritorio.md · 5 (Cero es cero)
- **Hoy:** con `n === 0` se muestra "—", igual que un dato faltante.
- **Arreglo:** mostrar `0` en color muted.
- **Estado:** pendiente

### SX-045 · media · El header sticky de Productos no se queda fijo
- **Dónde:** `configuracion/productos/page.tsx:79` con `configuracion/layout.tsx:56`
- **Regla:** smart-tablas-ux · escritorio.md · 4 (Sticky)
- **Hoy:** el card tiene `overflow:auto` sin alto máximo y nunca hace scroll, así que el header se va con la página.
- **Arreglo:** darle al card un `maxHeight: 60vh`, o quitarle el overflow.
- **Estado:** pendiente

### SX-046 · media · Al volver del detalle de una tienda se pierde la posición en la lista
- **Dónde:** `ClientesTable.tsx:39,50` · `clientes/page.tsx:181`
- **Regla:** smart-tablas-ux · paginacion.md · 4 (Volver desde el detalle)
- **Hoy:** el scroll interno de unas 197 tiendas vuelve arriba.
- **Arreglo:** guardar `scrollTop` y `store_id` en sessionStorage, restaurarlos al volver y resaltar la fila.
- **Estado:** pendiente

### SX-047 · media · Nada respeta `prefers-reduced-motion`
- **Dónde:** `hub/app/components/PageTransition.tsx:25-27` · `hub/app/globals.css:1308-1309` (`.merch-pulse` infinito) · `StoreFormModal.tsx:139` · `RestockFormModal.tsx:74` · `ContactFormModal.tsx:104` · `mobile/src/components/CompetitionPanel.tsx:71-75` · `animationType="slide"` en `BottomSheetSelect.tsx:27`, `BottomSheetMultiSelect.tsx:36`, `ProductPickerSheet.tsx:39`, `StorePickerSheet.tsx:28` y `CameraModal.tsx:80`
- **Regla:** smart-motion-ux · SKILL.md · Flujo 4 (respeta `prefers-reduced-motion`)
- **Hoy:** no hay ninguna referencia a la preferencia en el hub ni en la app.
- **Arreglo:** un bloque `@media (prefers-reduced-motion: reduce)` y `<MotionConfig reducedMotion="user">` en el layout. En móvil, `AccessibilityInfo.isReduceMotionEnabled()` → `animationType="fade"` y `duration: 0`.
- **Estado:** pendiente

### SX-048 · media · Los modales del hub entran por debajo del rango y salen igual de lentos que entran
- **Dónde:** `StoreFormModal.tsx:130,140` · `RestockFormModal.tsx:65,75` · `ContactFormModal.tsx:95,105`
- **Regla:** smart-motion-ux · SKILL.md · 1 (Entrada 200-300ms) y 2 (Salida más rápida)
- **Hoy:** la tarjeta dura 180ms al entrar y al salir, y el overlay 150ms en los dos sentidos.
- **Arreglo:** la tarjeta entra en 250ms ease-out y sale en 150ms ease-in (con `transition` dentro de `exit`). El overlay en 200 y 150ms.
- **Estado:** pendiente

### SX-049 · media · El panel de Competencia (móvil) sale a la misma velocidad que entra
- **Dónde:** `mobile/src/components/CompetitionPanel.tsx:71-75`
- **Regla:** smart-motion-ux · SKILL.md · 2 (Salida más rápida que la entrada)
- **Hoy:** 240ms en los dos sentidos, con easeInOut.
- **Arreglo:** `duration: visible ? 250 : 160`, con `Easing.out`/`Easing.in` de cubic.
- **Estado:** pendiente

### SX-050 · media · decide · El feedback de hover y press tarda 200ms
- **Dónde:** `hub/app/globals.css:163,227,334-339,622,845,1185,1234` · chevrons a 150ms en `Select.tsx:60`, `ActivityFeed.tsx:119`, `CompetitionReportsPanel.tsx:59`, `tareas/page.tsx:222` y `mercaderistas/[id]/page.tsx:123`
- **Regla:** smart-motion-ux · SKILL.md · 3 (Feedback bajo 100ms) y por-componente.md
- **Hoy:** la respuesta a un toque tarda entre 120 y 200ms.
- **Arreglo:** un token `--duration-fast: 80ms` para `:hover`/`:active` y los chevrons.
- **Pregunta:** ¿`--duration: 200ms` es la duración única decidida para el hub, o se acepta un segundo token de feedback?
- **Estado:** pendiente

### SX-051 · baja · El historial repite el verde en cada tarjeta y muestra coordenadas crudas
- **Dónde:** `mobile/src/screens/VisitHistoryScreen.tsx:87-103`
- **Regla:** smart-visual-ux · SKILL.md · Tell 5 (el badge se gana marcando la excepción)
- **Hoy:** cada tarjeta lleva dos verdes y lat/lng con 4 decimales.
- **Arreglo:** mostrar solo "Pendiente sync" y cambiar las coordenadas por "verificada / fuera de radio", o quitarlas.
- **Estado:** pendiente

### SX-052 · baja · Sombras en elementos que viven en el flujo
- **Dónde:** `hub/app/globals.css:353,358,748,781,786` · `mobile/src/components/StoreCard.tsx:72-76` · `LoginScreen.tsx:126-130,158-162` · `ProfileScreen.tsx:135-139`
- **Regla:** smart-visual-ux · SKILL.md · Tell 4 (sombra solo en lo que se abre encima de la página)
- **Hoy:** llevan sombra y hairline a la vez. En `vendedores/page.tsx:108` la sombra ya se anula inline.
- **Arreglo:** quitar la sombra y dejar el hairline `--border`.
- **Estado:** pendiente

### SX-053 · baja · El badge dice "Saltado" y el resto del sistema dice "Omitido"
- **Dónde:** `mobile/src/components/StatusBadge.tsx:9`
- **Regla:** smart-visual-ux · SKILL.md · Tell 5 (copy)
- **Hoy:** el badge muestra "Saltado", mientras el hub y el propio check-in dicen "Omitido".
- **Arreglo:** cambiar la etiqueta a "Omitido".
- **Estado:** pendiente

### SX-054 · baja · Radios fuera de la escala y un anidado no concéntrico
- **Dónde:** `TimePeriodSelector.tsx:78,93` · `MultiSelect.tsx:39` · `DateRangeChips.tsx:75` · `globals.css:1299` · `mobile/src/components/RouteModeToggle.tsx:43,48`
- **Regla:** smart-visual-ux · radius.md · 1 (sin números sueltos) y 2 (interior = exterior − padding)
- **Hoy:** hay radios de 6, 7 y 10px. En el toggle, el segmento tiene 8 dentro de un contenedor de 14 con padding 3.
- **Arreglo:** usar `var(--radius-sm)`, y en el segmento del toggle `radii.md - 4`.
- **Estado:** pendiente

### SX-055 · baja · Tile de icono decorativo en la cabecera de la tienda
- **Dónde:** `hub/app/(panel)/panel/tiendas/[storeId]/page.tsx:116`
- **Regla:** smart-visual-ux · SKILL.md · Tell 2 (el icono solo si sustituye palabras)
- **Hoy:** un cuadro de 48px con `--accent-glow` y el icono Building2 al lado del nombre, que no agrega información.
- **Arreglo:** quitar el tile.
- **Estado:** pendiente

### SX-056 · baja · decide · Tareas dibuja todas las tarjetas y pagina por offset
- **Dónde:** `tareas/page.tsx:190` · `hub/app/lib/queries/tasks.ts:79-92` · `paginate.ts:3-12`
- **Regla:** smart-tablas-ux · paginacion.md · 2 (El patrón según el trabajo) y 1 (Cursor, no offset)
- **Hoy:** con "Todas", puede pintar más de 1000 tarjetas, y el offset puede duplicar o saltar tareas.
- **Arreglo:** "Cargar más" de 50 en 50 y un cursor `(created_at, task_id)`.
- **Pregunta:** ¿cuántas tareas llega a ver un supervisor con "Todas"?
- **Estado:** pendiente

### SX-057 · baja · La tabla de Mercaderistas no indica su orden
- **Dónde:** `mercaderistas/page.tsx:169,197`
- **Regla:** smart-tablas-ux · escritorio.md · 6 (flecha de orden en la columna activa)
- **Hoy:** la tabla está ordenada por cumplimiento, pero ninguna cabecera lo indica.
- **Arreglo:** una flecha ↑ en "Cumplimiento".
- **Estado:** pendiente

### SX-058 · baja · En Mercaderistas, "cargando" se ve igual que "sin dato"
- **Dónde:** `mercaderistas/page.tsx:212-214,223`
- **Regla:** smart-tablas-ux · escritorio.md · 5 (Cargando tiene su propia forma)
- **Hoy:** mientras cargan, Anomalías y App muestran `–`, el mismo símbolo que "Sin rutas".
- **Arreglo:** un skeleton pequeño en la celda.
- **Estado:** pendiente

### SX-059 · baja · Texto largo que no se trunca
- **Dónde:** `configuracion/vendedores/page.tsx:234` · `mercaderistas/[id]/page.tsx:135-137`
- **Regla:** smart-tablas-ux · escritorio.md · 5 (Texto largo: ellipsis)
- **Hoy:** un nombre largo ensancha la columna o duplica la altura de la fila.
- **Arreglo:** ellipsis con `max-width`, como en `productos/page.tsx:106`.
- **Estado:** pendiente

### SX-060 · baja · En Productos, la búsqueda y el filtro no quedan en la URL
- **Dónde:** `configuracion/productos/page.tsx:18-19`
- **Regla:** smart-tablas-ux · paginacion.md · 5 (El estado vive en la URL)
- **Hoy:** `q` y "Sin línea" viven en `useState` y se pierden al refrescar o compartir el link.
- **Arreglo:** usar `?q=&filtro=sin_linea` con `router.replace`, como ya hace Vendedores.
- **Estado:** pendiente

### SX-061 · baja · La papelera de Reposiciones está siempre visible
- **Dónde:** `RestocksPanel.tsx:54-62`
- **Regla:** smart-tablas-ux · escritorio.md · 6 (Acciones reveladas)
- **Hoy:** la papelera se ve en todas las filas editables.
- **Arreglo:** que aparezca con hover o `:focus-within` de la fila, y que siga siempre visible en táctil (`@media (hover:none)`).
- **Estado:** pendiente

### SX-062 · baja · decide · Ninguna tabla tiene toggle de densidad
- **Dónde:** `configuracion/layout.tsx:58` · `mercaderistas/page.tsx:206-215` · `globals.css:1279`
- **Regla:** smart-tablas-ux · escritorio.md · 3 (Densidad)
- **Hoy:** cada tabla tiene una sola altura de fila.
- **Arreglo:** un toggle Compact/Default/Comfortable (40/48/56px) en Tiendas y Productos.
- **Pregunta:** ¿algún supervisor procesa volumen (cientos de productos) como para justificarlo?
- **Estado:** pendiente

### SX-063 · baja · Anatomía y transición del switch "Sucursal activa"
- **Dónde:** `StoreFormModal.tsx:205-212`
- **Regla:** smart-formularios-ux · toggle.md · 1 (Anatomía) y 2 (Transición)
- **Hoy:** un riel de 32px con un knob de 12px que salta de lado con `justifyContent`.
- **Arreglo:** riel de 2× el knob, padding igual al radio, y `translateX` con la curva `var(--duration) var(--ease)`.
- **Estado:** pendiente

### SX-064 · baja · El MultiSelect abre de golpe
- **Dónde:** `MultiSelect.tsx:61`
- **Regla:** smart-formularios-ux · dropdown.md · 5 (Abrir en menos de 150ms)
- **Hoy:** aparece en 0ms, mientras el Select anima en 150ms.
- **Arreglo:** reusar el `motion.div` del Select.
- **Estado:** pendiente

### SX-065 · baja · decide · Presets de fecha distintos en cada pantalla (y un bug de UTC)
- **Dónde:** `DateRangeChips.tsx:12-17,109-113,126` · `TimePeriodSelector.tsx:9-14,25-31` · `TaskFilters.tsx:71-79` · `RestockFormModal.tsx:93` · `mobile/src/screens/CheckInScreen.tsx:355`
- **Regla:** smart-formularios-ux · date-picker.md · 1 (Presets del dominio, con el rango visible en el chip)
- **Hoy:** cada filtro trae sus propios presets. "Últimos 7 días" usa UTC y cuenta 8 días.
- **Arreglo:** un solo set compartido con la lógica local de `rangoDeDias`, el rango visible en el chip activo, y atajos Hoy/Ayer en las fechas únicas.
- **Pregunta:** ¿qué rangos consulta de verdad el supervisor? ¿La reposición suele registrarse hoy o ayer?
- **Estado:** pendiente

### SX-066 · baja · decide · Formularios largos en una sola pantalla
- **Dónde:** `StoreFormModal.tsx:157-217` · `mobile/src/screens/CheckInScreen.tsx:213-444`
- **Regla:** smart-formularios-ux · wizard.md · 1 (Chunking)
- **Hoy:** son 10 campos en StoreFormModal y hasta 9 secciones en el check-in, aunque ya están agrupados por contexto.
- **Arreglo:** partir el CheckIn en Evidencia → Estado → Extras, pero solo si hay abandono.
- **Pregunta:** ¿hay evidencia de que el mercaderista se salta campos por lo largo del check-in?
- **Estado:** pendiente

### SX-067 · baja · decide · Búsqueda con placeholder vago y sin recientes
- **Dónde:** `mobile/src/components/StorePickerSheet.tsx:112,127,134`
- **Regla:** smart-formularios-ux · busqueda.md · 1 (Placeholder) y 2 (Recientes)
- **Hoy:** el placeholder dice "Buscar tienda…", pero también filtra por dirección.
- **Arreglo:** cambiarlo a "Buscar por nombre o dirección" y mostrar las últimas tiendas reportadas.
- **Pregunta:** ¿el mercaderista repite las mismas tiendas fuera de ruta?
- **Estado:** pendiente

### SX-068 · baja · La nota de cierre corta a 1000 caracteres sin avisar
- **Dónde:** `TaskResolutionNote.tsx:334`
- **Regla:** smart-formularios-ux · validacion.md · 2 (contador de caracteres)
- **Hoy:** `maxLength={1000}` corta el texto en silencio.
- **Arreglo:** un contador "n/1000" visible desde los ~800 caracteres.
- **Estado:** pendiente

### SX-069 · baja · Quitar una foto o una tienda de un toque, sin deshacer
- **Dónde:** `CheckInScreen.tsx:247-248` · `CompetitionPanel.tsx:131-132` · `StoreCard.tsx:52-54` → `RouteContext.tsx:367-373`
- **Regla:** smart-estados-ux · acciones-destructivas.md · Escalera de fricción (Undo en toast)
- **Hoy:** la foto o la tienda desaparecen sin aviso ni forma de recuperarlas.
- **Arreglo:** un aviso "Foto eliminada · Deshacer" o "Tienda quitada · Deshacer".
- **Estado:** pendiente

### SX-070 · baja · El tooltip de los KPI no sigue sus reglas
- **Dónde:** `KpiCard.tsx:52,78-95` · `hub/app/lib/dashboard-kpis.ts:14-36`
- **Regla:** smart-estados-ux · tooltips.md · 1 (300ms), 2 (Flecha), 4 (tap fuera) y 5 (Corto)
- **Hoy:** abre al instante, no tiene flecha ni cierra al tocar fuera, y el texto es un párrafo. El de "tareas" no coincide con lo que muestra la tarjeta.
- **Arreglo:** un retraso de 300ms en hover, una flecha, cerrar al tocar fuera, una frase por KPI, y corregir el copy de "tareas".
- **Estado:** pendiente

### SX-071 · baja · Vacíos de primer uso sin acción
- **Dónde:** `ContactList.tsx:44` · `CumplimientoChart.tsx:29` · `TasksProgress.tsx:38` · `TiendasCriticas.tsx:15` · `VisitasPorCliente.tsx:21` · `AnomaliasPorTipo.tsx:47` · `mobile/src/screens/VisitHistoryScreen.tsx:115-118`
- **Regla:** smart-estados-ux · empty-states.md · 3 (Acción primaria obligatoria)
- **Hoy:** solo hay una línea gris.
- **Arreglo:** "Agregar el primer contacto", "Ir a mi ruta", y "Probá con otro período" en los widgets.
- **Estado:** pendiente

### SX-072 · baja · En las pestañas de la tienda, el contenido cambia de golpe y la altura salta
- **Dónde:** `tiendas/[storeId]/page.tsx:166-178`
- **Regla:** smart-navegacion-ux · tabs.md · 5 (Contenido: fade, y la altura se interpola)
- **Hoy:** es un render condicional sin transición, y el panel de abajo se mueve.
- **Arreglo:** usar el `AnimatePresence` con fade del mapa y una altura mínima común.
- **Estado:** pendiente

### SX-073 · baja · Pestañas de Configuración: el indicador salta y miden 36px
- **Dónde:** `configuracion/layout.tsx:41-45`
- **Regla:** smart-navegacion-ux · tabs.md · 1 (Indicador que se desliza) y 4 (≥44px)
- **Hoy:** el `borderBottom` pasa de un link a otro sin transición, y cada pestaña mide unos 36px de alto.
- **Arreglo:** un indicador compartido con `layoutId` y padding de `12px 0`.
- **Estado:** pendiente

### SX-074 · baja · Las entradas usan ease-in-out en vez de ease-out
- **Dónde:** `PageTransition.tsx:27` · `globals.css:1021`
- **Regla:** smart-motion-ux · SKILL.md · Flujo 5 (entradas con ease-out)
- **Hoy:** usan el token `--ease`, que es ease-in-out.
- **Arreglo:** un token `--ease-out: cubic-bezier(0,0,0.2,1)` solo para las entradas.
- **Estado:** pendiente

### SX-075 · baja · El cambio de pestaña del mapa no sigue el patrón de tabs
- **Dónde:** `mapa/page.tsx:165-167`
- **Regla:** smart-motion-ux · por-componente.md · Tabs (180ms ease-out y pausa de 80ms)
- **Hoy:** 200ms al salir más 200ms al entrar, sin pausa.
- **Arreglo:** `duration: 0.18, ease: "easeOut"` con `delay: 0.08` al entrar.
- **Estado:** pendiente

### SX-076 · baja · decide · El pulso infinito de los mercaderistas en el mapa
- **Dónde:** `globals.css:1308-1309` · `MerchandiserMarkersLayer.tsx:12`
- **Regla:** smart-motion-ux · SKILL.md · 4 (Atención: usar poco)
- **Hoy:** todos los mercaderistas activos pulsan sin parar cada 1.6s.
- **Arreglo:** un aro estático o 3 iteraciones, y reservar el pulso para alertas.
- **Pregunta:** ¿el pulso significa "está activo" o "mírame"?
- **Estado:** pendiente

### SX-077 · baja · El relleno de la barra de cumplimiento dura 400ms
- **Dónde:** `globals.css:956`
- **Regla:** smart-motion-ux · SKILL.md · 1 (Entrada 200-300ms)
- **Hoy:** la transición de `width` dura 400ms.
- **Arreglo:** 250ms ease-out.
- **Estado:** pendiente

## Sin hallazgo
- smart-visual-ux · Tell 3 (jerarquía): el KPI primario de `/panel` en 2fr/1fr a 44px, `TaskSummary` y `mercaderistas/[id]` con una cifra primaria de 40px, y un solo CTA en RouteScreen.
- smart-visual-ux · Tell 1-2: no hay gradientes decorativos (el heatmap codifica densidad), y los KpiCard no tienen tiles de color.
- smart-visual-ux · Tell 5: `tabular-nums` y el periodo nombrado en el subtítulo del panel.
- smart-visual-ux · radius.md 3-6: `.dash-focus`, píldoras solo en badges, sheets redondeados solo arriba y el mapa recortado por su contenedor.
- smart-tablas-ux · escritorio 1-2: números a la derecha con `tabular-nums`, hairline, hover y sin zebra (`mz-table`, `.cfg-table`, `.contactos-table-row`).
- smart-tablas-ux · escritorio 4-6: header sticky en `ClientesTable.tsx:42`, identidad fija en `TaskSummary.tsx:17`, input inline que se ve con hover o focus, y "Guardar" solo en filas sucias.
- smart-tablas-ux · movil 1-3, 5: Clientes, Tareas y StoreCard en dos líneas, y Tareas y el día a día del mercaderista se expanden en el lugar.
- smart-tablas-ux · paginacion 5: el estado vive en la URL en Tiendas, Clientes, Tareas, Vendedores y el periodo de Mercaderistas.
- smart-formularios-ux · validacion 3/5: la Línea de Productos guarda on blur y confirma "Guardado". El CheckIn dice por qué está bloqueado (`CheckInScreen.tsx:446-461`).
- smart-formularios-ux · date-picker 2/4/5: TimePeriodSelector muestra "N días", TaskFilters usa `date` nativos con min/max cruzados, y en móvil se usa el diálogo nativo con `maximumDate`.
- smart-formularios-ux · dropdown 5: el Select anima en 150ms.
- smart-estados-ux · carga 2: hay spinner dentro del botón en el login hub y el móvil, Vendedores, TaskResolutionNote, RestockFormModal, AdhocReport, CheckIn y CameraModal.
- smart-estados-ux · empty-states 4: `RouteScreen.tsx:97-110` tiene un error con Reintentar, y `tareas/page.tsx:157-161` explica el filtro con "Limpiar filtros".
- smart-estados-ux · optimistic 3: `RouteContext.tsx:270-316` guarda en SQLite antes de actualizar la UI.
- smart-estados-ux · upload 3-5: `photoUpload.ts:26-30` retoma sin empezar de cero, `syncEngine.ts:188-206` sube por registro, y hay preview en CheckIn y CameraModal.
- smart-estados-ux · notificaciones 1/3: SyncBanner y el banner de caché persisten mientras dura la condición.
- smart-navegacion-ux · touch-y-hover 3: el tooltip de KPI abre con toque, hover y foco.
- smart-navegacion-ux · tabs 4: la barra de la app móvil tiene 3-4 ítems.
- smart-navegacion-ux · tabs 5: el mapa hace fade entre sus pestañas.
- smart-navegacion-ux · settings 1-5: Configuración está agrupada por tarea, con guardado instantáneo o explícito y confirmación al desactivar o borrar.
- smart-navegacion-ux · calendario-semanal: no aplica.
- smart-motion-ux · 1: PageTransition (260ms) y la entrada de CompetitionPanel (240ms) están en rango. No hay stagger, y los spinners son correctos para esperas cortas.

## Decisiones del proyecto respetadas
- La escala de radios es 8/14/20/28 (`globals.css:41-44`, `theme.ts`) en lugar de 4/8/12/16.
- El acento único es navy `#00205C`, la tipografía es Inter en el hub y el móvil, y los tokens de estado van con fondos al 8%.
- `--duration: 200ms` y `--ease` (ease-in-out) son los tokens únicos de motion. Los arreglos los usan, y el único cuestionamiento es SX-050, marcado decide.
- El layout es una barra inferior por debajo de 1024px, un sidebar desde 1024px y una columna de 600px en tablet.
- Las pestañas de Configuración son links con `aria-current`, no un tablist.
- El check-in es optimista offline-first: se cierra sin esperar la red. Solo se señala la falta de aviso cuando falla (SX-004).
- "Todo sincronizado" es un banner verde persistente, por decisión explícita en `bannerState.ts:52`.
- No hay sistema de toasts: la confirmación se muestra en línea ("Guardado" con `role="status"`) y los errores en línea con `role="alert"`.
- La subida de fotos va en segundo plano y muestra un conteo, no un porcentaje.
- La regla propia "el color es para la excepción" se aplica en `mercaderistas/[id]/page.tsx:140` y se toma como criterio del proyecto.
- Las fechas van en formato ISO `en-CA`, y el umbral de cumplimiento (≥90 / ≥70) se comparte entre los gráficos y las tablas.
- En móvil, los selects son bottom sheets y las listas son tarjetas. El trigger fantasma del MultiSelect de Vendedores y la altura compacta de 37px de los filtros del hub también son decisiones del proyecto.
- El long-press sobre la versión que abre DebugLog es un acceso escondido a propósito.
- CSS muerto (`.modal-sheet`, `.logo-dot`, `.gps-dot`, `.progress-bar-fill`, etc.): no afecta al usuario, se puede borrar.

## Nuevos (sin auditar)
Vistos al aplicar `alta` (2026-09-29). No se tocaron.
- `hub/app/(panel)/layout.tsx` y `hub/app/(panel)/panel/mapa/page.tsx` duplican el código del bottom sheet → extraer `components/ui/BottomSheet.tsx`.
- `Segmented` no asocia pestañas con paneles (`aria-controls` / `role="tabpanel"`).
- Los modales del hub no atrapan el foco ni lo devuelven al disparador al cerrar.
- `useSupabaseQuery` no vuelve `data` a null al cambiar deps: al cambiar de período se ven los datos viejos sin señal de "desactualizado". Además convierte errores de Supabase no-`Error` en un genérico.
- En la vista de teléfono de Tiendas se perdió el punto de color del estado de la última visita.
- `mercaderistas/[id]`: fallos de `fetchUserName`/`fetchVersiones` siguen sin aviso.
- La altura del mapa (`calc(100vh - 140px)`) no descuenta la barra inferior en el teléfono.
- Móvil: `Button` en loading se ve al 45% de opacidad (parece deshabilitado); la X de cerrar de `CameraModal` no tiene accessibilityLabel; tiendas fuera de ruta sin nombre en el Historial (no hay caché de todas las tiendas).
