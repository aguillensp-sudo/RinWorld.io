# Sistema de diseño — Bearingworld.io

**Fuente:** extraído de las constantes `DESIGN_RULES` y `VERIFICATION_PROTOCOL` de
`openspec/design-gui/generator/generate_screen.py`, **verificado y corregido contra el
HTML aprobado** `openspec/design-gui/specs y html aprobados/Rinworld_app_shell.html`
(shell de referencia obligatorio).

Este documento es la fuente única de verdad del diseño. El Coder del arnés lo lee en cada
tarea a partir del día 4. Cuando el script y el HTML aprobado discrepan, **manda el HTML
aprobado** (ver §0).

---

## 0. Correcciones aplicadas al extraer

El script `generate_screen.py` contenía dos errores en la paleta/layout del shell,
detectados al verificar contra `Rinworld_app_shell.html`. Se corrigen aquí:

| Elemento | Script decía | HTML aprobado (correcto) | Nota |
|---|---|---|---|
| **Altura del nav bar** | `46px` | **`72px`** | El `46px` del script es la **altura del logo** (`<img ... style="height:46px">`), no la barra. El comentario del CSS es explícito: `/* NAV BAR — 72px */`. El Status de 1-jul ya decía 72px. |
| **Color brand bar** | `#111827` | **`#07111F`** | El shell usa `#07111F` para el brand bar. `#111827` no aparece en el shell aprobado. |
| **Color nav bar** | `#1B2537` | **`#07111F`** | El shell usa `#07111F` para el nav bar (igual que el brand bar). `#1B2537` es el color del **sidebar**, no del nav. |

El resto de valores del script (tipografía, paleta de acento, componentes, protocolo)
coincide con el HTML y se transcribe tal cual.

---

## 1. Tokens

### 1.1 Paleta (valores exactos y uso real en el shell)

| Token | Hex | Uso real |
|---|---|---|
| Deep Steel Darkest | `#07111F` | Fondo de **brand bar** y **nav bar** |
| Deep Steel | `#1B2537` | Fondo de **sidebar**; color de **texto/ink**; fondo de burbuja de usuario en VERA |
| Warm Cream | `#FAF8F4` | Fondo del **panel VERA** |
| Cold White | `#F1F3F6` | Fondo de contenido alternativo |
| Brass | `#B8924A` | Acentos de confianza (logo, header VERA, bordes de tags, dividers) |
| Calibration Blue | `#2563EB` | Acción primaria, foco de input, ítem de nav activo, radio seleccionado |
| Steel Mist | `#6B7A99` | Texto secundario |
| Signal Green | `#16a34a` | Punto de estado "online" de VERA |

> `#111827` (listado en el sistema base original como "Deep Steel Dark") **no se usa** en el
> shell aprobado; queda documentado solo como referencia histórica.

Colores de servicio (rgba sobre los anteriores):
- Placeholder de input: `#9BA4B0`
- Texto de input: `#1B2537`
- Overlay del sidebar abierto: `rgba(0,0,0,0.38)`
- Divisores sobre fondo oscuro: `rgba(255,255,255,0.15)`
- Sensitive tag: fondo `rgba(220,38,38,0.06)`, texto `#dc2626`
- Tags: fondo `rgba(184,146,74,0.08)`, borde `rgba(184,146,74,0.28)`
- Foco de input (halo): `box-shadow: 0 0 0 3px rgba(37,99,235,0.08)`

### 1.2 Tipografía

Tres familias:

- **Montserrat** — títulos y eyebrow.
- **Inter** — body, labels, inputs.
- **IBM Plex Mono** — referencias, hints, timestamps, dividers.

| Rol | Familia · peso · tamaño | Detalles |
|---|---|---|
| Títulos | Montserrat 700 · 28px | `letter-spacing: 0.5px` |
| Eyebrow / módulo | Montserrat 600 · 14px | uppercase, `letter-spacing: 1.5px` |
| Body | Inter 400 · 16px | |
| Labels | Inter 500 · 12px | `letter-spacing: 0.01em` |
| Inputs | Inter 400 · 13px | |
| Field hints | IBM Plex Mono 500 · 10px | uppercase, `letter-spacing: 0.04em`, color `#6B7A99` |
| Brand bar | Inter 400 · 10px | uppercase, `letter-spacing: 0.08em`, color `rgba(255,255,255,0.45)` |
| Sensitive tag | IBM Plex Mono · 9px | uppercase |
| Section divider | IBM Plex Mono · 10px | uppercase, `letter-spacing: 0.06em` |

