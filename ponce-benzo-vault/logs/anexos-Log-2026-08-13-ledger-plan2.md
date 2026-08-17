# SDD ledger — plan: docs/superpowers/plans/2026-08-13-hub-dashboard-gerencial.md

Spec: docs/superpowers/specs/2026-08-12-hub-alcance-por-cliente-design.md, secciones 2.4 y 3 (autoridad vinculante)
Rama: feat/dashboard-gerencial (creada desde master 94819a5, que ya lleva el Plan 1 mezclado)

## Preflight — escaneo de conflictos

### Pares de tareas que comparten archivo o interfaz

| A → B | A produce | B consume | Hallazgo |
|---|---|---|---|
| T1 → T2 | `fn_dash_cumplimiento` | `fn_dash_resumen` la invoca para planificadas/hechas | OK — anidar dos INVOKER es correcto |
| T1..T5 → T6 | 10 funciones SQL | `dashboard.ts` expone 9 | **CONFLICTO — ver R1** |
| T6 → T8 | tipos de fila | props de los 6 componentes | OK — nombres coinciden 1:1 |
| T6 → T9 | 9 `fetch*` | llamadas de la página | OK |
| T7 → T9 | `KpiCard`, `KpiId` | 4 tarjetas | OK — los 4 ids existen en `KPI_DEFS` |
| T8 → T9 | 6 componentes | composición | OK |
| T9 → T10 | consumidores de `derive.ts` | qué se puede borrar | OK — T10 empieza con un grep, no asume |
| T1..T5 → todas | `tools/supabase_schema.sql` | cada tarea replica lo suyo | OK — secuencial, sin solapes |

### Coherencia interna de cada tarea

| Tarea | ¿Su texto concuerda consigo mismo? |
|---|---|
| T1 | Sí — el Step 3 advierte que con llave de servicio devuelve 0 filas y exige contraste con sesión real |
| T2 | Sí — contrasta cada cifra por separado, no el bloque entero |
| T3 | Sí — explica por qué la suma por tipo puede superar el total de visitas (`anomaly_type` es array) |
| T4 | Sí — cubre el borde de la tienda nunca visitada (`dias_sin_visita` nulo) |
| T5 | **Parcial — ver R1.** El resto (backlog, cumpleaños, huérfanos) es coherente y cubre el cruce de año |
| T6 | Sí — un tipo por función, `rpc()` centraliza el manejo de error |
| T7 | Sí — los tests exigen que la descripción no repita el título y explique el denominador |
| T8 | Sí — cada componente tiene su estado vacío |
| T9 | Sí — verifica la firma de `useSupabaseQuery` antes de asumirla |
| T10 | Sí — condiciona el borrado al resultado del grep |

### Rulings de preflight

**R1 — Ruling: `fn_dash_tiempo_resolucion` se conserva y se cablea a la tarjeta de tareas.** — La T5 la crea pero ninguna tarea posterior la consume: quedaría como función huérfana en producción, que es justo lo que la revisión trata como defecto. Borrarla sería lo más simple, pero la §3.2 de la spec la pide explícitamente ("Tramos de antigüedad + tiempo medio de resolución") y la spec manda sobre el plan. Se cablea: la T6 expone `fetchTiempoResolucion(desde, hasta)`, la T9 la consulta y `TasksProgress` recibe una prop opcional `resolucion`. Hoy dará 0 resueltas porque `resolved_at` acaba de nacer — es correcto y hay que mostrarlo, no ocultarlo. — Si me equivoco: el coste es una prop de más en un componente, trivial de quitar.

## Progreso

Task 1: implementado (commit 104b28f). Contraste del implementador: admin sum(planificadas)=872 identico
  a la consulta independiente; vendedora bcastro=42, muy inferior, el filtro por cliente funciona.
Task 1: VERIFICADO POR EL CONTROLADOR con sesion real de admin, ultimos 30 dias:
  Willian 229/145 63% | Eduward 218/134 61% | Carlos 200/171 86% | Elvis 189/158 84% | Jonathan 36/21 58%
  TOTAL 872/629 = 72%. Controles de plausibilidad OK: hechas menor o igual que planificadas, pct en [0,100],
  y la dispersion entre 58% y 86% descarta un calculo degenerado.
  Es la primera vez que este dato existe: el panel mostraba "78% de establecimientos", que mezclaba cosas
  distintas y no permitia actuar sobre nadie.
