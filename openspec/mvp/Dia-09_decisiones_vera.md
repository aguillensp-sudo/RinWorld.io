# Día 9 · VERA · decisiones antes de escribir una línea

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

## Lo que hago mañana en cuanto contestes

1. Edge Function proxy, con la clave de Sonnet solo en el entorno de Supabase.
2. Las cuatro herramientas de D-09-01, con su contrato de aceptación **en rojo total antes de
   lanzarlas** (F-058), y cada aserto negativo visto fallar contra su caso positivo (F-059).
3. `SRCH-01` · cableado VERA↔chips.
4. `PANEL-01` por el arnés, con la rúbrica ya corregida según D-09-03.

---

*Escrito el 12-ago-2026 · Claude Code (Opus 5)*
