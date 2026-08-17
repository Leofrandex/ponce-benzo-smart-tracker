# SDD ledger — plan: docs/superpowers/plans/2026-08-12-hub-alcance-por-cliente.md

Spec: docs/superpowers/specs/2026-08-12-hub-alcance-por-cliente-design.md (leída, es la autoridad vinculante)
Rama: feat/alcance-por-cliente (creada desde master 7a2fc9c)

## Preflight — escaneo de conflictos

### Pares de tareas que comparten archivo o interfaz

| A → B | A produce | B consume | Hallazgo |
|---|---|---|---|
| T1 → T2 | `client_assignments` | lectura en `fn_my_client_ids`, `fn_can_see_store` | OK |
| T1 → T6 | `client_assignments` | destino del insert | OK |
| T2 → T7 | `fn_my_client_ids`, `fn_can_see_store`, `fn_is_merchandiser` | las 3 en las políticas | OK — nombres coinciden |
| T3 → T6 | `construirAsignaciones`, `FilaExcel` | import en `stageAsignaciones.ts` | OK — campos coinciden 1:1 |
| T4 → T6 | filas en `public.users` | FK `client_assignments.user_id`; lookup por correo | OK |
| T4 → T8 | contraseñas en `vendedores.secret.json` | login de `bcastro@` | OK |
| T5 → T4 | CHECK acepta `'vendedor'` | T4 inserta usuarios con `role='vendedor'` | **CONFLICTO — ver R1** |
| T5 → T9 | `roles.ts` (`roleLabel`, `Role`) | import en `layout.tsx` | OK |
| T6 → T7 | ~30 asignaciones sembradas | prerrequisito duro del swap | OK — declarado en Global Constraints |
| T6 → T8 | asignaciones | Betsy con exactamente 2 clientes | OK |
| T7 → T8 | políticas nuevas | lo que verifica | OK |
| T1/T2/T5/T7 → — | migraciones | `tools/supabase_schema.sql` | OK — cada tarea replica la suya |

### Coherencia interna de cada tarea

| Tarea | ¿Su texto concuerda consigo mismo? |
|---|---|
| T1 | Sí — SQL, verificación y réplica al esquema coherentes |
| T2 | Sí — la verificación del Step 3 comprueba justo el `SECURITY DEFINER` que el Step 1 exige |
| T3 | Sí — los 7 tests ejercitan exactamente lo que implementa `asignaciones.ts` |
| T4 | **No — ver R1** (usa `role: "vendedor"` antes de que T5 lo permita) |
| T5 | Sí — migración de datos antes de apretar el CHECK, orden correcto |
| T6 | Sí — dry-run antes de `--commit`, verificaciones posteriores concretas |
| T7 | Sí — guarda las políticas viejas antes de reemplazarlas |
| T8 | Sí — cada aserción tiene su contraparte negativa |
| T9 | Sí — el grep del Step 4 valida el renombrado del Step 1 |

### Rulings de preflight

**R1 — Ruling: la Tarea 5 se ejecuta ANTES de la Tarea 4.** — El plan crea en T4 usuarios con `role: "vendedor"`, pero el CHECK que acepta ese valor se aplica en T5; ejecutado en el orden escrito, el insert viola la restricción. El propio texto de T4 ofrece la alternativa de usar `supervisor` y corregir después, pero eso escribe un dato que hay que volver a tocar. Reordenar es más limpio y no rompe ninguna otra dependencia (T4 solo necesita que existan `users` y `clients`). — Si me equivoco: el coste es re-ejecutar T4, que es idempotente (`stageUsers` salta los existentes).

**Orden de ejecución resultante:** T1 → T2 → T3 → **T5 → T4** → T6 → T7 → T8 → T9.

**R2 — Ruling: se trabaja en rama sobre la copia principal, no en un worktree.** — `.env`, `hub/.env.local`, `tools/vendedores.secret.json` y ambos `node_modules/` están en `.gitignore` y no existirían en un worktree nuevo; sin ellos, ninguna tarea que toque Supabase ni `npm run build` puede correr. Crear el worktree exigiría duplicar secretos, que es peor. — Si me equivoco: el coste es que un fallo obliga a `git reset` en vez de borrar un directorio.