### 1.3 Espaciado y radios

- **Radio de borde:** `3px` estándar (inputs, botones, radios, checkboxes); `4px` en el
  botón hamburguesa.
- **Padding de referencia:** panel de formulario `48px`; input `10px 12px`; radio option
  `12px 14px`; checkbox field `14px`; brand bar `0 20px`; nav bar `0 14px`.
- **Anchos fijos:** sidebar `210px`; VERA colapsado / `min-width` `32px`; divisor de nav `1px`.

---

## 2. Layout del shell

Estructura vertical (`.bwshell`: `display:flex; flex-direction:column; height:100vh;
overflow:hidden`). Para pantalla completa: `position:fixed; inset:0`.

```
┌───────────────────────────────────────────────┐
│ BRAND BAR · 24px · #07111F                      │  3 textos uppercase
├───────────────────────────────────────────────┤
│ NAV BAR · 72px · #07111F                        │  hamburguesa + logo + 8 ítems + user
├───────────────────────────────────────────────┤
│ MAIN (.bwmain · flex:1)                         │
│ ┌─────────────────────────┬───────────────────┐│
│ │ CONTENIDO (.bwcnt)      │ VERA (.bwvera)     ││
│ │ flex:1  (~67%)          │ 33.333%  · #FAF8F4 ││
│ │                         │ colapsa a 32px     ││
│ │  [SIDEBAR overlay 210px │ expande a 50%      ││
│ │   #1B2537, no empuja]   │ arrastrable        ││
│ └─────────────────────────┴───────────────────┘│
└───────────────────────────────────────────────┘
```

- **Brand bar** (`.bwbrand`): `height:24px`, `background:#07111F`, `flex-shrink:0`.
- **Nav bar** (`.bwnav`): `height:72px`, `background:#07111F`, `flex-shrink:0`, `z-index:100`.
  Cada `.bwnavitem` mide también `72px` de alto; el activo lleva `border-bottom-color:#2563EB`.
- **Main** (`.bwmain`): `display:flex; flex:1; overflow:hidden; position:relative`.
- **Contenido** (`.bwcnt`): `flex:1; min-width:0` — llena el espacio restante (~67%). El
  contenido específico de cada pantalla vive aquí; el resto del shell se copia íntegro.
- **VERA** (`.bwvera`): `width:calc(33.333% - 0.5px)`; `min-width:32px`;
  `background:#FAF8F4`; `border-left:0.5px solid rgba(184,146,74,0.18)`. Colapsado
  (`.bwvera.col`): `width:32px`.
- **Sidebar** (`.bwsb`): overlay puro `position:absolute; width:210px; background:#1B2537`,
  `transform:translateX(-100%)` cerrado / `translateX(0)` abierto. **No empuja el layout.**
- **Excepción sin shell:** solo `REG-00` y `REG-00-WAIT` (fondo Deep Steel + tarjeta blanca + VERA).

---

## 3. Componentes

### Formularios
- El bloque de formulario llena su panel del 67% (`max-width:900px`, `padding:48px`).
- Los campos se ensanchan para aprovechar el ancho — **no** columna estrecha centrada.
- Longitud máxima con atributo `maxlength`, **no** con ancho visual.
- **Todos los datos de ejemplo van en `placeholder`, NUNCA en `value`.**

### Inputs y labels
- **Label:** `font-size:12px; font-weight:500; letter-spacing:0.01em`.
- **Input:** `padding:10px 12px; border:1px solid; border-radius:3px; font-size:13px`;
  texto `#1B2537`; placeholder `#9BA4B0`.
- **Input :focus:** `border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,0.08)`.
- **Field hint:** IBM Plex Mono 10px uppercase, `letter-spacing:0.04em`, color `#6B7A99`.

### Botones
- **Primario:** `background:#2563EB; border-radius:3px; font-size:14px; font-weight:600`.
- **Deshabilitado:** `background:rgba(37,99,235,0.32); cursor:not-allowed`.

### Tags y chips
- **Tag:** `background:rgba(184,146,74,0.08); border:rgba(184,146,74,0.28)`; IBM Plex Mono 12px.
- **Sensitive tag:** IBM Plex Mono 9px, `background:rgba(220,38,38,0.06); color:#dc2626`, uppercase.

### Radios y checkboxes
- **Radio option:** `border:1px solid; border-radius:3px; padding:12px 14px`.
- **Radio checked:** `border-color:#2563EB; background:rgba(37,99,235,0.08)`.
- **Checkbox field:** `border:1px solid; border-radius:3px; padding:14px; background:#FAF8F4`.