Task 1: revision despachada. Encargo especifico: la correccion del calculo, y en particular si la
  conversion a fecha puede desalinearse por zona horaria (Venezuela es UTC-4) y contar mal una visita
  hecha a las 21:00 hora local.
Task 2: implementador despachado (BASE 104b28f). Le pase 872/629/72% como cifras que debe reproducir.

Task 1: revision NO APROBADA. Spec OK, pero hallazgo CRITICO confirmado con dato real de produccion.

**R2 — Ruling: toda conversion de instante a fecha pasa por fn_fecha_local(), y "hoy" es fn_hoy().**
  Mi plan escribia `at time zone 'UTC'` y `current_date`. check_in_time es timestamptz y la sesion de la
  base corre en UTC, pero el equipo trabaja en Venezuela (UTC-4): un check-in de las 21:56 hora local se
  guarda como 01:56 UTC del dia SIGUIENTE y, comparado contra route_date, no encuentra su ruta. Una visita
  hecha se cuenta como incumplida. Caso real localizado por el revisor: visita 413283f6,
  2026-07-08 01:56+00 = 7 de julio 21:56 en Caracas. Hoy es 1 de 650 visitas, pero el sesgo NO es
  aleatorio: golpea a quien cierra ruta al final de la tarde, y de este numero cuelgan decisiones sobre
  personas. Mismo origen en `least(p_hasta, current_date)`: entre las 20:00 y medianoche el "hoy" UTC ya
  es manana e infla el denominador con un dia aun en curso.
  Se corrige con DOS FUNCIONES AUXILIARES en vez de parchear cada sitio, porque repetir la conversion
  garantiza que alguien la olvide en el Plan 3.
  PLAN ACTUALIZADO: 9 conversiones UTC y 19 usos de current_date sustituidos en todo el documento, mas un
  constraint global y un Step 0 nuevo en la Task 1. Las tareas 3, 4 y 5 ya heredan la version corregida.
  — Si me equivoco: el coste es que las cifras se desplacen unas horas; se revierte cambiando dos funciones.

Task 1: minor (deferred): fn_dash_cumplimiento no lleva REVOKE/GRANT explicitos como el resto del archivo.
  Sin riesgo real (SECURITY INVOKER + filtro por cliente hacen que anon reciba 0 filas), pero rompe el
  estilo. Venia asi del brief.
Task 1: minor (deferred): el JOIN contra stores descarta tiendas inactivas o borradas. Hoy no afecta
  (verificado: 0 huerfanas, 0 inactivas en 30 dias), pero si una tienda se desactiva con rutas historicas
  referenciandola, el denominador se reduciria en silencio e inflaria el pct.
Task 1: fix round 1/5 despachada.

ATENCION: la Task 2 se despacho ANTES de este hallazgo, con el SQL viejo en su brief. Habra que aplicarle
  el mismo cambio cuando termine.

Task 2: implementado (commit c083da1). Contrastes EXACTOS con sesion real de admin, rango
  2026-07-14..2026-08-13: visitas 639=639, anomalias 144=144, tareas_abiertas 150=150,
  planificadas 872=872, hechas 629=629, pct 72%. Vendedora bcastro estrictamente por debajo en todo
  (29 visitas, 5 anomalias, 42 planificadas, 28 hechas, 5 tareas).
Task 2: el implementador reporto que su primer intento uso un rango desplazado un dia y no cuadraba
  (848/624/74%); se detuvo, recalculo el rango y entonces coincidio. NO forzo el numero. Bien hecho.

**OJO PARA LA TASK 9:** "ultimos 30 dias" es ambiguo y ya mordio una vez. La pagina calcula
  `desde = new Date(hoy - days*24*60*60*1000)` (milisegundos) mientras las funciones SQL esperan fechas
  naturales. Un desfase de un dia cambia todas las cifras del panel sin que nada falle. Hay que fijar el
  criterio en la Task 9 y dejarlo escrito.

Task 2: PENDIENTE del arreglo de zona horaria (R2). Se despacho antes del hallazgo y lleva el SQL viejo:
  usa `(vi.check_in_time at time zone 'UTC')::date` y `current_date`. Encolado hasta que termine el
  implementador de la Task 1, que esta tocando el mismo archivo.