## Progreso

### Contexto del humano (2026-08-13)

- **Autorizado el plan completo, incluido el swap de RLS de la T7.**
- **Milagros Fernández NO usa la APK**, solo el hub → la T5 (cambio de rol) queda despejada; no hay que revisar la app móvil antes.

### Tareas

Task 3: implementado (commit d52ed07, 7/7 tests). Revisión despachada.
Task 1: implementador despachado (BASE d52ed07).

Task 3: revision limpia (spec OK, calidad aprobada, 0 criticos, 0 importantes).
Task 3: ⚠️ "no verificable desde el diff" (exactitud de SHORT_NAME_TO_CLIENT) RESUELTO por el controlador
  contra la base: 17/17 valores del mapa existen en public.clients; sin huerfanos del mapa;
  unicos clientes sin mapear = HUMMY y DULCINEA 2019 (los 2 conocidos, ausentes del Excel). No es brecha.
Task 3: minor (deferred): falta test de la direccion inversa de la regla de correo
  (correo conocido + fila posterior con correo vacio/distinto -> no debe pisarse). Guard simetrico, riesgo bajo.
Task 3: minor (deferred): la busqueda en SHORT_NAME_TO_CLIENT es sensible a mayusculas y solo hace .trim()
  del nombreCorto; fragil si el Excel trae variaciones de capitalizacion. Prescrito asi por el brief.
Task 3: complete (commits 7a2fc9c..d52ed07, review clean)

Task 1: implementado (commit db5394c) con 2 observaciones, ambas defectos DEL PLAN. Verificadas por el controlador:

