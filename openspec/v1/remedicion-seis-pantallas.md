# Remedición a seis pantallas — 21-sep-2026

> **Veredicto: «Funciona con supervisión» — escenario base, 21 semanas, la corriente B con dos
> agentes.** Es el mismo veredicto del H1 (Día 16). Fallan la cifra 3 y la cifra 5; ninguna
> escalada cuenta; mediana de corrección ~0 %, máxima 14,5 %.
>
> **Este veredicto depende de la decisión 1 (abajo).** Contando como cuenta el arnés, `FORO-03` y
> `ADMIN-02` son dos escaladas y la regla de `UMBRAL-FABRICA-V1.md` §4 diría «No rinde». El PO
> decidió el 21-sep que no cuentan. Queda escrito aquí para que nadie lo lea sin verlo.

`UMBRAL-FABRICA-V1.md` **no se ha tocado**: los umbrales son los de tres pantallas, aplicados
proporcionalmente a seis (el umbral solo dice «remedir a las seis» y no fija números nuevos).

## Las tres decisiones del PO (21-sep-2026)

| # | Decisión | Por qué era una decisión |
|---|---|---|
| 1 | **Las escaladas de `FORO-03` (`F-174`) y `ADMIN-02` (`F-183`) NO cuentan para la cifra 2.** Sin repetir las corridas | Las dos escalaron por un defecto del contrato de aceptación, no del artefacto. `UMBRAL` §5.3 dice que una corrida cuyo veredicto no depende del artefacto no mide al Coder y se repite entera; el PO optó por no repetirlas. `F-161`/`F-162` aplicaron esa misma regla. `F-166` decidió lo contrario para `ADMIN-01` |
| 2 | **Cifra 3: se queda en 1 de 6 «contando como siempre».** No se elige entre las dos lecturas | Con el umbral proporcional (≥ 2 de 3 = ≥ 4 de 6) falla en las dos: 1 de 6 o 2 de 6 |
| 3 | **`F-172` cuenta como corrección de C5 en `FORO-02`** | Era un vacío de spec (estándar de buscador nuevo), no un defecto del Coder. Contarlo es lo estricto |

## Las ocho cifras

| # | Cifra (umbral de tres, proporcional a seis) | Resultado | Fuente | |
|---|---|---|---|---|
| 1 | Pantallas aceptadas (todas) | **6 de 6** | C5 del PO: H1 el 17-sep; `FORO-02`, `FORO-03`, `ADMIN-02` el 21-sep | ✅ |
| 2 | Corridas sin escalada (todas) | **6 de 6** (decisión 1) | `harness-metrics.csv`. Contando como el arnés: 4 de 6 | ✅ |
| 3 | Verdes al primer intento (≥ 2 de 3 = ≥ 4 de 6) | **1 de 6** (`FORO-02`). Verificado con contrato corregido: 2 de 6 (+`ADMIN-02`) | columna `primer_intento_limpio` | ❌ |
| 4 | Corrección humana: mediana ≤ 10 %, ninguna > 25 % | Mediana **~0 %**, máxima **14,5 %** (`FORO-02`) | `git`, lo tocado desde el commit del Coder | ✅ |
| 5 | Ficheros sin tocar: ≥ la mitad en cada una | **`FORO-02`: 0 de 2** — las demás ≥ 50 % | `git`, ídem | ❌ |
| 6 | Coste del generador ≤ 0,25 $ por pantalla, reintentos incluidos | 0,037 $ a **0,237 $** (`ADMIN-02`, 5 % de margen) | `harness-metrics.csv` | ✅ |
| 7 | Coste de orquestación: mediana ≤ 50 $, ninguna > 100 $ | **Sin veredicto**: no hay medida limpia | `orchestration-metrics.csv` | — |
| 8 | Tiempo de reloj ≤ 1 jornada por pantalla, sin esperas del PO | **Sin veredicto**: no está instrumentado | — | — |

### Por pantalla

| Pantalla | Corrida oficial | Intentos | Arnés | Primer intento limpio | Generador | Corrección humana | Ficheros sin tocar |
|---|---|---|---|---|---|---|---|
| `DIR-01` | 14-sep | 2 | PASA 4/4 | no | 0,0448 $ | 0 % (C5 17-sep) | 100 % |
| `ADMIN-01` | 14-sep | 2 | PASA 4/4 | no | 0,0547 $ | 0 % (C5 17-sep) | 100 % |
| `FORO-01` | 13-sep | 2 | PASA 4/4 | no | 0,1014 $ | 0 % (C5 17-sep) | 100 % |
| `FORO-02` | 17-sep | 1 | PASA 4/4 | **sí** | 0,0373 $ | **+16/−77 de 641 = 14,5 %** (`F-172` + `F-186`) | **0 de 2** |
| `FORO-03` | 18-sep | 3 | ESCALADO 2/4 (`F-174`, no cuenta) | no | 0,1431 $ | +6/−0 de 752 = 0,8 % (`F-186`) | 1 de 2 |
| `ADMIN-02` | 20-sep | 3 | ESCALADO 3/4 (`F-183`, no cuenta) | no; con contrato correcto, sí | 0,2366 $ | 0/1 594 = 0 % | 8 de 8 |

