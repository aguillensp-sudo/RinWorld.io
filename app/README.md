# App · Bearingworld.io MVP

React 18 + TypeScript + Vite.

| Día | Qué entró |
|---|---|
| 2 (6-ago) | Shell completo desde `Rinworld_app_shell.html`, auth de dos organizaciones contra Supabase, Vitest y Playwright |
| 3 (7-ago) | **INV-01 · Panel de Inventario**, escrita a mano. Es la pantalla de referencia contra la que se compara lo que produzca el arnés desde el día 5 |

## Arrancar

```bash
cp .env.example .env   # y rellenar los valores
npm ci
npm run dev
```

Sirve en **http://localhost:5173**. Para llegar a INV-01: entrar con `alpha@bearingworld.test` y
pulsar **Inventario** en la barra de navegación.

> **Despliegue: el runbook entero está en `openspec/mvp/despliegue.md`.** El PO decidió el
> 12-ago desplegar en Vercel **con** semilla de demo, con la semilla solo en *Production* y la
> URL sin indexar. Sustituye a la decisión del 7-ago (*"solo local"*), que vencía en el día 11.
>
> Tres cosas de ahí que se olvidan y cuestan una tarde: **Root Directory es `app`**, no la raíz;
> **la rama de producción es `mvp/bootstrap`**, no `main`; y el proyecto se llama
> **`bearingworld`**, porque el nombre por defecto lo saca Vercel del repo de GitHub —que sigue
> siendo `RinWorld.io`— y eso publicaría una URL con el nombre que `CLAUDE.md` §2 prohíbe
> enseñar. GitHub Pages sigue sirviendo `main` en la raíz con los 32 HTML aprobados; son dos
> cosas distintas y ninguna estorba a la otra.
>
> **Lo que se acepta al desplegar con semilla está en `despliegue.md` §5, escrito entero.**
> Resumen: `VITE_DEMO_KEY_SEED` acaba literal dentro del `.js` publicado —es cómo funciona el
> prefijo `VITE_`, no un descuido—, ADR-001 no se rompe y RLS sigue tapando el ciphertext, pero
> se pierde la segunda capa. Datos inventados, y **muere en V1**.

Las convenciones de traducción a React (tokens, CSS Modules, nombres de clase, verificación)
están en `openspec/architecture/design-system.md` §6, que se rellenó al construir esto.

## Comprobar

```bash
npm run typecheck && npm test && npm run check:palette && npx playwright test
```

Estado a 9-ago-2026: **typecheck limpio · Vitest 102/102 · Playwright 22/22 · paleta completa**,
contra el proyecto Supabase real. Tres corridas seguidas del e2e sin flakiness.

> Los 4 tests que separan 98 de 102 son de F-026, y merecen leerse antes de escribir la siguiente
> pantalla. El recuento de líneas desactualizadas y el color de la columna Antigüedad salían los
> dos de "> 7 días" del spec, por dos caminos, con dos bordes: el chip decía `(3)` sobre una tabla
> con dos filas en naranja. **Cuando un número y un color vienen de la misma regla por caminos
> distintos, hace falta un test que los enfrente** — los de cada camino por separado pasaban los dos.

El e2e incluye las dos puertas de salida:

- **Día 2** — dos contextos de navegador, dos cuentas, cada una entra y ve su propia sesión, y
  ninguna ve la organización de la otra.
- **Día 3** — INV-01 pinta el inventario real de la base, y las dos organizaciones tienen
  catálogo con solape deliberado (`6205-2RS` en las dos, catálogos distintos).

> **El test más importante de `inventory.spec.ts` es el que no se puede hacer en unidad.**
> `inventory_lines` tiene DOS políticas de lectura permisivas que se suman: el inventario propio
> en cualquier estado, y el `PUBLISHED` de las demás organizaciones. Sin el `.eq('org_id', …)`
> explícito de `fetchPage`, "Mi inventario" mostraría también las 196 líneas del catálogo ajeno
> — sin error y con toda la pinta de funcionar. Los 102 tests de unidad mockean `fetchPage`, así
> que ese fallo los pasaría todos.

> Si faltan las credenciales `E2E_*`, la suite de la puerta **se salta**. En local eso avisa;
> en CI, `session.spec.ts` lanza un error a propósito. La primera vez que se ejecutó, los 6
> tests de la puerta se saltaron en silencio y el resumen dijo "2 passed" — un verde que no
> significaba nada. De ahí el error explícito.

## Lo que este scaffold decide

1. **Los tokens son variables CSS** en `src/styles/tokens.css`. Ningún componente escribe un
   hex. **Cierra F-003 completo**: los neutros de superficie clara (§1.4) y los semánticos
   (§1.5) entraron el 7-ago, y son los que INV-01 usa de arriba abajo.