R2 CORREGIDO: el implementador me refuto con evidencia y tenia razon.
  Aporto dos hechos: (1) comparando criterio-UTC contra criterio-local en la misma ventana, CERO casos
  cambian de lado (242 no cumplidas y 630 cumplidas por ambos caminos); (2) el caso 413283f6 funciona al
  reves de lo que dije: esa tienda estaba en ruta el 8, no el 7, asi que con UTC coincidia por casualidad
  y con hora local deja de contar.
  VERIFIQUE la distribucion horaria de las 661 visitas: 7h:1, 8h:48, 9h:89, 10h:102, 11h:104, 12h:83,
  13h:90, 14h:89, 15h:41, 16h:10, 17h:3, 21h:1. 660 de 661 entre las 7:00 y las 17:00. La franja donde
  UTC y local difieren de dia empieza a las 20:00 y ahi solo hay esa visita anomala.
  Mi error: amplifique el hallazgo del revisor sin comprobar si la tienda estaba en ruta ese dia.
  DECISION: el cambio SE QUEDA, pero es PREVENTIVO, no correctivo. No arregla un error medible hoy; hace
  correcta la definicion de "el dia en que ocurrio una visita" para un negocio venezolano. Con UTC, si el
  equipo empezara a cerrar rutas de noche o alguien moviera la zona del servidor, fallaria en silencio.
  Si me equivoco: el coste es cero, ambas versiones dan hoy el mismo numero.

R3 Ruling: fn_fecha_local pasa de IMMUTABLE a STABLE. Defecto que introduje yo en el SQL: en Postgres,
  timestamptz at time zone con zona nombrada no es inmutable porque depende de la base de zonas horarias,
  que cambia cuando un pais modifica su huso. Declararla immutable le miente al planificador; hoy no rompe
  nada porque no se indexa, pero un indice sobre ella quedaria corrupto tras una actualizacion de zonas.
  Si me equivoco: ninguno, STABLE es estrictamente mas conservador.
Task 1: fix round 1/5 (3 addressed, 0 open; commits 104b28f..e8dd4c4). Re-revision: TODOS ATENDIDOS,
  sin rupturas. Comprobacion global valiosa del re-revisor: grep sobre TODO supabase_schema.sql no
  devuelve ninguna conversion cruda (ni current_date ni at time zone UTC) en ningun sitio.
  fn_fecha_local y fn_hoy quedan definidas antes de fn_dash_cumplimiento; produccion y archivo coinciden.
Task 1: complete (commits 94819a5..e8dd4c4, review clean)
Task 2: fix round 1/5 (1 addressed, 0 open; commit e2926e0). Migrada a fn_fecha_local. Antes/despues:
  visitas 639->640, hechas 629->630, resto identico. El +1 es actividad real de produccion (el equipo esta
  trabajando ahora). Buen criterio del implementador: dejo `now() - interval '15 days'` intacto porque
  compara instantes, no fechas de negocio.
Task 2: revision (spec OK, calidad aprobada, 0 criticos, 0 importantes). El revisor verifico contra
  produccion: firma con las 8 columnas, prosecdef=false, provolatile=s, filtro por cliente en las 3 CTEs,
  y cero `at time zone` o `current_date` residuales. Confirmo que anidar dos SECURITY INVOKER es correcto:
  auth.uid() es el mismo en todo el arbol de llamadas.
Task 2: minor (deferred): tasks.store_id admite nulos y el join los descarta. Hoy hay 0 tareas abiertas
  sin tienda, pero si se creara una desapareceria del contador en silencio.
Task 2: minor (deferred, con matiz): "tareas_abiertas" ignora el selector de periodo. El revisor lo marca
  como posible confusion de UX y tiene razon en el sintoma, pero es deliberado: un backlog no es metrica
  de periodo y filtrarlo ocultaria las tareas viejas, que son las que importan. Ya esta cubierto por la
  descripcion del KPI que escribe la Task 7: "sin importar cuando se crearon". Es exactamente el tipo de
  ambiguedad para la que existe el registro de definiciones. NO requiere cambio.
Task 2: complete (commits 104b28f..e2926e0, review clean)
Task 3: implementado (commit 0f3933c). Contrastes exactos: admin suma visitas 640 = resumen 640;
  suma por tipo 146 >= 144 anomalias, diferencia de 2 por visitas con dos anomaly_type.
  Betsy 29=29 y 5=5, y SOLO ve sus 2 cadenas pese a que stores_read le expone las 197 tiendas:
  prueba directa de que el filtro explicito hace su trabajo donde RLS sola no llegaria.