Las cifras de `DIR-01`, `ADMIN-01` y `FORO-01` (0 % y 100 %) son las del Día 16
(`git show fc9f34e:openspec/v1/ESTADO-V1.md`); no se han vuelto a medir desde `git`.

## Lo que hay que saber de cada cifra

- **Cifra 4 y `F-172` sobre `DIR-01`.** `F-172` también reescribió 110 líneas de `DIR-01`
  (13,7 % de 804) **después** de su C5, migrándola al estándar de buscador. No se cuenta como
  corrección de C5 —`DIR-01` ya estaba aceptada— y se declara aquí. Si contara, la mediana subiría
  a ~0,4 % y la máxima seguiría en 14,5 %: el resultado no cambia.
- **Cifra 4, `FORO-02`: la suma correcta son 93 líneas.** El commit `21b3d53` (18-sep) cambió
  +12/−11 en `ForumCategory.tsx` para que el título abra `FORO-03`; es la precondición de esa
  pantalla, no una corrección de C5, y no se cuenta. **Una primera versión de esta remedición lo
  contó y daba 18,1 %.** Corregido antes de escribir.
- **Cifra 5.** Falla solo por la decisión 3: con `F-172` fuera, `FORO-02` tendría 1 de 2
  y la cifra cumpliría.
- **Cifra 6 y las corridas anuladas.** Se suma el coste de la corrida oficial de cada pantalla,
  como en el Día 16. Sumando también las repetidas por `F-161`/`F-162` (13-sep), `ADMIN-01` sería
  0,317 $ y superaría el 0,25 $. No se cuentan porque esas corridas se anularon por el instrumento.
  No se han contado los brazos del experimento con Atria.
- **Cifra 7.** El medidor da **deltas de sesión, no de pantalla**, y en cuatro de las seis
  pantallas la sesión venía sucia (`F-163` y el Día 20). Lo medido: `ADMIN-01` 3,46 $ (limpio),
  `FORO-01` ≈ 0,06 $, `FORO-03` 7,82 $ (techo). `DIR-01` y `FORO-02`, sin línea base limpia.
  `ADMIN-02`: las tres sesiones del 19-20-sep suman **190,50 $** (la mayor, 176,09 $ en Opus,
  incluye el experimento de dos brazos, el cambio del arnés y cinco hallazgos): es un techo, no
  el coste de la pantalla. **Nada de esto produce una mediana válida, y ninguna medida limpia se
  acerca a 50 $.** La regla «No rinde» exige una mediana por encima de 100 $: no hay ningún dato
  que la sostenga, ni que la descarte con rigor.
- **Cifra 8.** No existe reloj. Por calendario, `ADMIN-02` ocupó parte de tres jornadas
  (18-20 sep) aunque buena parte del 20 fue el experimento. No se da por cumplida ni incumplida.

## Errata contra el propio relevo (regla 2)

El Día 20 de `ESTADO-V1.md` decía que `F-161`/`F-162` *«fijaron que una escalada cuenta sea cual
sea la causa»*. **Es al revés para la cifra 2:** las dos filas del registro aplican `UMBRAL` §5.3,
no cuentan las escaladas por el instrumento y repiten la corrida. Lo que sí cuenta el instrumento
es la cifra 3. Registrado como `F-187`.

## Lo que este veredicto NO dice

- **No mide las 18 pantallas que faltan.** Seis de veinticuatro.
- **Dos cifras de ocho no tienen veredicto** (7 y 8), y las dos son las que hablan de coste y de
  tiempo. Antes de dar por buena la extrapolación del plan (`UMBRAL` §6) hay que arreglar cómo se
  miden: **una sesión por pantalla para la 7, y un cronómetro con las esperas del PO descontadas
  para la 8**, desde la séptima pantalla.
- **La cifra 3 mide el contrato de aceptación tanto como al Coder** (`F-166`, `F-174`, `F-183`:
  tres de seis pantallas puntuadas por un defecto propio). `FORO-02` es la única que llegó limpia
  a la primera, y `ADMIN-02` la habría llegado con el contrato correcto.
- **El veredicto cambia con la decisión 1.** Es lo que el PO decidió, no lo que dice el texto
  literal de la regla.
