# Despliegue de la app · runbook

> **Decidido el 12-ago-2026 por el PO.** Se despliega **con** semilla de demo, la semilla vive
> **solo en el entorno *Production*** (no en *Preview*), la URL **no se indexa**, y queda escrito
> que **muere en V1**. Datos inventados, riesgo acotado, demo que funciona.
>
> Esto sustituye a la decisión del 7-ago (*"solo local, se retoma antes del día 11"*), que ya
> había cumplido su plazo: quedaban tres días para la sesión con el socio.

---

## 0 · Por qué esto es fácil

La app es un **SPA estático**: Vite + React, **sin router**. Toda la navegación es estado de
`App.tsx`, así que no hay rutas de servidor, no hay funciones, no hay rewrites que configurar.
El build produce tres ficheros:

```
dist/index.html                 1,00 kB
dist/assets/index-*.css        60,08 kB │ gzip  10,49 kB
dist/assets/index-*.js        426,67 kB │ gzip 122,07 kB
✓ built in 284ms
```

Eso lo sirve cualquier hosting estático. **Vercel es la elección del PO**; Cloudflare Pages o
Netlify servirían igual y sin la cláusula del §7.

---

## 1 · Los cuatro ajustes al importar el proyecto

**Los cuatro valores por defecto de Vercel son incorrectos en este repo.** Si se aceptan tal
cual, el build falla o el resultado sale mal nombrado:

| Ajuste | Vercel pone | Tiene que ser | Por qué |
|---|---|---|---|
| **Root Directory** | `/` | **`app`** | La app no está en la raíz. En la raíz no hay `package.json`, así que el build ni arranca |
| **Production Branch** | `main` | **`mvp/bootstrap`** | `main` va muy por detrás: todo el MVP (`app/`, `supabase/`, `harness/`) vive en `mvp/bootstrap` |
| **Nombre del proyecto** | `rinworld-io` | **`bearingworld`** | Vercel lo deriva del nombre del repo de GitHub, que sigue siendo `RinWorld.io`. Eso daría `rinworld-io.vercel.app` — **el nombre que `CLAUDE.md` §2 prohíbe que vea nadie**, y una URL sale en todas las capturas |
| **Variables de entorno** | vacías | las tres del §2 | Sin ellas el bundle se construye, pero la app no conecta con Supabase |

Framework Preset (`Vite`), Build Command (`npm run build`) y Output Directory (`dist`) sí los
detecta bien solo. **No hace falta `vercel.json` para el routing** — el que hay solo pone una
cabecera (§3).

---

## 2 · Variables de entorno

Se copian de `app/.env` local. Los valores **no** se escriben aquí ni en ningún fichero
versionado (`CLAUDE.md` §1).

| Variable | Entornos | Nota |
|---|---|---|
| `VITE_SUPABASE_URL` | Production + Preview | Pública por diseño |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production + Preview | `sb_publishable_…`, **no** la de servicio. Va al navegador a propósito: lo que protege los datos es RLS |
| `VITE_DEMO_KEY_SEED` | **Solo Production** | Ver §5. En *Preview* se deja **vacía**, y entonces el despliegue de vista previa se comporta como el camino real del MVP: claves aleatorias por sesión |

**Ninguna otra.** En concreto:

- **`SUPABASE_SERVICE_KEY` no se pone jamás en Vercel.** Vive solo en el fixture del e2e
  (`app/e2e/fixture.setup.ts`) y como secreto de GitHub Actions. Si acabase en un build de Vite,
  la clave de servicio quedaría publicada y **RLS dejaría de existir** para quien la lea.
- Las `E2E_*` tampoco: son de la suite, no de la app.

> **Regla que hace esto seguro y que conviene no olvidar:** en Vite, **todo lo que empieza por
> `VITE_` acaba dentro del JavaScript que descarga el navegador**. No es configuración: es la
> definición del prefijo. Si una variable no puede ser pública, no puede llamarse `VITE_*`.

---

## 3 · La URL no se indexa · tres piezas que se estorban a propósito

| Pieza | Qué hace |
|---|---|
| `app/vercel.json` → `X-Robots-Tag: noindex, nofollow, noarchive` | **La autoritativa.** Cabecera en todas las respuestas |
| `app/index.html` → `<meta name="robots" content="noindex, nofollow">` | Lo mismo, pero **sobrevive a un cambio de hosting**, donde `vercel.json` no significa nada |
| `app/public/robots.txt` → `Disallow: /` | No impide indexar: **reduce el rastreo**, para que el bundle (que lleva la semilla dentro) no acabe copiado en un archivo público |