### Avisos
- **Role notice:** `border-left:3px solid #B8924A; background:rgba(184,146,74,0.08)`.
- **Section divider:** IBM Plex Mono 10px uppercase, `letter-spacing:0.06em`.

### VERA (panel de agente)
- **Header:** SVG de rodamiento (brass) + "VERA" (Montserrat 700 15px) + subtítulo
  contextual + punto verde `#16a34a`.
- **Burbuja de VERA:** fondo blanco, `border-left:2px solid #B8924A`.
- **Burbuja de usuario:** fondo `#1B2537`, texto `#dde2ea`.
- **Resize handle:** `position:absolute; left:0; top:0; bottom:0; width:5px; cursor:col-resize`.

---

## 4. Reglas de comportamiento

- **VERA arrastrable y colapsable:** el resize handle (`position:absolute; left:0`) permite
  redimensionar el panel; arranca al 33.333%, colapsa a 32px y expande hasta el 50%. El shell
  usa `position:fixed; inset:0`.
- **Sidebar overlay:** se superpone con un fondo `rgba(0,0,0,0.38)`; nunca refluye el layout.
- **Placeholders nunca en `value`:** los datos de ejemplo van siempre en `placeholder`. Única
  excepción: campos pre-rellenos desde el FSR (formulario de solicitud de registro).
- **Grid proporcional:** campos largos (≥100 chars) en `span 2`; pares de campos cortos con
  proporciones tipo `2.5fr / 1fr` (p. ej. Código Postal + País). Nunca reordenar campos
  respecto al orden de la spec.
- **Textos literales:** copiar exactamente los textos de la spec, cero paráfrasis.

---

## 5. Protocolo de verificación (pre-entrega)

Antes de dar por terminada una pantalla, verificar en este orden:

1. **Shell completo** — CSS + HTML + JS copiados íntegros del shell base. Brand bar + nav +
   contenido + VERA llenan el 100% del viewport.
2. **VERA arrastrable** — el resize handle (`position:absolute; left:0`) funciona; el toggle
   funciona; el shell usa `position:fixed; inset:0`.
3. **Proporciones** — contenido 67% (`flex:1`) + VERA 33% (`width:33%; flex-shrink:0`). Sin
   huecos grises sobrantes.
4. **Placeholders** — datos de ejemplo en `placeholder`, nunca en `value` (salvo pre-rellenos
   desde FSR).
5. **Grid proporcional** — campos largos (≥100 chars) en `span 2`; pares cortos en `2.5fr/1fr`.
6. **Textos literales** — copiar exactamente los textos de la spec. Cero paráfrasis.
7. **Orden de campos** — seguir el número de fila de la tabla de la spec sin reordenar.

---

## 6. Traducción a React

*Rellenada el 6-ago-2026 (día 2) al construir el scaffold, no el día 4 como estaba previsto:
el Coder lee este documento desde el día 4 y la primera pantalla del arnés es del día 5. Si
llegara ahí con la sección vacía, inventaría sus propias convenciones y habría que rehacer
las pantallas. Lo de abajo describe lo que el scaffold ya hace — no es una propuesta.*

### 6.1 Tokens

Viven en **`app/src/styles/tokens.css`** como variables CSS bajo `:root`, con prefijo
`--bw-`. Transcripción literal de §1. **Ningún componente escribe un hex**: se usa
`var(--bw-token)`.

| Grupo | Ejemplo |
|---|---|
| Paleta | `--bw-deep-steel-darkest`, `--bw-brass`, `--bw-calibration-blue` |
| Servicio | `--bw-input-placeholder`, `--bw-focus-halo`, `--bw-sidebar-overlay` |
| Sobre fondo oscuro | `--bw-on-dark-soft`, `--bw-divider-on-dark`, `--bw-on-dark-fill-3` |
| Tipografía | `--bw-font-title`, `--bw-size-label`, `--bw-ls-eyebrow` |
| Espaciado | `--bw-radius`, `--bw-pad-input`, `--bw-pad-panel` |
| Layout | `--bw-h-brand`, `--bw-h-nav`, `--bw-w-sidebar` |

