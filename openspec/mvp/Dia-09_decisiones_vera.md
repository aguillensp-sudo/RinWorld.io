# Día 9 · VERA · decisiones antes de escribir una línea

> ## ✅ CONTESTADO POR EL PO EL 12-AGO, ANTES DE ESCRIBIR CÓDIGO
>
> | Decisión | Respuesta | Efecto |
> |---|---|---|
> | **D-09-01** | **Las cuatro del documento** | Buscar en catálogo · Consultar mi inventario · Listar mis hilos (metadatos) · Navegar |
> | **D-09-02** | **(a)** dice que no puede **y explica por qué**, una vez, en una frase | Entra en el bloque estático del system prompt |
> | **D-09-03** | **(a)** C2 corre **siempre** el e2e completo | Se aplica antes de lanzar PANEL-01 |
> | **D-09-04** ⬅ nueva, no estaba anoche | **(b)** el PO puso la clave en el dashboard | **VERA responde.** Caché verificada: 2119 tokens leídos en la 2ª llamada |
>
> **Y una corrección de premisa que conviene que no se pierda.** El PO contestó a D-09-04
> *"ahora mismo me he logueado a Supabase desde el terminal, por tanto deberías poder hacerlo
> tú"*. **Se comprobó antes de darlo por bueno, y no era así** — F-073.

> **Día de decisiones irreversibles** (`CLAUDE.md` §ritual, junto al 4 y al 8). Escrito la noche
> del 12-ago, antes de empezar.
>
> **Y escrito con la regla del día 8 delante (F-065):** aquí no se afirma que algo "está
> comprobado". Cada cosa que ya está decidida va **con su puntero al fichero y línea**, para que
> se pueda seguir. Lo que no lleva puntero es porque está genuinamente abierto.
>
> `Plan §3`, día 9: *"Las 4 herramientas de VERA + Edge Function proxy"* · *"**SRCH-01** —
> cableado VERA↔chips"* · *"PANEL-01"* (arnés).

---

## 0 · Lo que YA está decidido y no se toca

**Esto es la mitad del valor del documento.** Tres de las cuatro cosas que parecían decisiones del
día 9 ya están cerradas en documentos que no se pueden contradecir, y llegar mañana creyendo que
están abiertas es cómo se reabre un spec cerrado por error.

| Parece una decisión | Ya está decidido | Puntero |
|---|---|---|
| ¿La clave de Sonnet va al navegador? | **No. Edge Function proxy, punto no negociable** | `Plan §S2` · `CLAUDE.md` |
| ¿VERA lee el contenido cifrado de los hilos? | **No.** Mensajería se expone *"solo metadatos y redacción en claro"* | `specs/vera-agent/spec.md:221` |
| ¿VERA pide confirmación antes de una acción irreversible? | **Sí**, y describiendo el efecto con cifras | `spec.md:77` (`irreversible-action-confirmation`) |
| ¿Qué hace ante un mensaje ambiguo? | Hay requirement propio con umbral (*más de tres lecturas*) | `spec.md:108` (`ambiguity-handling`) |
| ¿Puede memorizar el estado entre preguntas? | **No.** Invoca la herramienta en cada ocasión | `spec.md:181` (`realtime-platform-state-layer`) |
| ¿Puede escalar privilegios? | **No.** Actúa siempre con los permisos del usuario autenticado | `spec.md:223` |

> **Consecuencia práctica de la segunda fila, que conviene ver antes de mañana:** VERA **no puede
> resumir un hilo**. El servidor no tiene la clave —esa es toda la rebanada E2EE del día 8— así que
> ninguna herramienta del proxy puede leer un mensaje. Si en la demo del día 11 alguien le pide a
> VERA que resuma una negociación, la respuesta correcta es que no puede, y hay que decidir **cómo
> lo dice** (ver D-09-02).

---

## 🔴 D-09-01 · Cuáles son las cuatro herramientas

El `Plan §3` dice **"las 4 herramientas"** sin nombrarlas. El spec expone **siete** áreas como
herramientas invocables (`spec.md:219-224`): búsqueda, inventario, watchers, mensajería (metadatos),
billing, foro y onboarding. **Hay que elegir cuatro, y es irreversible en el sentido que importa:
define lo que VERA sabe hacer delante del socio el día 11.**

**Lo que yo elegiría, y por qué:**