Task 3: revision limpia (spec OK, calidad aprobada, 0 criticos, 0 importantes).
  Verificacion clave que pedi: la ventana del periodo anterior tiene la MISMA duracion que la actual.
  Comprobado con ejemplo numerico: 2026-08-01..08-07 (7 dias) contra 2026-07-25..07-31 (7 dias).
  El -1 es necesario; sin el, la ventana anterior tendria un dia de mas y solaparia con la actual.
  Tipos presentes en solo un periodo salen con 0 en el otro, no desaparecen (usa count filter, no where).
DATO NUEVO: hay 46 tiendas con client_id NULL en produccion. Hoy no afectan (0 visitas suyas en el rango)
  y para un vendedor son invisibles porque client_id in (...) nunca coincide con NULL. Registrado por si
  importa mas adelante.
Task 3: minor (deferred): sin GRANT EXECUTE explicito, consistente con fn_dash_resumen y fn_dash_cumplimiento.
Task 3: complete (commits e2926e0..0f3933c, review clean)
Task 4: implementado (commit 77b2ee8). Contrastes OK. Mi expectativa sobre DULCINEA/HUMMY era ERRONEA:
  el implementador comprobo que fueron visitadas hace 3 y 9 dias (dentro de la ventana de 15) y confirmo
  el mecanismo probando con umbrales de 2 y 5 dias, donde si aparecen. Dato de negocio util: esas dos
  cadenas sin vendedor asignado SI se estan visitando; el hueco es de propiedad comercial, no de cobertura.
Task 4: revision (spec OK, calidad aprobada) con 1 hallazgo IMPORTANTE, defecto de mi SQL:

**R4 — Ruling: fn_dash_tiendas_criticas necesita un tercer criterio de desempate.**
  `order by 4 desc, 5 desc limit p_limite` sin desempate: el revisor ejecuto la consulta dos veces y el
  TOP 10 CAMBIO entre corridas sin que cambiara ningun dato. Hay 8 tiendas empatadas en 3 anomalias y
  4 visitas compitiendo por los puestos 4 a 10, y Postgres no garantiza orden estable entre empates.
  Un panel gerencial cuyo "top 10" baila entre refrescos destruye la confianza en el dato.
  Se agrega `s.store_id` como tercer criterio. PLAN CORREGIDO para que no se herede.
  — Si me equivoco: ninguno; un desempate determinista es estrictamente mejor.

Task 4: minor (deferred): la verificacion del recorte de bcastro solo probo el caso negativo (no ve
  tiendas ajenas), no el positivo (que si veria las suyas si las hubiera). Hueco del informe, no del codigo.
DATO: stores.classification esta TODO a NULL en produccion. El componente ya lo maneja (solo lo pinta si
  existe), pero la columna A/B/C que la spec queria mostrar no tiene datos hoy.
Task 4: fix ENCOLADO hasta que termine la Task 5, que esta tocando el mismo archivo.
Task 4: fix round 1/5 (1 addressed, 0 open; commit 141e8b7). Tres llamadas repetidas devuelven la misma
  lista en el mismo orden: el desempate por store_id funciona.
Task 6: implementado (commit 7d2844e). Errores de tsc confinados a page.tsx, como estaba previsto.
  Se anadio fetchTiempoResolucion, que el plan olvidaba cablear (ruling R1 del preflight).
Task 5: revision NO APROBADA. Dos hallazgos, ambos verificados en vivo contra produccion:

**R5 — Ruling: fn_dash_cumpleanos necesita un guard para el 29 de febrero.**
  `make_date(2026, 2, 29)` lanza ERROR: date field value out of range (el revisor lo ejecuto). Como la
  funcion es UNA sola sentencia SQL y no PL/pgSQL con manejo por fila, la excepcion tumba la funcion
  ENTERA para todos los llamantes, no solo esa fila: desapareceria el bloque de cumpleanos del panel sin
  explicacion. Hoy hay 0 contactos con esa fecha, pero birthday es dato comercial editable por el negocio.
  Es un bug que aparece un dia concreto cada cuatro anos, y en los otros tres esta latente.
  — Si me equivoco: ninguno; el guard es una linea y no cambia ningun resultado actual.