> **El hueco de F-003 sigue abierto y ahora tiene fecha de caducidad.** Este documento **no
> define** neutros para fondo claro: bordes de tabla, divisores, texto secundario sobre blanco
> y estados hover. El shell es oscuro y no los necesita; **INV-01 (día 3) sí**. Los grises que
> el Coder inventó en SP-1 (`#e5e7eb`, `#f3f4f6`, `#374151`, `#4b5563`) son exactamente estos
> cuatro huecos. Hasta que el PO los defina aquí y bajen a `tokens.css`, cualquier gris nuevo
> es un desvío — y el check de paleta del Test-runner lo rechazará.

### 6.2 Layout del shell

`app/src/shell/AppShell.tsx` + `AppShell.module.css`, y `VeraPanel.tsx` + su módulo.

- **CSS Modules**, un módulo por componente, como el prompt del Coder ya exigía en SP-1.
- **Los nombres de clase conservan los del shell aprobado** (`bwnav`, `bwvera`, `bwsbitem`,
  …). CSS Modules los hashea al compilar, pero la clave sigue siendo la del HTML aprobado:
  así los dos ficheros se comparan lado a lado y una discrepancia salta a la vista. Es lo que
  sustituye al "copiar el CSS íntegro" de §5.1, que con React no es literal.
- El shell ocupa el viewport desde `#root { position: fixed; inset: 0 }` en `global.css`
  (§4 exige `position:fixed; inset:0`).
- Estado del shell en React, no en el DOM: `sidebarOpen`, `active`, `collapsed`, `width`. Nada
  de `classList.toggle` ni `querySelectorAll`.
- La pantalla concreta entra como `children` de `AppShell`, que es el `.bwcnt` del 67%.

### 6.3 Componentes

- Un directorio por zona: `shell/` para el armazón, `screens/` para pantallas, `lib/` para
  datos y sesión.
- **Props tipadas y exportadas**, sin datos dentro del componente. Cero
  `dangerouslySetInnerHTML`.
- Los literales del diseño (los tres textos de la brand bar, los ocho ítems de nav con su
  icono) van en **constantes `as const`** arriba del componente, no dispersos en el JSX:
  quedan revisables contra la spec de un vistazo.
- Los iconos siguen siendo Tabler por clase (`<i className="ti ti-package" />`), igual que el
  shell aprobado.

### 6.4 Reglas de comportamiento

- **Los datos de ejemplo del HTML aprobado NO sobreviven.** "Rodamientos del Sur SL", "Juan
  Martínez" y "¡Bienvenido Walter!" vienen de la sesión. Hay un test que falla si reaparecen.
- **Nombres accesibles unívocos.** El shell duplica los ocho ítems (barra superior y menú
  lateral), así que cada `<nav>` lleva su `aria-label` (`Navegación principal` /
  `Navegación lateral`) y cada `aside` el suyo (`VERA` / `Menú lateral`). Sin esto ninguna
  consulta por rol es unívoca — ni en los tests ni para un lector de pantalla. Se descubrió
  porque dos tests fallaron por ambigüedad, no por diseño previo.
- **VERA no finge saber.** El shell aprobado responde "Entendido. ¿Algo más?" a cualquier cosa.
  Eso **no se copia**: CLAUDE.md §7 dice que el riesgo #1 es VERA afirmando con aplomo algo que
  no sabe, y un eco enlatado delante del socio se lee como un agente que funciona. Hasta el día
  9, VERA declara que no está conectada. Hay test de unidad y e2e que lo fijan.
- El arrastre de VERA quita la transición mientras dura (`.dragging`), o el panel va por detrás
  del ratón.

### 6.5 Protocolo de verificación

Los siete puntos de §5 siguen. Lo que cambia es que **cuatro dejan de ser inspección visual y
pasan a ser test automático**:

| §5 | Cómo se verifica ahora |
|---|---|
| 1 · Shell completo | `AppShell.test.tsx`: los ocho ítems en orden, los tres textos de la brand bar, el contenido |
| 2 · VERA arrastrable y colapsable | e2e: colapsa a **32px** exactos y vuelve; el handle existe |
| 3 · Proporciones | e2e mide el ancho real del panel; §2 también se comprueba viendo que el sidebar **no** empuja (su `x` es negativa cerrado) |
| 4 · Placeholders | test que falla si reaparece un dato de ejemplo del HTML aprobado |
| 5 · Grid proporcional | sigue siendo revisión a mano (no hay pantalla de formulario aún) |
| 6 · Textos literales | test sobre los literales de la brand bar |
| 7 · Orden de campos | sigue siendo revisión a mano |

Comandos: `npm run typecheck` · `npm test` · `npx playwright test` en `app/`.