| # | Herramienta | Por qué entra |
|---|---|---|
| 1 | **Buscar en catálogo** | Es el día 9 entero: `SRCH-01` es "consulta en lenguaje natural → filtros → tabla". Sin esta no hay cableado que hacer |
| 2 | **Consultar mi inventario** | La pantalla existe y tiene datos reales desde el día 3. Coste casi cero |
| 3 | **Listar mis hilos (metadatos)** | Estado, contraparte, fecha. **Es lo que hace visible que VERA no lee el contenido**, que es la historia que se quiere contar el día 11 |
| 4 | **Navegar** | `spec.md:205` la trata aparte: NAVEGACIÓN va sin confirmación. Es la más barata y la que más impresión de agente da |

**Fuera quedarían** watchers, billing, foro y onboarding: los cuatro tienen pantalla fuera del MVP
(`Plan §9`), así que una herramienta que los tocara devolvería datos que el usuario no puede ver.

**Lo que necesito de ti: sí a estas cuatro, o cuáles cambias.**

---

## 🔴 D-09-02 · Qué dice VERA cuando no puede

`CLAUDE.md` §7 fija el riesgo #1 del proyecto: **VERA afirmando con aplomo algo que no sabe.** El
spec cubre el caso *ambiguo* (`spec.md:108`) pero **no el caso "no tengo acceso a eso"**, que
después del día 8 es el más frecuente de los dos: todo el contenido de los hilos entra ahí.

Hay que fijarlo **antes** de escribir las herramientas, porque cambia el contrato de aceptación de
las cuatro.

| | Opción |
|---|---|
| **(a)** | **VERA dice que no puede y explica por qué**, una vez, en una frase: *"No puedo leer el contenido de los hilos: va cifrado y el servidor no tiene la clave."* |
| **(b)** | VERA dice que no puede, sin explicar |
| **(c)** | VERA lo intenta con lo que tiene (metadatos) y avisa de que es parcial |

**Recomiendo (a).** Es la que convierte una limitación en el argumento de venta —el socio del día
11 está ahí por eso— y es la única de las tres que no se parece a una excusa. **(c) es la
peligrosa**: "responder con lo que hay" es exactamente la forma que toma inventar.

---

## 🟠 D-09-03 · F-070, antes de lanzar PANEL-01 al arnés

Los cuatro checks del arnés **no ven el e2e**: LOGIN-01 salió 4/4 verde y colgaba la suite entera.
PANEL-01 es tarea de arnés del día 9, así que esto se decide antes, no después.

| | Opción |
|---|---|
| **(a)** | C2 corre **siempre** la suite e2e completa. Más lento y más caro por intento, cero huecos |
| **(b)** | La tarea **declara** los ficheros e2e que la cubren. Rápido, y el hueco vuelve en cuanto alguien no declare |

**Recomiendo (a) para el MVP.** El coste es minutos de CPU; el de (b) fue una contraseña en un
artefacto descargable (F-038 + F-070).

---

## ✅ D-09-04 · Cómo llega `ANTHROPIC_API_KEY` a la Edge Function — CERRADA (b)

> **Contestada el 12-ago por la vía (b): el PO puso la clave en el dashboard de Supabase.**
> **VERA responde.** Primera corrida real verificada, y deja tres medidas:
>
> | Qué se comprobó | Resultado |
> |---|---|
> | Llamada a herramienta | *"busca 6205-2RS en Europa"* → `buscar_en_catalogo` con `{referencia:"6205-2RS", zona:"EU"}`. Tradujo el continente al enum sin ayuda |
> | **El caso D-09-02** | Ante *"resúmeme la negociación con Anadolu"* dijo que no puede, explicó por qué y **ofreció los metadatos**. No cayó en la opción (c) |
> | **Prompt caching** | Llamada 1: `cache_creation_input_tokens: 2119`. Llamada 2: `cache_read_input_tokens: 2119`. El bloque estático mide **2119 tokens**, por encima del mínimo de 1024 de Sonnet 4.6 — que era justo lo que podía fallar en silencio |
>
> ⚠ **La frase de D-09-02 la PARAFRASEA, no la reproduce literal**: dijo *"va cifrado extremo a
> extremo y el servidor no tiene la clave"*. El sentido y la forma son los correctos y el literal
> exacto no se puede forzar desde el prompt — **el contrato comprueba que la frase está en el
> prompt, no que el modelo la repita**, que es lo único comprobable.
>
> Y la comprobación que hizo falta al recibir la clave: `ANTHROPIC_API_KEY` en `app/.env` **no
> lleva prefijo `VITE_`**, así que Vite no la empaqueta — verificado además contra el bundle
> construido (`grep sk-ant- app/dist/` sin coincidencias) y contra el árbol versionado (solo
> marcadores tipo `sk-ant-tu-clave-aqui`). `app/.env` está ignorado por `app/.gitignore:16`.

### Lo que estuvo abierto durante el bloque 1, y por qué