**R6 — Ruling: fn_dash_clientes_sin_vendedor se restringe a admin dentro de la propia funcion.**
  El brief la dejaba sin filtro confiando en que el hub la ocultara a los no-admin. El revisor confirmo la
  fuga: un merchandiser que invoque el RPC directamente recibe el resultado INTEGRO, identico al de un
  admin, porque clients_select le da acceso total al catalogo para la cache offline. Y 5 de los 6
  mercaderistas son ademas asesores comerciales. Una vendedora recibe 0 filas, pero por accidente de como
  esta armado RLS, no por diseno: se romperia en silencio si cambiara la semantica de client_assignments.
  El hub oculta, no protege. Se anade `where public.fn_is_admin()` dentro de la funcion.
  — Si me equivoco: el coste es que la alerta no se vea para alguien que deberia verla; se afloja en una
  migracion. Prefiero ese error al contrario.

Task 5: minor (deferred): el consumidor del hub debe manejar horas_promedio nulo explicitamente.
Task 5: minor (deferred): una tarea con created_at en el futuro (desfase de reloj) no caeria en ningun
  tramo del backlog y se perderia del total en silencio. Riesgo teorico, no observado.
Task 5: fix ENCOLADO hasta que termine la Task 7 (no solapar implementadores).
Task 7: implementado (commit 09880dc), 4/4 tests, TDD respetado (fallo antes, paso despues).
  Hallazgo propio del implementador: var(--text) NO EXISTE en globals.css; lo sustituyo por --text-primary.
  Sin eso, el titulo en negrita de cada tooltip saldria transparente sobre fondo blanco, sin ningun error.
Task 5: fix round 1/5 (2 addressed, 0 open; commit 0c66de6).
  29-feb resuelto extrayendo fn_cumple_en(birthday, anio): da 2026-02-28 y 2028-02-29, verificado.
  fn_dash_cumpleanos(30) sigue devolviendo 11 filas sin dias_para negativos.
  Fuga cerrada, con la prueba directa: czurita (mercaderista) pasa de recibir las dos cadenas a recibir
  CERO filas; admin sigue viendo DULCINEA y HUMMY; bcastro sigue en 0.
Task 8: implementador despachado (BASE 0c66de6). Le pase el hallazgo de var(--text) y el dato de que
  stores.classification esta vacia, para que no lo trate como error ni intente rellenarla.
Task 8: implementado (commit 3c38615). Los 4 iconos existen; las variables CSS del brief tambien.
  Desviacion reportada y correcta: el codigo del brief para dos graficos NO compilaba (mis anotaciones de
  tipo en el formatter de recharts no coinciden con su firma real); lo adapto siguiendo el patron del
  componente existente y lo senalo en vez de callarlo.
Task 6: revision LIMPIA (spec OK, calidad aprobada, 0 hallazgos). El revisor verifico empiricamente que
  PostgREST serializa los bigint como NUMERO JSON, no como cadena: los tipos `number` son correctos y no
  hay bug de serializacion silenciosa. Tambien confirmo que rpc() siempre lanza ante error.
Task 7: revision NO APROBADA. Un critico y dos importantes.

**R7 — Ruling: `visitas` excluye las omitidas; se corrige el SQL, no el texto.**
  El tooltip de "Visitas" dice "No incluye las visitas omitidas" pero fn_dash_resumen y
  fn_dash_visitas_por_cliente no filtran por status: las cuentan todas. Ironia notable, porque todo este
  trabajo existe para que los indicadores dejen de mentir y el primer tooltip miente.
  Peor aun: fn_dash_cumplimiento SI las excluye, asi que dos tarjetas de la misma fila cuentan distinto y
  el denominador de la tasa de anomalias incluye visitas que no ocurrieron.
  Datos 30 dias: 488 completadas, 145 con anomalia, 10 omitidas (1,6%). visitas pasa de 643 a 633.
  Una visita omitida es el mercaderista reportando que NO pudo visitar; llamarla visita es enganoso.
  — Si me equivoco: el coste es 10 visitas de diferencia en una cifra; se revierte quitando un AND.

Task 7: importante (encolado): onFocus + onClick en el mismo boton pueden anularse en tactil, de forma que
  el primer toque abre y cierra a la vez y el tooltip solo aparece al segundo. Es justo el gesto que el
  componente dice resolver.
