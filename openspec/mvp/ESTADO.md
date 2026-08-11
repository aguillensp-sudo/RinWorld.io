# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado, los
> nombres de columna y las asignaciones de modelo se copian del spec cerrado o del plan
> **con el puntero al lado**. Un enum o un nombre de campo sin puntero se considera no
> verificado.
>
> **Corolario del día 3 (F-024).** Una advertencia de aquí sin puntero se comprueba antes
> de actuar. **Hoy pagó por sexta vez:** este fichero avisaba de que *"el Coder pintará una
> columna de precio porque el mock la tiene"*. **El mock no la tiene** — sus diez `<th>` son
> las diez de la spec. La advertencia era falsa y costó comprobarla dos minutos.
>
> **Corolario del día 5 (una cifra de aquí también).**
>
> **Y el del día 6, que es nuevo y es el más caro: una causa encontrada no es la única
> causa.** Este fichero cerraba F-037 con *"lo arregla volver a pegar el secret, y **es lo
> único**"*. No lo era: la clave está limpia y Supabase la rechaza igual. Ver F-050.
>
> **Ampliación del 11-ago: el diagnóstico de F-050 que este fichero daba también era falso.**
> La clave no estaba caducada ni era de otro proyecto: **le sobraba un `;`** — 47 caracteres
> contra 46. Se comprobó la **clase de carácter** (F-037 había sido eso) y no la **forma**, y
> un `;` es ASCII, así que la guardia lo dejó pasar. Dos diagnósticos seguidos dados por
> buenos sin que ningún verde los confirmara. **Un `sb_publishable_` tiene longitud fija: la
> guardia tiene que validar longitud y forma, no solo la codificación.**

**Día 6 de 15 · cerrado 10-ago-2026 · Estado: ÁMBAR. Los dos bloques del día cerrados;
la CI sigue roja y ahora por una causa distinta de la que este fichero daba por buena**

> **Lo urgente sigue siendo de seguridad y sigue sin hacerse (F-038).** La contraseña de la
> cuenta `alpha` estuvo descargable en texto plano en los artefactos de una CI pública. Las
> corridas nuevas ya no la escriben. **La contraseña actual sigue siendo la que estuvo
> expuesta.**

> **Y lo nuevo que bloquea: el e2e entero no corre, y no por el código (F-050).** La clave
> de `app/.env` está **limpia** —cero caracteres fuera de ISO-8859-1, la guardia de
> `supabase.ts` no salta, la app arranca— y Supabase **la rechaza igual**. Verificado sin la
> app por medio: `GET /rest/v1/organizations` con esa `apikey` devuelve
> **HTTP 401 `{"message":"Invalid API key"}`**. Cae el `setup` de autenticación, así que
> **los 40 escenarios quedan sin correr**, no solo los de SRCH-01.
>
> Lo bueno: **la guardia de ISO-8859-1 que se escribió ayer funciona y hoy lo demostró.**
> Al dejar de disparar, destapó lo que tapaba.