2. **Los nombres de clase del shell aprobado se conservan** (`bwnav`, `bwvera`, …) dentro de
   CSS Modules, para que la comparación con el HTML aprobado siga siendo directa.
3. **VERA no finge saber.** El shell aprobado contesta a todo; aquí declara que no está
   conectada hasta el día 9. CLAUDE.md §7 lo pide y hay dos tests que lo fijan.
4. **Los datos de ejemplo del HTML no sobreviven.** Organización, usuario e iniciales vienen de
   la sesión, y un test falla si reaparecen "Rodamientos del Sur SL" o "Juan Martínez".
5. **`eventsPerSecond: 50`** en el cliente de Supabase desde el primer commit (F-007: el
   default de 10 descartó 6/20 mensajes en ráfaga en SP-3).
6. **El ítem de nav activo lo decide `App`, no el shell** (día 3). El ítem activo y la pantalla
   que se pinta son el mismo dato; con el estado dentro de `AppShell` habría dos verdades sobre
   dónde estás. **INV-01 va en `Inventario`, aunque su spec §2 diga "Vendiendo"** — es una errata
   heredada de la plantilla de VND-01 y la evidencia está en el comentario de `App.tsx` (F-025).
   Es la única vez del proyecto que se contradice un spec cerrado a propósito.
7. **El subtítulo de VERA es de la pantalla, no del shell.** INV-01 §5 pide "Agente de inventario";
   el shell base dice "Agente de búsqueda". `AppShell` lo recibe por prop (F-025).

## ⚠ Lo que INV-01 NO hace, y es a propósito

El diseño aprobado de INV-01 promete cinco cosas que el MVP no tiene (F-023). La pantalla las
pinta **con su estado real** en vez de fingir que funcionan:

| El HTML aprobado dice | Y aquí sale |
|---|---|
| Badge verde **"Activo"** y **"Siempre disponible"** en los dos canales de carga | Badge neutro **"Fuera del MVP"** — INV-02/03/04 están en el Plan §9 "Fuera" |
| Dropzone que abre un selector de archivos | Inerte: no es botón, no acepta drop, no abre nada |
| `ingest-a3f7k9@ingest.bearingworld.io` | Un guion. Una dirección de ingestión falsa es una a la que alguien puede mandar su inventario de verdad |
| **892** visitas en 30 días | Un guion + "sin instrumentar en el MVP". No hay tabla de visitas en el esquema |
| Botón azul **"Subir nuevo inventario"** | El mismo botón **deshabilitado**, con el motivo en `title` y también en texto para lectores de pantalla |

El botón se queda deshabilitado y no ausente por decisión del PO (7-ago): quitarlo dejaba la barra
de herramientas a medias y es un control de un diseño aprobado. Su estado deshabilitado usa los
neutros de §1.4 y **no** el azul apagado, porque un azul desvaído sigue leyéndose como "pulsa aquí".

Hay 8 tests que fallan si cualquiera de estas reaparece. El motivo es `CLAUDE.md` §7: si el
riesgo #1 es VERA afirmando con aplomo algo que no sabe, la interfaz no puede hacer lo mismo — y
en la interfaz engaña más, porque parece verificable.

**Y un hueco que sí es del diseño, no del alcance:** los cuatro chips de filtro no incluyen
ninguno para `DELETED`, así que **desde INV-01 no se puede ver ni restaurar una línea
eliminada**. Eliminar es borrado lógico (la fila puede estar referenciada por un hilo abierto).
Pendiente de decisión del PO para V1.

## ⚠ El login no tiene diseño aprobado

Entre los 32 HTML aprobados no hay ninguno de inicio de sesión: están los de registro
(REG-00…REG-09) y el de recuperación (REC-01), pero no el login. `src/screens/Login.tsx` es
andamiaje construido con los tokens y las reglas de §3, siguiendo la excepción de §2 para
REG-00 (fondo Deep Steel + tarjeta blanca). **Es la primera pantalla que ve el socio en la
demo y necesita diseño aprobado antes.**

## Estructura

```
src/
├── lib/               supabase.ts · session.ts (auth + perfil) · inventory.ts (datos de INV-01)
├── shell/             AppShell.tsx · VeraPanel.tsx  ← el armazón, se copia en toda pantalla
├── screens/           Login.tsx · Welcome.tsx
│   └── inventory/     Inventory.tsx (INV-01) · InventoryTable.tsx
├── styles/            tokens.css · global.css
└── test/              setup.ts
e2e/                   session.spec.ts   ← la puerta del día 2
                       inventory.spec.ts ← la puerta del día 3
```

`InventoryTable.tsx` está aparte del resto de la pantalla a propósito: es la contrapartida
directa del `InventoryTable.tsx` que generó el Coder en SP-1
(`openspec/mvp/spikes/SP-1/src/`). Mismo componente, misma fuente de verdad, uno a mano y otro
del arnés — esa comparación es el objetivo 4 del MVP.