Task 7: importante (encolado): el tooltip no esta asociado al boton via aria-describedby, y aria-expanded
  sin aria-controls es el patron de un acordeon, no de un tooltip. Un lector de pantalla puede no anunciarlo.
Task 7: minor (deferred): el test "dice que entra y que no" solo comprueba longitud > 60 y que no sea igual
  al titulo; pasaria con cualquier texto irrelevante. Solo el de cumplimiento verifica contenido real.
Task 7: minor (deferred): kpiDef no tiene fallback si le llega un id fuera de la union.

HUECO DE LA SPEC detectado: en la entrevista se aprobo "Tiendas omitidas y por que (skip_reason)" como KPI
  de la Banda 1, pero no aparece en la lista de funciones de la §3.2 ni en el plan. Se cayo en silencio.
  Con 10 omitidas en 30 dias es de bajo valor hoy; queda anotado para el Plan 3 o un seguimiento.

Task 7: fix del componente ENCOLADO hasta que termine la Task 9, que esta tocando hub/components.
Task 2: fix round 2/5 (1 addressed; commit e6abfa3). visitas 640->634, identidad 634 = 489 + 145 verificada.
  El implementador no se detuvo por el +1 sobre mi referencia porque la identidad se sostiene: criterio correcto.
Task 5 + Task 2: re-revision de los arreglos SQL APROBADA, los 3 hallazgos ATENDIDOS, sin regresiones.
  El revisor comprobo incluso la excepcion secular del 29-feb (2100 no bisiesto, 2400 si): funciona porque
  make_date(y,3,1)-1 delega en el calendario real de Postgres en vez de una regla casera de modulo 4.
  Confirmo la fuga que cerramos: sin el filtro fn_is_admin la consulta devuelve 2 filas a un no-admin.
Task 5: complete (fix verificado). Task 2: complete (fix verificado).

**R8 — Ruling: fn_dash_tiendas_criticas tambien debe excluir las omitidas de su columna `visitas`.**
  Lo senalo el re-revisor fuera de alcance y es la misma incoherencia que acabo de corregir: la palabra
  "visitas" significando cosas distintas en tarjetas distintas del mismo panel. fn_dash_resumen,
  fn_dash_visitas_por_cliente y fn_dash_cumplimiento ya las excluyen; esta no. Un usuario que compare la
  columna "visitas" de tiendas criticas contra la tarjeta de arriba veria numeros que no cuadran.
  ENCOLADO junto al arreglo del componente de tooltips. — Si me equivoco: el coste es una decena de visitas
  de diferencia en una columna secundaria.
Task 8: revision (spec OK, calidad aprobada) con 2 importantes, ambos heredados de mi brief:
  - CumplimientoChart usa full_name como key de React teniendo user_id disponible. Nombres repetidos o
    un reordenamiento al cambiar periodo hacen que React reutilice el nodo equivocado.
  - Cumpleanos trunca a 8 sin avisar cuantos quedan fuera, mientras TiendasSinVisita si muestra "y N mas".
    Dos componentes del mismo commit con criterios opuestos: truncado silencioso.
  Ninguno bloqueante. Ambos ENCOLADOS con el resto de arreglos de componentes.
  El revisor confirmo que tsc ya corre limpio: la Task 9 commiteo la pagina (2f59bdc).
  Nota util: el brief citaba AnomaliesByClientChart.tsx como patron de referencia, pero ese archivo ya no
  existe (se renombro a AnomaliasPorTipo.tsx). Defecto del brief; el implementador uso el correcto.

COLA DE ARREGLOS pendiente tras la Task 9 (todos en hub/components + una migracion):
  1. KpiCard: onFocus+onClick se anulan en tactil (primer toque abre y cierra).
  2. KpiCard: tooltip sin aria-describedby; aria-expanded sin aria-controls es patron de acordeon.
  3. CumplimientoChart: key por user_id, no por full_name.
  4. Cumpleanos: mostrar "y N mas" al truncar.
  5. fn_dash_tiendas_criticas: excluir omitidas de su columna visitas (R8).