> **11-ago · LA CI ESTÁ EN VERDE ENTERA. Los tres trabajos. Primera vez desde el día 2.**
>
> `App · typecheck, Vitest, build` ✅ · `Esquema (30 asertos)` ✅ · `Playwright · puerta de las
> dos cuentas` ✅ **41/41**. Corrida `31481984861`.
>
> Costó cuatro corridas y cuatro causas encadenadas, ninguna de las cuales era la que este
> fichero daba por buena al cerrar el día 6. F-050 resuelto —sobraba un `;` en la clave de
> `app/.env`— destapó la corrida de las 09:59 UTC: **37 pasan, 3 fallan**, y esos 3 eran
> defectos de la propia suite.
>
> **Los secrets de GitHub estaban bien todos.** El PO repegó `SUPABASE_PUBLISHABLE_KEY` y
> `SUPABASE_URL` hoy a las 09:45/09:46 UTC, y los seis `E2E_*` son del 9-ago y funcionan. Lo
> que estaba mal era **solo `app/.env` en la máquina del PO**, en las dos variables: el `;` de
> la clave y una contraseña de alpha que no coincide con la de Supabase (`beta` → 200 contra
> GoTrue, `alpha` → 400 `invalid_credentials`). Eso ya no bloquea la CI, solo el e2e local.
> Ver `PENDIENTE-PO.md` §2.
>
> **Los 3 fallos eran de la propia suite, no del código (F-052), y costaron tres tandas
> porque cada arreglo destapaba el siguiente.** (1) `search.spec.ts` buscaba el botón de
> filtros por `/Filtro/` y el nombre accesible es `Añadir filtro` —`FilterChips.tsx:93` le
> pone un `aria-label`, que tapa el texto interno—. (2) Al abrirse por fin el formulario,
> el submit resolvía a **dos** botones: en Playwright el `name` en cadena casa **por
> subcadena**, al revés que Testing Library, y `'Añadir'` cogía también `'Añadir filtro'`.
> (3) El test *"no trae líneas que no estén publicadas"* tenía la **premisa falsa** — el
> catálogo tiene tres referencias que casan con `32011`, y una de las `32011X` está
> **PUBLISHED** (Łożyska Wschód), así que el estado vacío no llegaba nunca. Reescrito para
> que pruebe lo que promete, y el estado vacío a test propio: **41, todos verdes.**
>
> **El corolario, que es el que hay que llevarse al día 7:** una suite roja por infraestructura
> no solo deja el código sin cubrir — **deja de cubrirse a sí misma** y acumula defectos
> propios que solo salen el día que vuelve a arrancar. Mientras una suite esté en rojo por
> infra, toda corrección hecha en otra suite hay que propagarla a mano.
>
> **Y una quinta repetición del patrón más viejo del proyecto (F-053).** Con Playwright ya
> verde, el trabajo `Esquema` —que había pasado dos veces esa misma mañana— murió con
> `exit code 2` **y ni una línea más**. La causa hubo que deducirla del número: 2 es el código
> de `pg_isready` para "sin respuesta", y `run.sh` tenía uno con `-q` suelto detrás del bucle
> de espera. Transitorio en la causa, estructural en el silencio. Ya vuelca estado del
> contenedor y `docker logs` antes de rendirse. **Ningún camino de fallo puede terminar en un
> código de salida a secas.**

---

## Dónde estamos

`Plan §3`, filas del día 6: *"**SRCH-01** — capa presentacional"* y *"Máquina de estados de
la oferta (§7)"*. **Los dos cerrados.**

| Bloque | Ejecuta | Resultado |
|---|---|---|
| SRCH-01 · corrida 1 | Arnés | **Escalada 3/3.** Midió el contrato, no al modelo |
| SRCH-01 · contrato corregido | Claude Code | F-047 y F-048, dos reglas nuevas del formato |
| SRCH-01 · corrida 2 | Arnés | **Escalada 3/3**, por tres defectos reales. **Esta sí mide** |
| SRCH-01 · revisión a mano | Claude Code | **`+64 / −13`** sobre 1140 líneas |
| SRCH-01 · wiring en `App.tsx` | Claude Code | Cuelga de `Comprando`, subtítulo `Agente de búsqueda` |
| SRCH-01 · e2e | Claude Code | ✅ **verde el 11-ago.** F-050 (el `;`) desbloqueó la suite; 3 defectos de la propia suite corregidos (F-052). 41/41 |
| Máquina de estados · esquema | Claude Code | Migración **0007**, y F-043 y F-044 con ella |
| Máquina de estados · cliente | Claude Code | `lib/offers.ts` + migración **0008** (F-051) |

**Verificaciones, todas de hoy:**

| Verificación | Estado |
|---|---|
| `cd app && npm run typecheck` | **limpio** |
| `cd app && npm test` | **265 pasan** (14 ficheros) |
| `cd app && npx vitest run src/screens/search` | **58/58** de aceptación |
| `cd app && npm run check:palette` | cobertura completa |
| `python -m harness.tests.test_checks` | **52/52** |
| `python -m harness.graph.run … --seco` | 3/3 escenarios |
| `cd app && npx playwright test` | ✅ **41/41 en la CI** (11-ago). En la máquina del PO no corre hasta que arregle la contraseña de alpha en su `.env` — ver `PENDIENTE-PO.md` §2 |

---

## Lo que hay que saber de SRCH-01

**La pantalla está en `app/src/screens/search/`** y cuelga del ítem `Comprando`
(SRCH-01 §2), con `veraSubtitle = 'Agente de búsqueda'` (SRCH-01 §5). Aquí spec y HTML
aprobado **coinciden**, así que no hay nada que resolver como en F-025.