**No estaba en el documento de anoche, y bloquea el único paso del bloque 1 que no puedo dar
solo.** Sale de mirar el terreno antes de escribir: no existe `supabase/functions`, la CLI está
instalada (2.109.0) pero **no logueada en la cuenta que hace falta**, y **el MCP de Supabase
despliega funciones pero no gestiona secrets** — no hay tool para eso en todo su catálogo.

**La premisa de la primera respuesta no se sostuvo, y se comprobó antes de actuar (F-024, F-065):**

| Comprobación | Resultado |
|---|---|
| `npx supabase projects list` | `web-julsaindustrial` y `Base de Conocimientos`, org **`mjxnlvvrnjuuawlxkmte`**. **`troxminloxkjwihwfevs` no está** |
| `npx supabase secrets list --project-ref troxminloxkjwihwfevs` | **403** · *"Your account does not have the necessary privileges"* |
| `list_projects` por el MCP | Sí ve **`MVP_RinWorld.io`** (`troxminloxkjwihwfevs`), org **`ujatcozvbspkycepemfq`** |

**Son dos cuentas distintas.** La CLI está logueada en la del web de Julsa; el MVP vive en la
otra, que es la que aplicó las migraciones del día 8 por el MCP. De ahí el reparto de hoy:
**desplegar la función sí puedo** (MCP), **poner el secret no**.

| | Opción | Coste |
|---|---|---|
| **(a)** | `npx supabase login` **en la cuenta de `ujatcozvbspkycepemfq`**. Después yo hago `secrets set` + `functions deploy` leyendo la clave del entorno de usuario — donde ya está, 108 chars — sin que pase por pantalla ni por fichero, como F-071 | Un login tuyo |
| **(b)** | La pegas tú en el dashboard: Supabase → Edge Functions → Secrets. Yo despliego por el MCP | Dos clics tuyos |
| **(c)** | No se despliega hoy | Gratis hoy; quedan tres días para el socio |

**Mientras tanto no se para nada:** `CLAUDE.md` §5 obliga igualmente a que todos los tests de
unidad mockeen el cliente LLM, así que el proxy y las cuatro herramientas se escriben y se
verifican enteros sin la clave. **Lo único que no se puede hacer es la corrida real contra
Sonnet.**

---

## D-09-05 · Dónde se ejecutan las herramientas — decidido, y se deja escrito porque no es obvio

**El proxy no toca la base. Las herramientas se ejecutan en el navegador.**

Parece la decisión perezosa y es la contraria: es la que hace **estructural**, y no confiada, la
garantía de `spec.md:223` — *"actuando siempre con los permisos del usuario autenticado sin
posibilidad de escalar privilegios"*.

- Si las herramientas corrieran en la Edge Function, el servidor necesitaría credenciales para
  leer datos **en nombre de** alguien, y esa garantía pasaría a depender de que el código las use
  bien. **En el navegador la impone RLS con el JWT del usuario, que es donde ya vive** — y la capa
  de datos existe y está probada desde los días 3, 6 y 7 (`inventory.ts`, `threads.ts`, `search.ts`).
- La función se queda con **una sola responsabilidad: guardar la clave de Sonnet**. No lee ni una
  fila, así que comprometerla no expone datos de nadie.
- Y hace `Navegar` posible sin inventar nada: navegar es un efecto de interfaz, y el sitio donde
  ocurre es el cliente.

**El precio, y va dicho:** un cliente manipulado puede devolverle a VERA un resultado de
herramienta falso. **No hay ganancia de privilegio** —se estaría engañando a sí mismo, sobre sus
propios datos— así que para el MVP se acepta. En V1, con acciones de escritura, esto se revisa.

**Consecuencia de diseño que ya estaba escrita desde el día 6:** VERA escribe **criterios**, no
chips. `search.ts:154` lo dejó dicho — *"Si los chips fueran su propio estado habría dos verdades
sobre qué se está filtrando … y acabarían separándose en cuanto VERA escriba sobre una de las dos
el día 9"*. Los chips se derivan; VERA no los toca.

---

## Lo que hago hoy, ya contestado

1. Edge Function proxy, con la clave de Sonnet solo en el entorno de Supabase. **Se escribe y se
   prueba; el despliegue vivo espera a D-09-04.**
2. Las cuatro herramientas de D-09-01, con su contrato de aceptación **en rojo total antes de
   lanzarlas** (F-058), y cada aserto negativo visto fallar contra su caso positivo (F-059).
3. `SRCH-01` · cableado VERA↔chips.
4. `PANEL-01` por el arnés, con la rúbrica ya corregida según D-09-03 **(a)**.

---

*Escrito el 12-ago-2026 · Claude Code (Opus 5) · contestado y ampliado el mismo 12-ago*