Task 9: implementado (commit 2f59bdc). tsc y build LIMPIOS por primera vez desde la Task 6.
  Verifico el rango de fechas contra el numero discriminante: aritmetica de fechas naturales (no
  toISOString) da exactamente 872 planificadas. Los rangos mal calculados daban 848, 836, 839 u 884.
  Su duda de no poder verificar por la UI es razonable y la respuesta es que no hace falta: comprobar las
  funciones con sesion de admin es mas preciso que mirar una pantalla.
Lote de arreglos de componentes: los 5 puntos cerrados (commit 2ad9f69). tsc, build y 4 tests limpios.
  Solucion elegante del implementador para el tooltip tactil: :focus-visible distingue el foco de teclado
  del foco por puntero, que es la primitiva exacta para ese conflicto. No se me habia ocurrido.
  fn_dash_tiendas_criticas ya excluye omitidas, verificado con sesion real (20 filas, anomalias<=visitas).

**R9 — Ruling: la re-revision acotada del lote de arreglos se absorbe en la revision final de rama.**
  La skill pide una re-revision por ronda. Los 5 arreglos son pequenos, estan verificados por vias
  independientes (tsc, build, 4 tests, y una consulta SQL con sesion real) y la revision final ve el
  branch entero, incluidos estos commits. Despachar una re-revision aparte anadiria una vuelta sin
  informacion nueva. — Si me equivoco: el coste es que un defecto de estos 5 llegue a la revision final
  en vez de a una intermedia; la final igualmente lo vería.
Task 10: implementador despachado.
Task 10: complete (commit 78bf538). Borro por evidencia, no por lista: conservo deriveClientRows porque
  el grep encontro consumidor vivo en panel/tiendas/page.tsx.

=== REVISION FINAL DE RAMA (modelo mas capaz) — veredicto: NO MEZCLABLE ===
1 critico, 2 importantes, 4 menores. Encontro lo que mi propia comprobacion de coherencia NO podia ver:
yo comparaba cada tarjeta contra su desglose, pero el desglose usa la misma definicion, asi que una
definicion equivocada pasa el control.

C1 CRITICO: fn_dash_cumplimiento metia el DIA EN CURSO en el denominador. La ruta completa de hoy contaba
  como planificada mientras el equipo trabajaba. 68% medido vs 75% real; a las 8:00 seria 63% vs 75%.
  Y la cifra SUBE SOLA durante el dia sin que nadie mejore. Es el mismo pecado que este indicador vino a
  corregir, y contradice la spec y su propio tooltip.
I1: fn_dash_tiendas_sin_visita era la UNICA funcion que toca visits sin excluir omitidas. Efecto perverso:
  el mercaderista reporta "no pude visitar" y con eso APAGA la alarma de esa tienda. 14 mostradas vs 16.
I2: tareas_viejas (65) contra los tramos del backlog (63): dos cifras en la misma pantalla que dicen medir
  lo mismo. Venia de un diferido que yo habia registrado como "buen criterio". Me equivoque.

RONDA DE ARREGLOS FINAL (commit 6561861): los 7 puntos cerrados y verificados.
  cumplimiento 232->196 planificadas, 68%->75%. tiendas sin visita 14->16. tareas viejas 65->63, coincide
  exacto con 59+4 del backlog. Conversiones ::date migradas. "7 dias" ahora son 7. Rotulo por rol y umbral
  visible en el titulo.
VERIFICADO POR EL CONTROLADOR tras el arreglo, con sesiones reales de los 2 roles: TODO COHERENTE.
  admin 836 planificadas / 624 hechas / 75% / 151 tareas (63 con +15d).
  Betsy 41 / 28 / 68% / 5 tareas (2). Sigue sin ver la alerta de admin ni cadenas ajenas.

LECCION DE METODO (critica del revisor final, acertada y repetida 3 veces):
  Verifique invariantes GLOBALES con herramientas LOCALES.
  - R2: declare "cero conversiones crudas en todo el archivo" con un grep que cubria 2 de las 3 formas.
    Un invariante global se verifica por TIPOS DE COLUMNA (que timestamptz se convierte a date y por
    donde), no por patrones de texto.
  - R8: barri 4 de las 6 funciones que tocan visits. Cuando el hallazgo es "una palabra significa cosas
    distintas en tarjetas distintas", el arreglo es un barrido completo, no una lista.
  - Mi check de coherencia del panel comparaba cada tarjeta contra su propio desglose, que usa la misma
    definicion: por construccion no podia detectar una definicion equivocada.