**El reparto es el de la casa:** `SearchResults.tsx` es la pantalla —posee criterios, orden,
selección, carga y error—; `FilterChips.tsx` y `ResultsTable.tsx` son presentacionales. **El
estado vacío vive en `ResultsTable`**, no en la pantalla, igual que en MSG-01.

**⚠ `App.tsx` le pasa `now` explícito**, mismo criterio que MSG-01 y por la misma razón: se
construye en el render y **no se congela al montar**. La columna Antigüedad es tan sensible
al reloj como el timestamp relativo del hilo.

**Los tres defectos que hubo que corregir a mano**, y solo uno era grave:

1. **`ResultsTable`, `aria-sort`.** El artefacto comprobaba `col.sortable && col.key` en la
   clase y en el `onClick`, **pero no ahí**: con `sort` a null y `col.key` `undefined`,
   `undefined === undefined` da `true` y entra a leer `sort.direction` de un null. **No era
   un aviso de tipos: la tabla reventaba en el primer render sin ordenación**, que es el
   estado inicial de la pantalla.
2. Misma raíz — pasaba `col.key` posiblemente `undefined` a `onSort`.
3. **La ordenación iba con `onClick` sobre el `<th>`.** Funciona con ratón y **no existe con
   teclado**. Ahora es un `<button>` dentro del `<th>`, con foco visible.

**Lo que NO hubo que tocar**, y es el dato bueno: la consulta y su cancelación, la selección,
el ciclo de tres clics de la ordenación, los chips controlados, el estado vacío, el aviso de
recorte, el watcher deshabilitado con su motivo, el umbral de ≥2 y **el CSS entero**. C3 y C4
verdes los tres intentos de **las dos** corridas.

---

## Lo que hay que saber de la máquina de estados

**La mitad que manda está en la base**, no en cliente: el día 7 entra Realtime y dos
navegadores calculando el mismo estado discrepan, ganando el último que escribe.

- **0007** deriva `threads.state` desde los metadatos de sus elementos. Las cuatro reglas
  salen de `thread-lifecycle` y **el orden hace que el rechazo salga solo con sus dos ramas**
  — sin escribirlas como casos especiales, que es donde se cuela el que falta.
- **0008** impide que el emisor decida su propia oferta (F-051).
- `lib/offers.ts` **no reimplementa ningún invariante**: decide qué se le ofrece al usuario.

**⚠ LAS DOS MIGRACIONES ESTÁN SIN APLICAR AL REMOTO.** Hasta que se apliquen, `threads.state`
sigue sin mantenerse y el emisor sigue pudiendo aceptar su propia oferta.

**Verificado contra la siembra:** la derivación de 0007 reproduce **los cinco estados** que
`demo_threads.sql` escribió a mano el día 5, uno por badge. El único que se habría roto
—`CERRADO SIN ACUERDO`, que caería a `ABIERTO`— es el que protege la regla de transición
manual.

---

## Lo que el arnés midió hoy, y lo que no

**Dos corridas, seis intentos, $0.134904.** Las seis filas están en el CSV.

| | Corrida 1 | Corrida 2 |
|---|---|---|
| Coste real | $0.086187 | **$0.048717** |
| En frío | $0.103327 | $0.057428 |
| Tiempo | 33,5 min | **17,7 min** |
| Truncados (F-005) | 2 | **0** |
| Qué midió | **el contrato** | **el modelo** |

**Las tres filas de la corrida 1 no miden al Coder** y hay que leerlas con eso delante: C1
estuvo rojo por un `vi.fn()` sin tipar en mi propio contrato de aceptación —con los mocks
tipados, `tsc` sale limpio sobre las 1076 líneas del Coder— y de los 18 tests de C2 en rojo,
los verificados uno a uno **no eran defectos del artefacto** (F-047).

**Las tres de la corrida 2 sí miden.** El dato: **el modelo recibió la salida exacta de `tsc`
en el feedback de los intentos 2 y 3 y no la resolvió ninguna de las dos veces.** Es la misma
forma que F-036.

**Y el contrato más apretado sale a mitad de precio y en la mitad de tiempo.** Es el dato más
accionable del día para el objetivo 4.