**R3 — Ruling: se elimina el indice stores_client_idx recien creado.** El plan mandaba crearlo asumiendo que
  no existia, pero la base ya tenia idx_stores_client con definicion identica (btree sobre stores(client_id));
  verificado en pg_indexes. Dos indices iguales sobre la misma columna no aportan lecturas y encarecen cada
  escritura de una tabla que la ingesta reescribe completa. La intencion de la spec (§1.3, "indices en
  stores(client_id)") ya estaba satisfecha. — Si me equivoco: el coste es recrear un indice, segundos.

**R4 — Ruling: el bloque de client_assignments se mueve DESPUES de la tabla users en supabase_schema.sql.**
  El plan decia "despues de clients" (linea 14), pero el bloque tiene FK a public.users (linea 81) y a
  public.stores (linea 51); asi escrito, una reconstruccion del esquema desde cero falla. Ese archivo existe
  precisamente para ser reproducible. — Si me equivoco: el coste es reordenar unas lineas de un archivo que
  no se ejecuta en produccion.

Task 1: fix round 1/5 (2 addressed, 0 open — indice duplicado eliminado, bloque reordenado tras users;
  commits db5394c..c69bc68). El implementador reporto un 3er defecto de orden en el mismo archivo.

**R5 — Ruling: la policy client_assignments_admin_all se mueve a la seccion de policies de admin.**
  Es defecto NUESTRO, no preexistente: verificado que supabase_schema.sql ya define fn_is_admin() en la
  linea 458 y coloca despues, desde la 478, las 7 policies que la usan. Nuestra policy en la linea 89 era
  la unica que rompia esa convencion, y una reconstruccion desde cero fallaria ahi. Solo se toca el archivo;
  produccion esta correcta. — Si me equivoco: el coste es mover unas lineas de un archivo no ejecutable.

Task 1: fix round 2/5 despachada.
Task 1: fix round 2/5 (1 addressed, 0 open — policies movidas tras fn_is_admin; commit 901368e).
  Verificado por el implementador: clients(14) < users(59) < client_assignments(73); todas las
  invocaciones de fn_is_admin (456,457,466,478-484,518) posteriores a su definicion (449).
Task 1: revision formal despachada sobre el rango completo d52ed07..901368e.
Task 2: implementador despachado (BASE 901368e).
Task 1: revision limpia (spec OK, calidad aprobada, 0 hallazgos de cualquier severidad).
  Revisor verifico contra produccion: PK, FKs on delete cascade, indice, RLS activa y las 2 policies
  identicas entre archivo y base; idx_stores_client unico sobre stores(client_id); schema reproducible
  de punta a punta (leyo las 521 lineas, sin referencias hacia adelante).
Task 1: el revisor dejo sin verificar la autoria de los commits; RESUELTO por el controlador con
  git log --format="%h %ae": los 5 commits de la rama son de sebastiancm7162@gmail.com. Importa porque
  Vercel bloquea deploys con el correo autogenerado sebastian.castro@CLMD.LOCAL.
Task 1: complete (commits d52ed07..901368e, review clean)
Task 2: implementado (commit e837470). Verificaciones: sin error de recursion (es_merc=false, mis_clientes=0);
  las 3 funciones con prosecdef=true. Anadio REVOKE/GRANT EXECUTE replicando el patron de fn_is_admin,
  a peticion mia. Revision despachada.

**R6 — Ruling: el conteo esperado del Step 2 de la T5 esta mal en el plan y se sustituye por otro criterio.**
  El plan dice esperar "admin 2, merchandiser 6, vendedor 6", pero ese 6 contaba a los 5 usuarios que la T4
  todavia no ha creado (y la T4 va DESPUES de la T5 por el ruling R1). El criterio real de exito es:
  cero filas con role='supervisor' y Milagros Fernandez como 'vendedor'. Se lo pase asi al implementador.
  — Si me equivoco: el coste es cero; es un criterio de verificacion, no un cambio de comportamiento.

Task 5: implementador despachado (BASE e837470). Es la PRIMERA tarea que modifica datos existentes en
  produccion (1 fila: Milagros). Despejada porque el usuario confirmo que no usa la APK.
Task 2: revision (spec OK, calidad aprobada, 0 criticos, 0 importantes).
Task 2: minor (deferred): estilo de search_path inconsistente entre las 3 nuevas y fn_is_admin.
  Equivalentes en Postgres, cosmetico. Incluido en la ronda de arreglos 1 de paso.
Task 2: el ⚠️ "no verificable desde el diff" (aplicacion real en produccion) lo RESOLVIO el controlador
  contra la base, y DESTAPO UN HALLAZGO IMPORTANTE que ni implementador ni revisor vieron:
  el REVOKE ... FROM PUBLIC, anon se escribio en supabase_schema.sql pero NUNCA se aplico a produccion.
  has_function_privilege: fn_is_admin anon=false (correcta) vs las 3 nuevas anon=TRUE.
  Sin fuga de datos (auth.uid() es nulo para anon, devuelven vacio o false), pero rompe el patron de
  defensa en profundidad del proyecto y deja el esquema versionado mintiendo sobre el estado real.
  Clasificado Importante, entra al fix loop.
Task 2: fix round 1/5 despachada (aplicar los grants en produccion y unificar estilo de search_path).

**R7 — Ruling (error de proceso MIO): no volver a despachar dos implementadores en paralelo.**
  La skill lo prohibe explicitamente y aqui se vio por que: despache el fix de la T2 y la T5 a la vez
  sobre el MISMO working tree (no hay worktree aislado, ver R2). El implementador de la T5 comiteo primero
  y arrastro la edicion sin comitear del de la T2. Commit 834a3a1 mezcla ambas tareas.
  A partir de aqui: un solo implementador vivo a la vez. Revisores en paralelo si, implementadores no.
  — Si me equivoco: ya se materializo el coste, un commit con historia mezclada.

**R8 — Ruling: el commit 834a3a1 se deja como esta, no se desenreda.**
  Contiene roles.ts, types.ts, perfil/page.tsx (T5) y supabase_schema.sql (CHECK de la T5 + 3 lineas de
  estilo search_path de la T2). Todo el contenido es correcto y todo pertenece a esta rama. Un rebase
  interactivo para separarlo, con un implementador vivo trabajando sobre el mismo arbol, es riesgo real
  a cambio de cero ganancia funcional. — Si me equivoco: el coste es una linea de historia menos legible.

Task 2: fix round 1/5 (1 addressed, 0 open). Los grants se aplicaron en produccion via migracion
  grants_fn_scope_helpers y los VERIFIQUE YO directamente: las 4 funciones authenticated=true, anon=false.
  Evidencia mas fuerte que una revision de diff, porque el cambio era una migracion y no codigo.
  El cambio de estilo de search_path (3 lineas) viajo dentro de 834a3a1 por el error R7.
Task 2: complete (commits 901368e..e837470 + los grants en produccion, hallazgo importante cerrado y verificado)
Task 5: fix round 1/5 (1 addressed, 0 open, 4 politicas de escritura reescritas; commit 319276e).

**R9 — Ruling: las 4 politicas de escritura huerfanas se acotan por cliente, no se renombra el rol.**
  Al eliminar 'supervisor' en la T5, contacts_write_staff, engagements_write_auth, stores_insert_staff y
  stores_update_staff quedaron apuntando a un rol inexistente: Milagros perdio en produccion la capacidad
  de editar contactos, tiendas y notas ajenas. Mi plan no las cubria en NINGUNA tarea (la T7 solo reescribe
  politicas de lectura). Un simple supervisor a vendedor habria restaurado el permiso pero dejando la
  incoherencia de poder EDITAR contactos de cadenas que no se pueden VER. Las acote con fn_can_see_store();
  stores_insert_staff va por rol porque aun no hay tienda que acotar. La T7 ya no necesita tocarlas.
  Si me equivoco: el coste es que un vendedor no pueda editar algo que deberia; se afloja con una migracion.
  Verificado por el controlador en pg_policies: las 4 quedaron exactamente asi.

Task 5: revision formal despachada (rango e837470..319276e).
Task 4: implementador despachado (BASE 319276e). Unico implementador vivo, ver R7.
Task 5: revision (spec OK, calidad aprobada). tsc verificado de forma independiente por el revisor.
  Confirmo que valido las 4 politicas de escritura: fn_can_see_store definida antes de usarse,
  stores_insert_staff sin USING es lo correcto para un INSERT, y el admin conserva acceso total.
Task 5: HALLAZGO IMPORTANTE del revisor -> tools/ingesta/stageUsers.ts:9,48 no conoce el rol 'vendedor'.
  El tipo VendedorDef.role y el mapa order={admin:0,supervisor:1,merchandiser:2} quedaron obsoletos.
  order['vendedor'] es undefined -> el comparador de sort recibe NaN -> orden de upsert indefinido.
  Riesgo real, no cosmetico: users.supervisor_id tiene FK contra users.id y el script inserta en orden
  jerarquico justamente para que el jefe exista antes que el subordinado.
  Es el script que la T4 esta ejecutando en este momento. Pendiente de ver su resultado.
Task 5: minor (deferred): mockSupervisor en hub/app/lib/mock-data.ts:40, codigo muerto sin importadores.
Task 5: ⚠️ del revisor (las 4 politicas de escritura ya no filtran por rol, asi que un merchandiser CON
  asignaciones gana escritura que ningun merchandiser tenia antes) -> NO es defecto: es exactamente el
  modelo aprobado en la spec (rol y asignacion son ejes independientes; 5 de los 6 mercaderistas son
  ademas asesores comerciales con cuentas propias). Queda dicho aqui para que la revision final lo vea.
Task 5: complete (commits e837470..319276e, review clean salvo el hallazgo Importante de stageUsers.ts,
  que se cierra en la T4 -- ver abajo).

Task 4: implementado (commit 1698a4f). 13 usuarios en produccion (2 admin, 5 merchandiser, 6 vendedor),
  las 5 cuentas nuevas activas, y login real de bcastro@ verificado con access_token.
  Verificado por el controlador: la jerarquia quedo bien resuelta, incluido Juan Leon -> Dubraska Perez
  (vendedor supervisando a vendedor), que es el caso exacto que rompia la FK.

**R10 — Ruling: el hallazgo Importante de stageUsers.ts se corrige y se comitea aparte.**
  Confirmacion cruzada fuerte: el revisor de la T5 lo predijo por lectura y el implementador de la T4 lo
  choco de frente ejecutando el script. El tipo VendedorDef.role y el mapa de orden pasan a conocer
  'vendedor'. Tambien se corrigio en vendedores.json el role:"supervisor" de Milagros, que ya violaba el
  CHECK y habria reventado la proxima ingesta. — Si me equivoco: el coste es nulo, sin estos cambios el
  script simplemente no corre.

Task 4: complete (commits 319276e..5857e15). 13 usuarios, jerarquia y login verificados por el controlador.

**R11 — Ruling: el "9 personas / ~30 filas" del plan era un error de conteo MIO; el dato correcto es 11 y 33.**
  Al resumir la tabla agrupe en una linea a Carlos, Eduward, Elvis y Jonathan (los 4 que solo llevan Locatel)
  y conte lineas en vez de personas. El error se propago a la spec, al plan y al despacho. Verificado contra
  la base: 33 filas, 11 personas, 195/197 tiendas, huerfanos exactos DULCINEA 2019 y HUMMY, y las cifras por
  persona coinciden tienda por tienda. El implementador hizo lo correcto: reporto la discrepancia en vez de
  ajustar los datos al numero esperado. — Si me equivoco: ninguno, el dato de produccion es el correcto.
  PENDIENTE: corregir "9 personas" en la spec (§1.5) y en Pendientes.md del vault.

Task 6: implementado (commit f95dd25). 33 filas, 11 personas, 195/197 tiendas. Verificado por el controlador.
Task 6: revision (spec OK, calidad aprobada) con 1 hallazgo IMPORTANTE heredado de mi brief:
  stageAsignaciones.ts:72-74 hace delete + insert SIN transaccion. Si el insert falla tras el delete,
  client_assignments queda VACIA. Hoy seria inocuo (politicas viejas activas), pero en cuanto aterrice la T7
  significa que todos los vendedores abren el panel y no ven nada. Latente en cada re-siembra futura.
  ENCOLADO: no se despacha hasta que termine la T7, que esta tocando supabase_schema.sql (ver R7).
Task 6: minor (deferred): errores de lectura de users/clients se tragan con `?? []`, sin distinguir
  "tabla vacia" de "consulta fallida" (stageAsignaciones.ts:46,48).

ROLLBACK de la T7 capturado por el controlador en ROLLBACK-antes-de-T7.sql (cuerpo completo en la consulta
  de pg_policies del transcript). Incluye ya las correcciones de la T5, que NO hay que deshacer.
Task 7: implementador despachado (BASE f95dd25). PASO DE RIESGO.
  Correcciones que le pase sobre el SQL del brief: (a) no tocar las 4 politicas de escritura ya hechas;
  (b) todas las politicas con `to authenticated` en vez de omitir la clausula (que equivale a TO public e
  incluye anon), y normalizar de paso 6 politicas que quedaron TO public por descuido mio en tareas previas.

Task 7: APLICADO EN PRODUCCION (commit 382e0f4). Verificacion 1 (cero politicas con supervisor_id) PASA.
  Verificacion 2 marco 5 tablas sin politica SELECT: las 5 son _mig_backup_* / _mig_store_map_* de julio,
  respaldos preexistentes fuera de alcance. El implementador hizo bien en NO tocarlas.
  Drift preexistente reportado: device_logs existe en produccion pero nunca estuvo en supabase_schema.sql.

Task 7: SMOKE TEST DEL CONTROLADOR con sesiones reales -- TODO OK. Guardado en smoke-rls-controlador.py.
  admin Rosli: 19 clientes / 197 tiendas / 234 contactos / 654 visitas.
  Betsy (vendedora): 2 clientes / 10 tiendas / 10 contactos / 29 visitas. NO ve Farmatodo ni Locatel.
  Juan Leon (vendedor): 1 cliente / 6 tiendas.
  Carlos (mercaderista + asesor Locatel): conserva las 197 tiendas -> la cache offline de la APK no se rompe.

OBSERVACION para la revision final (no defecto): los mercaderistas ven los 234 contactos de todas las
  cadenas. Es lo que dice la matriz aprobada de la spec (necesitan datos de contacto de las tiendas que
  visitan y sus rutas cruzan clientes), pero contrasta con lo estricto del recorte para vendedores sobre
  esa misma tabla, que la spec llama "la data comercial mas sensible del sistema". Que lo valore el usuario.

Task 7: revision despachada. Encargo especifico: buscar politicas huerfanas o duplicadas que, al sumarse
  por OR con las nuevas, ensanchen el acceso -- que es lo que un smoke test de camino feliz no ve.
Task 7: revision limpia (spec OK, calidad aprobada, 0 criticos, 0 importantes). El revisor consulto
  produccion en solo lectura y verifico lo que el smoke test no puede ver: volco TODAS las politicas de las
  10 tablas mas storage y comprobo que cada politica FOR ALL (que en RLS tambien actua como SELECT) tiene
  un USING subconjunto del de su politica de lectura. Ninguna ensancha el acceso. Tambien confirmo que el
  indice [2] de la politica de fotos es correcto y que FALLA CERRADO ante un nombre mal formado, y que
  tasks con store_id nulo cae a assignee o creador, que es lo previsto.
Task 7: minor (deferred): 7 politicas *_admin_read preexistentes quedaron redundantes porque
  fn_can_see_store ya incluye a los admin. Peso muerto, sin riesgo. Fuera del alcance de la T7.
Task 7: complete (commits f95dd25..382e0f4, review clean)
Task 8: implementador despachado (BASE 382e0f4).
Task 8: implementado (commit 57f422d), 27/27 aserciones pasan, exit 0. Anadio cobertura de Juan Leon
  (vendedor de una sola cadena), autorizada.
Task 8: revision NO APROBADA. Hallazgo CRITICO: la asercion de fuga del mercaderista
  (verify_rls.ts:144-152) trae filas de visits sin paginacion ni limite. PostgREST corta en 1000 filas
  en silencio -> cuando el equipo pase de mil visitas, la comprobacion de fuga SEGUIRIA PASANDO EN VERDE
  estando ciega. Peor modo de fallo posible para un verificador. Hoy hay 654 visitas totales y Carlos ve
  248, asi que aun funciona, pero esta a menos de 2x del tope. Heredado de mi brief.
  El revisor CORRIO el script de verdad y reprodujo la salida: el informe no estaba fabricado.
Task 8: importante (mismo patron en tiendas de bcastro/jleon, verify_rls.ts:85,117) y menor (errores de
  consulta no capturados: un `?? []` convierte un fallo en "array vacio" y la asercion pasa trivialmente).
Task 8: fix ENCOLADO hasta que termine el implementador de la T6 (ver R7, no solapar implementadores).
Task 8: positivo confirmado por el revisor: la asercion de las 197 tiendas de Carlos usa count/head:true,
  inmune al tope, y compara con >=197, asi que detecta una bajada del catalogo sin romperse al crecer.

R11 (correccion de docs): "9 personas, ~30 filas" corregido a "11 personas, 33 filas" en Pendientes.md.
Task 6: fix round 1/5 (2 addressed, 0 open; commit 1b5c592). Siembra ahora atomica via RPC
  fn_replace_client_assignments, que ademas RECHAZA un conjunto vacio: ultima defensa contra dejar a todo
  el mundo sin cartera por un Excel mal leido. El implementador anadio `where true` al DELETE porque el
  proyecto tiene safe-update activo en produccion y rechazaba el borrado sin WHERE; correcto y necesario.
  Verificado por el controlador: 33 filas, 11 personas, 195 tiendas (identico a antes) y la funcion NO es
  invocable por authenticated, solo con la llave de servicio.
Task 6: complete (commits 5857e15..1b5c592, hallazgo Importante cerrado)
Task 8: fix round 1/5 despachada (paginacion con .range(), mismo tratamiento a las consultas de tiendas,
  y captura del error de Supabase en cada consulta).
Task 8: fix round 1/5 (3 addressed, 0 open; commit 6f50499). Re-revision acotada: los 3 hallazgos
  ATENDIDOS, sin rupturas nuevas. El re-revisor ejecuto el script en vivo y reprodujo 27/27, exit 0.
  Confirmo que la condicion de salida del bucle (lote.length < TAM) es correcta: .range() es inclusivo en
  ambos extremos, sin solapamiento ni huecos entre paginas.
Task 8: complete (commits 382e0f4..6f50499, fix verificado)
Task 9: implementador despachado (BASE 6f50499). Ultima tarea del plan.
  Le pedi ademas comprobar que /panel quede realmente protegido en el middleware: un renombrado a medias
  ahi compila y arranca igual, pero deja el panel accesible sin sesion.
Task 9: implementado (commit 3be7f74). tsc y build limpios: 11 paginas, /panel y sus 5 subrutas en el
  bundle, middleware activo. Verificada la proteccion: startsWith("/panel") cubre todas las rutas reales
  porque el grupo (panel) no aparece en la URL. Cero referencias a /supervisor en hub/.
  Corrigio ademas 3 archivos que mi brief NO listaba: hub/app/page.tsx,
  components/clientes/ClientesTable.tsx y components/tareas/TaskVisitDetail.tsx.
  Nota de proceso: este agente se detuvo una vez sin cerrar su contrato; se reanudo con SendMessage.

DIFERIDO (fuera del alcance de este plan):
  hub/public/sw.js es un service worker de next-pwa de abril, VERSIONADO y servido desde /public, que
  menciona rutas viejas. Nada en el codigo lo registra hoy, pero si algun navegador lo registro en su dia
  esa instalacion persiste y podria servir chunks obsoletos en cache. Obsoleto desde abril con muchos
  despliegues de por medio: no es consecuencia de este trabajo.
Task 9: revision despachada.
Task 9: revision limpia (spec OK, calidad aprobada, 0 hallazgos de cualquier severidad).
  El revisor verifico el middleware por su cuenta y confirmo que startsWith("/panel") cubre todo.
  Senalo que el implementador encontro y arreglo la condicion de "activo" DUPLICADA (nav de escritorio
  y nav movil); mi brief solo mencionaba una.
  profile nulo durante la carga: roleLabel(profile?.role ?? "") devuelve cadena vacia, no revienta ni
  muestra un "Supervisor" fantasma.
Task 9: complete (commits 6f50499..3be7f74, review clean)

=== TODAS LAS TAREAS DEL PLAN COMPLETAS (9/9) ===

=== REVISION FINAL DE RAMA (modelo mas capaz) — veredicto: MEZCLABLE ===
1 Critico, 3 Importantes, 5 Menores. Ningun hallazgo cuestiona el modelo: las politicas juntas no abren
ningun camino de lectura fuera de la matriz aprobada.

C1 CRITICO — escalada de privilegios PREEXISTENTE que esta rama vuelve decisiva:
  users_own_profile es FOR ALL ... USING (auth.uid()=id) SIN WITH CHECK. En Postgres eso reutiliza el
  USING para escrituras, asi que cualquiera puede hacer `update users set role='admin' where id=auth.uid()`
  y a partir de ahi ve los 19 clientes, 197 tiendas, 234 contactos, todas las fotos, y se reparte cartera.
  No lo introduce la rama (la politica es identica a la anterior) pero antes daba acceso a un sistema donde
  todos veian todo igualmente; ahora es la UNICA puerta que anula todo el trabajo.
  ARREGLO EN CURSO: revoke update (role, active, supervisor_id, id, email) a authenticated y anon.
  Se deja full_name editable a proposito.

DECISIONES DEL USUARIO (2026-08-13):
  - Borrado de contactos por los 11 asignados: SE DEJA COMO ESTA.
  - Mercaderistas viendo los 234 contactos de todas las cadenas: SE DEJA COMO ESTA.
  - Las 28 tareas de Milagros fuera de su cartera: SE OCULTAN. La tarea sigue a su tienda.
    Implica quitar la rama assignee_user_id = auth.uid() de tasks_select y tasks_update, que es
    exactamente lo que ya pedia la §4.2 de la spec. PENDIENTE DE DESPACHAR tras la ronda en curso.

I3 — tasks.resolved_at y resolved_by nunca se implementaron pese a estar en la §1.6 (dentro de alcance).
  Se cayeron en silencio. Incluidos en la ronda de arreglos en curso.

Triaje del revisor sobre los menores diferidos:
  - CERRAR: estilo search_path (ya resuelto en 834a3a1) y el `?? []` de la T6 (ya resuelto en el fix).
  - OJO: de las 7 politicas *_admin_read "redundantes", DOS NO LO SON. device_logs_admin_read es el unico
    acceso del admin a device_logs, y comp_reports_admin_read el unico camino a reportes con store_id NULL
    porque comp_reports_assigned_read exige store_id IS NOT NULL. No borrarlas a ciegas.
  - SHORT_NAME_TO_CLIENT sensible a mayusculas: esperar, PERO anotar que una variacion de capitalizacion
    descarta la cadena entera en silencio, y fn_replace_client_assignments solo rechaza el conjunto VACIO,
    no la perdida parcial.
  - sw.js: la salida limpia es un stub que se auto-desregistre, no borrar el archivo.

Sobre mis rulings, el revisor los valida todos y matiza dos:
  - R9 acertado, pero se me escapo que el FOR ALL arrastra el DELETE de contactos. Consultado al usuario:
    se deja como esta.
  - R7 correcto pero mal diagnosticado: el problema no fue "dos implementadores" sino "dos implementadores
    SIN AISLAMIENTO", consecuencia directa de R2. La regla derivada correcta es "sin worktree, la
    serializacion es obligatoria", para que en el proximo plan nadie reintroduzca el paralelismo creyendo
    que era una limitacion de la herramienta.

RONDA DE ARREGLOS DE LA REVISION FINAL (commit 8de3bee):
  C1 escalada de privilegios CERRADA. Detalle importante: MI arreglo no funcionaba. El revoke a nivel de
  columna que especifique no bastaba porque Supabase concede UPDATE a nivel de TABLA y eso domina sobre
  cualquier revoke de columna. El implementador lo detecto VERIFICANDO en vez de asumir, y aplico una
  segunda migracion: revoke de tabla mas regrant solo de full_name.
  VERIFICADO POR EL CONTROLADOR con sesion real de bcastro: el intento de role=admin devuelve
  403 permission denied, el rol sigue vendedor, y editar el propio full_name sigue permitido con 200.
  I2 asercion tautologica corregida: el baseline del mercaderista sale ahora de client_assignments.
  I3 tasks.resolved_at y resolved_by anadidas.
  M1 rotulo Panel Supervisor cambiado a Panel.

R12 Ruling: las 4 tareas de HUMMY y DULCINEA 2019 no bloquean, se continua.
  Al aplicar la decision del usuario (la tarea sigue a su tienda), 4 de las 149 quedaron sin vendedor.
  El implementador se detuvo, como le pedi. Verifique y NO estan huerfanas: cada una la ven los 2 admins
  (fn_can_see_store empieza por fn_is_admin) y su creador por la rama created_by_user_id. La de DULCINEA
  es de Carlos Zurita y las 3 de HUMMY de Eduward Martinez. Lo que ocurre es que no entran en la bandeja
  comercial de ningun vendedor, sintoma correcto del hueco de negocio ya conocido: esos 2 clientes son los
  unicos que no aparecen en el Excel de asesores. No se inventa una asignacion.
  Si me equivoco: el coste es que 4 tareas de reposicion tarden en atenderse; se corrige asignando esos
  2 clientes en cuanto el cliente responda la pregunta 2 de la lista.
