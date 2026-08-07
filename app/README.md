# App · Bearingworld.io MVP

React 18 + TypeScript + Vite. Scaffold del día 2 (6-ago-2026): shell completo desde
`Rinworld_app_shell.html`, auth de dos organizaciones contra Supabase, Vitest y Playwright.

## Arrancar

```bash
cp .env.example .env   # y rellenar los valores
npm ci
npm run dev
```

Las convenciones de traducción a React (tokens, CSS Modules, nombres de clase, verificación)
están en `openspec/architecture/design-system.md` §6, que se rellenó al construir esto.

## Comprobar

```bash
npm run typecheck && npm test && npx playwright test
```

Estado a 6-ago-2026: **typecheck limpio · Vitest 21/21 · Playwright 9/9**, contra el proyecto
Supabase real.

El e2e incluye la **puerta de salida del día 2**: dos contextos de navegador, dos cuentas,
cada una entra y ve su propia sesión, y ninguna ve la organización de la otra.

> Si faltan las credenciales `E2E_*`, la suite de la puerta **se salta**. En local eso avisa;
> en CI, `session.spec.ts` lanza un error a propósito. La primera vez que se ejecutó, los 6
> tests de la puerta se saltaron en silencio y el resumen dijo "2 passed" — un verde que no
> significaba nada. De ahí el error explícito.

## Lo que este scaffold decide

1. **Los tokens son variables CSS** en `src/styles/tokens.css`. Ningún componente escribe un
   hex. Cierra la primera mitad de F-003; la segunda (los neutros de fondo claro que el sistema
   de diseño no define) sigue abierta y la va a necesitar INV-01 el día 3.
2. **Los nombres de clase del shell aprobado se conservan** (`bwnav`, `bwvera`, …) dentro de
   CSS Modules, para que la comparación con el HTML aprobado siga siendo directa.
3. **VERA no finge saber.** El shell aprobado contesta a todo; aquí declara que no está
   conectada hasta el día 9. CLAUDE.md §7 lo pide y hay dos tests que lo fijan.
4. **Los datos de ejemplo del HTML no sobreviven.** Organización, usuario e iniciales vienen de
   la sesión, y un test falla si reaparecen "Rodamientos del Sur SL" o "Juan Martínez".
5. **`eventsPerSecond: 50`** en el cliente de Supabase desde el primer commit (F-007: el
   default de 10 descartó 6/20 mensajes en ráfaga en SP-3).

## ⚠ El login no tiene diseño aprobado

Entre los 32 HTML aprobados no hay ninguno de inicio de sesión: están los de registro
(REG-00…REG-09) y el de recuperación (REC-01), pero no el login. `src/screens/Login.tsx` es
andamiaje construido con los tokens y las reglas de §3, siguiendo la excepción de §2 para
REG-00 (fondo Deep Steel + tarjeta blanca). **Es la primera pantalla que ve el socio en la
demo y necesita diseño aprobado antes.**

## Estructura

```
src/
├── lib/         supabase.ts · session.ts (auth + perfil del miembro)
├── shell/       AppShell.tsx · VeraPanel.tsx  ← el armazón, se copia en toda pantalla
├── screens/     Login.tsx · Welcome.tsx
├── styles/      tokens.css · global.css
└── test/        setup.ts
e2e/             session.spec.ts  ← la puerta del día 2
```