**Parecen redundantes y no lo son.** Un rastreador que respete el `Disallow` nunca llegará a leer
el `noindex`; uno que lo ignore, sí. Cubrir los dos casos exige las tres. **Que nadie las
"simplifique"** — está escrito también dentro de `robots.txt`.

Se retiran cuando la app deje de ser una demo con una semilla de claves dentro.

---

## 4 · Después de desplegar · comprobaciones

Las tres primeras son de un minuto y detectan los tres fallos probables:

1. **Carga y hace login** con `alpha@bearingworld.test`. Si la pantalla se queda en blanco, mira
   la consola: casi siempre es una `VITE_*` que falta.
2. **Un hilo cifrado se lee.** Entra en Hilos y abre uno con contenido. Si sale *"Contenido
   cifrado — introduce tu frase de seguridad para ver"*, la semilla **no** llegó al build de
   Production. Ojo: **cambiar una variable en Vercel no reconstruye nada** — hay que volver a
   desplegar para que entre.
3. **Las dos organizaciones no se ven entre sí.** Entra con `beta@` en otra ventana y comprueba
   que el inventario y los hilos son los suyos. Es la puerta del día 2, y en remoto vuelve a ser
   relevante porque cambia el origen, no solo la máquina.
4. **La cabecera está puesta:**

```bash
curl -sI https://bearingworld.vercel.app | grep -i x-robots-tag
```

---

## 5 · Lo que se acepta al desplegar con semilla

Escrito entero para que la decisión se pueda releer, no solo recordar.

**El hecho, verificado sobre el `dist/` real:** `VITE_DEMO_KEY_SEED` aparece **literal** dentro
del `.js` publicado. Cualquiera con la URL puede descargarlo y leerla.

**Lo que NO pasa:**

- **No rompe ADR-001.** El servidor sigue sin ver nada; lo cifrado sigue viajando cifrado y
  Supabase sigue guardando solo ciphertext.
- **No basta para leer nada.** Para descifrar hace falta además el ciphertext, y ese está detrás
  del login y de RLS. Sin cuenta no se saca contenido.

**Lo que sí se pierde, y es el precio real:** la segunda capa. Hoy, un agujero en RLS filtraría
ciphertext ilegible. **Con la semilla pública, filtraría texto claro.** Y como la semilla deriva
la privada de *cualquier* `member_id`, quien tenga las dos cosas lo tiene todo.

**Por qué se acepta igual:** los datos son inventados, y sin semilla **la demo del día 11 no
existe** — las claves serían aleatorias por sesión, lo cifrado dejaría de leerse al recargar y en
otro navegador no se vería nada. El panel de vista-servidor (`Plan §3`) se queda sin su momento.

**Y cuándo deja de aceptarse:** en V1. `VITE_DEMO_KEY_SEED` **no debe existir** — lo dice ya
`app/.env.example`, y esto no lo cambia.

---

## 6 · Auth: no hay nada que tocar

El login es `signInWithPassword` (`app/src/lib/session.ts:172`) — sin magic link, sin OAuth, sin
confirmación por correo. **No hay redirect URLs que dar de alta en Supabase.** Es el único motivo
por el que este despliegue no da la sorpresa clásica de *"en local entra y desplegado no"*.

Si algún día entra recuperación de contraseña o alta por invitación, **entonces** sí habrá que
añadir la URL desplegada a *Site URL* y *Redirect URLs*.

---

## 7 · Dos riesgos que quedan abiertos, y no los cierra este documento

1. **`@tabler/icons-webfont@latest` desde jsdelivr** (`app/index.html:20`). `@latest` significa
   que **la versión puede cambiar sola entre hoy y la demo**. Si cambia de major y renombran
   iconos, el shell se rompe visualmente la mañana del día 11, sin que nadie haya tocado nada.
   Fijar la versión es una línea. **Decisión del PO**, porque fijarla puede alterar lo que hoy se
   ve y eso hay que mirarlo antes.
2. **El plan Hobby de Vercel es para uso no comercial** según sus términos. Una demo privada a un
   socio es zona gris, pero la cláusula existe. Si esto se queda puesto más allá de la demo:
   Vercel Pro, o mover a Cloudflare Pages, que no la tiene.

---

## 8 · El dominio, cuando toque

**No hace falta para el día 11.** `bearingworld.vercel.app` lleva HTTPS y sale gratis.

`bearingworld.io` es escaparate: se compra, se apunta el DNS y se enchufa en Vercel sin tocar una
línea de código ni reconstruir nada. **Después de la demo, no antes** — y ojo, un dominio de
verdad invita a que alguien lo comparta, que es justo lo que el §3 y el §5 están conteniendo.

---

*Escrito el 12-ago-2026 · Claude Code (Opus 5) · decisión del PO del mismo día*
