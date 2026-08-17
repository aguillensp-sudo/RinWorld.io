# Pendiente del PO · cerrado el día 8 (12-ago-2026)

> ⛔ **FICHERO DESFASADO. NO ES LA LISTA VIVA — no actúes sobre nada de lo de abajo.**
> Lo declaró el PO el **17-ago (día 15)**: *"PENDIENTE-PO olvídalo, es fichero desfasado"*.
>
> Dice de sí mismo que se sobrescribe a diario y lleva **desde el día 8 sin tocarse**, siete
> jornadas. Eso lo convierte en una trampa para quien lo abra buscando qué hay pendiente:
> lo de abajo está cerrado, caducado o superado.
>
> **La lista viva es `ESTADO.md`, sección «Pendiente de Álvaro».** Esto se queda como
> histórico del día 8 y por nada más.

> **Fichero de una sola cara.** Se sobrescribe cada día como `ESTADO.md`. Lo de ayer vive en git;
> tus respuestas del día 7 están en `PENDIENTE-PO-respuesta.md`.

---

## ✅ Lo que se cerró hoy y ya no tienes que mirar

Los **ocho puntos** del pendiente del día 7, más cuatro cosas que salieron por el camino:

| | Cómo quedó |
|---|---|
| **D-08-01/02/03** · claves de demo, envío libre, esquema | Cerradas por ti. La rebanada E2EE funciona extremo a extremo |
| **F-064** · el arnés medía con un instrumento roto | Cerrado **con dato**: mismo trabajo, solo cambia el bucle → de escalado 3/3 a verde en 2, $0,0178 |
| **F-033** · el CSV no distinguía rojo de inejecutable | Cerrado. Tercer estado por check, y **la métrica del objetivo 4 se movió** a `harness-review.csv` |
| **F-054** · dos rutas de despliegue de migraciones | Cerrado. Y ver abajo: el `supabase link` **se descartó**, no hacía falta |
| **F-063** · commits del arnés dejaban la CI roja | Cerrado con la convención `[skip ci]` |
| **F-016** · pantalla de login | Construida por el arnés. Verde al primer intento, `−2` líneas de revisión |
| **URL desplegada** | ✅ **Desplegada.** Ver el punto 1: queda un interruptor |
| **`SUPABASE_SERVICE_KEY` de GitHub** | ✅ Puesto, junto con `DEMO_KEY_SEED`. No tuviste que tocarlo |
| **F-071** · el secret que nadie leía | Cerrado. **CI verde 49/49**, la primera desde el 11-ago 19:54 |
| **F-072** · el primer despliegue falló | Cerrado. `tsconfig.build.json` |

> **`supabase link` se descarta y no vuelve a la lista.** Era para tener la CLI como ruta oficial
> de migraciones de cara a V1, no para nada operativo. El remoto está verificado en sync
> (`0001`…`0012`, nada pendiente), así que no bloquea. Se retoma cuando haya una migración nueva.

---

## 🔴 1 · Un desplegable, y sin él no hay demo

**Vercel activa *Deployment Protection* por defecto.** Ahora mismo la URL redirige al login de
Vercel (`https://vercel.com/sso-api?url=…`), así que **tu socio vería una pantalla de Vercel
pidiéndole cuenta, no la app**.

**Project → Settings → Deployment Protection → Vercel Authentication → Disabled**

Cuando lo apagues, avísame: falta la verificación final contra la URL real —cabecera
`X-Robots-Tag`, `robots.txt`, y que el bundle publicado lleva lo que debe y ninguna clave de
servicio—, que ahora no se puede hacer porque el muro devuelve un 302 antes de llegar a la app.

---

## 🟠 2 · Dos decisiones del día 9, y son irreversibles

Mañana es uno de los tres días de decisiones que no se deshacen (`CLAUDE.md` §ritual). El detalle
está en **`Dia-09_decisiones_vera.md`**; aquí va lo que tienes que responder:

| | Decisión |
|---|---|
| **D-09-01** | **Cuáles son las cuatro herramientas.** El `Plan §3` dice "las 4" sin nombrarlas y el spec expone **siete** áreas (`specs/vera-agent/spec.md:219-224`). Llevo cuatro propuestas con su razón; solo hace falta un sí o un cambio |
| **D-09-02** | **Qué dice VERA cuando NO puede.** Después del día 8 es el caso más frecuente: todo el contenido de los hilos es ilegible para el servidor. El spec cubre lo *ambiguo* pero no esto, y `CLAUDE.md` §7 lo llama el riesgo #1 del proyecto |
| **D-09-03** | **F-070**, ver el punto 3 |

> **Lo que NO es decisión, y verificarlo ahorró plantearte tres preguntas falsas:** que la clave de
> Sonnet no llega al navegador (`Plan §S2`) y que **VERA no lee el contenido cifrado de los hilos**
> ya están cerrados en spec (`spec.md:221`, *"mensajería: solo metadatos y redacción en claro"*).
> **Consecuencia práctica para el día 11: VERA no puede resumir un hilo.** No es un límite del MVP,
> es la rebanada E2EE funcionando.

---

## 🟠 3 · F-070 · "verde 4/4" no es "verde"

Los cuatro checks del arnés **no ven el e2e**. LOGIN-01 salió 4/4 verde y colgaba la suite entera.
Para V1: **o C2 corre siempre la suite e2e completa, o la tarea está obligada a declarar los
ficheros e2e que la cubren.** Decide antes de la primera tarea del arnés del día 9 (PANEL-01).

---

## 🟠 4 · Dos cosas del despliegue que no he tocado a propósito

| | |
|---|---|
| **`@tabler/icons-webfont@latest`** (`app/index.html:20`) | `@latest` puede cambiar **solo**, entre hoy y el día 11. Si cambia de major, el shell se rompe visualmente la mañana de la demo sin que nadie toque nada. Fijar la versión es una línea; no lo hago porque puede alterar lo que hoy se ve, y eso hay que mirarlo antes |
| **Plan Hobby de Vercel** | Es **para uso no comercial** según sus términos. Demo privada a un socio es zona gris. Si esto se queda puesto más allá del día 11: Pro, o Cloudflare Pages |

---

## 5 · Preguntas menores, sin bloqueo

| | |
|---|---|
| 5.1 | **¿Los cinco hilos sembrados son los de la demo del día 11?** Ahora llevan contenido legible, así que la pregunta es **qué dicen**. Los textos están en `supabase/seed/demo-content.mjs`, un solo sitio |
| 5.2 | **F-027 (a)** · recuento de no leídos de MSG-01. Fuera del MVP. Para V1: o `thread_read_receipts` con su RLS, o se retira del spec |
| 5.3 | **F-023 (d)** · qué hace INV-01 con una línea eliminada. O quinto chip "Eliminados" con restaurar, o eliminar es definitivo |
| 5.4 | **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa? |

---

## Orden que yo seguiría

1. **El desplegable de Vercel** (punto 1). Un minuto, y sin él no hay demo.
2. **Las dos decisiones del día 9** (punto 2), antes de que empiece el trabajo de mañana.
3. **F-070** (punto 3), antes de lanzar PANEL-01 al arnés.
4. El resto cuando quieras.

---

*Escrito el 12-ago-2026 · Claude Code (Opus 5)*