---

## Hoy toca — Día 7 (11-ago-2026)

`Plan §3`, filas del día 7 — **son dos bloques**:

| Trabajo | Ejecuta |
|---|---|
| **MSG-02 (hilo)** — la pantalla más compleja del MVP | Arnés + revisión a mano |
| **Realtime**: hilos y mensajes propagando entre sesiones | Claude Code |

**Antes de lanzar el arnés con MSG-02, y esto es de hoy:**

1. **El contrato de aceptación tiene que compilar ANTES de gastar un token, y sus helpers
   tienen que haberse ejecutado al menos una vez** (F-047). Un `typecheck` con los módulos
   del Coder aún sin escribir da rojo esperado, **y ese rojo tapa el del contrato**. Un
   contrato solo se verifica contra una implementación, aunque sea un esqueleto vacío.
2. **Todo literal que ve el usuario va verbatim en la tarea, con sus acentos** (F-048). La
   prosa del JSON va sin acentos por convención; los literales no. Cinco tests suspendieron
   por caracteres que el modelo reprodujo exactamente como se le pidieron.
3. **Los tests asertan sobre lo que la spec exige y sobre lo declarado en `component_api`,
   nunca sobre una elección de implementación que el contrato dejó libre** (F-047).
4. **Cuando el mock y la spec ofrecen dos caminos para la misma acción, la tarea elige uno
   explícitamente** (F-049), o el contrato pide los dos y el `component_api` solo soporta uno.
5. **`app/scripts/check-palette.mjs` verde antes**, o C3 juzga con un sistema de diseño
   incompleto (F-003).
6. **Commits separados** (`CLAUDE.md` §1.6). El diff del segundo *es* la medida.
7. **Un escalado no se canaliza.** Lanzar sin `| tail`: la tubería se come el código de
   salida 2 que `Dia-04 §1` puso para que un escalado se vea (F-046).

**MSG-02 es el riesgo estructural del plan** y hoy tiene a favor que `thread-lifecycle` ya
está derivado en la base (0007) y que MSG-01 dejó el patrón pantalla/presentacional resuelto.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Tope de intentos | **3**, y el tercero escala al humano con código de salida 2. | `Dia-04_decisiones_arnes.md` §1 |
| **Formato de tarea** | Congelado el día 4. **Tres desviaciones: `component_api` (día 5), literales verbatim y estado accesible declarado (día 6).** | `Dia-04` §5 · F-034 · F-047 · F-048 |
| **Estados de oferta** | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. La última es **terminal** y la contraoferta es **fila nueva**. **El `Plan §7` dibuja otra máquina y no manda** (F-043). | `messaging-and-negotiation` · offer-card |
| **Quién decide una oferta** | **El receptor, nunca el emisor.** RLS deja escribir a los dos; lo acota `app.guard_offer_decider` (0008). | `offer-card` · F-051 |
| **Oferta expirada** | **Sigue siendo aceptable.** La fecha informa, no vincula en V1. | `offer-card` · F-051 |
| **`shipping_cost` no informado** | `null`, **nunca `0`**. Un cero dice "portes gratis", no "no informado". | `offer-card` |
| Estados de hilo | Los **cinco** del CHECK de 0003. **Derivados en la base desde 0007**; `CERRADO SIN ACUERDO` y la reversión son manuales. | `0003` · `0007` · MSG-01 §3 |
| **Cierre del hilo** | **Irreversible.** Cuatro specs aprobadas lo dicen y en un hilo cerrado *"el campo de mensaje desaparece"*: no se reabre escribiendo porque no se puede escribir. | MSG-02 §6 y §7 · MSG-03 §7 · MSG-01 §3 · F-045 |
| Test-runner | **Sin LLM.** C5 lo da el PO, fuera del grafo. | `Dia-04` §4 |
| Checks | Un check que no se puede ejecutar es **rojo**, nunca ausente. **Correcto para decidir; insuficiente para medir** (F-033). | F-015 · F-033 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan, **y tampoco los ve**. | `CLAUDE.md` §3 · Plan §6 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Demo | Referencia **`6205-2RS`** y **seis organizaciones**, solo dos con cuenta. | `guion-demo-y-siembra.md` §1 y §3 |
| Turquía | `continent = 'AS'`, geoscheme de la ONU, para que el chip de zona "Europa" corte. | `guion-demo-y-siembra.md` §3 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. **El HTML aprobado tampoco tiene columna de precio** — verificado hoy. | `conversational-search` · Out of Scope · F-040 |
| Watchers | **Fuera** (SRCH-03, `Plan §9`) y sin tabla en el esquema. El botón se pinta **deshabilitado y con el motivo**. | `Plan §9` · F-023 e |
| Alcance | 8 pantallas. **Hechas: shell, INV-01, MSG-01, SRCH-01.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Ver `openspec/mvp/PENDIENTE-PO.md`** — se ha escrito hoy con las instrucciones paso a paso
de cada punto. Resumen por urgencia:

1. ✅ **F-050 · la clave publicable.** **Resuelto el 11-ago:** sobraba un `;`. Solo queda
   repegar el secret `SUPABASE_PUBLISHABLE_KEY` de GitHub, que arrastra el mismo pegado.
2. 🔴 **F-038 · rotar la contraseña de `alpha`.** Ya no es solo seguridad: **es lo único que
   bloquea los 40 e2e**, la CI y la puerta de S1. La de `.env` no coincide con la de Supabase
   (`invalid_credentials` solo para alpha; beta autentica), y el valor bueno no está en el
   repo. Rotarla y ponerla en `.env` + secret cierra las dos cosas de un golpe.
3. 🟠 **Aplicar las migraciones 0007 y 0008.** Sin ellas `threads.state` no se mantiene y el
   emisor puede aceptar su propia oferta.
4. 🟠 **`RETIRADA`** (F-043b) — antes del día 8, que es cuando se construye VND-01.
5. 🟠 **Reapertura del hilo tras cierre** (F-045) — **hoy es barato y el día 7 ya no**, porque
   mañana se construye MSG-02, que es donde vive el botón de cerrar.
6. 🟠 **F-033 · el CSV no distingue un check en rojo de uno inejecutable.** Con el formato de
   hoy, "intentos hasta verde" no es fiable. **Las tres filas de la corrida 1 de hoy son un
   caso nuevo del mismo problema.**
7. 🟠 **F-027 (a) · el recuento de no leídos de MSG-01.** En el MVP queda fuera.
8. 🟠 **Diseño de la pantalla de login** (F-016). Es una novena pantalla que nadie planificó y
   es la primera que ve el socio.
9. **¿Los cinco hilos sembrados son los de la demo del día 11?**
10. **¿Qué hace INV-01 con una línea eliminada?** (F-023 d). No urge.
11. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
12. **La app no tiene URL desplegada.** Decisión del PO el 7-ago: solo local. **Se retoma
    antes del día 11**, que es la primera sesión de prueba.

---

## Riesgo con la vista más corta

**El riesgo de hoy es que la CI lleva NUEVE días roja y hoy se ha descubierto que la causa
que este fichero daba por identificada no era la causa.** F-037 se cerró ayer con *"lo
arregla volver a pegar el secret, y es lo único"*. Se repegó, la guardia de ISO-8859-1 dejó
de disparar — y Supabase sigue devolviendo 401. **La regla que sale de aquí: una causa
encontrada no es la única causa, y un diagnóstico no está cerrado hasta que el verde lo
confirma.** Nadie corrió el e2e después de repegar el secret.

**El segundo riesgo es que el arnés lleva dos pantallas escalando 3/3.** MSG-01 escaló, SRCH-01
escaló dos veces. Pero el reparto de culpas cambia: hoy, por primera vez, se separó lo que
falla por el contrato de lo que falla por el modelo, y **el contrato era la mitad cara**. Si
mañana MSG-02 escala con el contrato ya verificado, entonces sí es un dato sobre el modelo y
hay que replantear el objetivo 4 con él delante — no antes.

**El tercero es de mañana y es de calendario: MSG-02 es la pantalla más compleja del MVP y hoy
se han gastado dos corridas y una revisión a mano en SRCH-01.** A favor: `thread-lifecycle` ya
está derivado en la base, `lib/offers.ts` existe, y el patrón pantalla/presentacional está
resuelto y probado dos veces. Si el día 7 no está, se simplifica el hilo (`Plan §9`, orden de
recorte).

---

*Cerrado el 10-ago-2026 · Claude Code (Opus 5)*
