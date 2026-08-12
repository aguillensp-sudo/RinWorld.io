# Spec de Pantalla — `LOGIN-01` · Iniciar sesión

> **⚠ ESTA SPEC NO ES UNA DE LAS NUEVE CAPABILITIES CERRADAS, y conviene saberlo antes de
> leerla.** Las de `openspec/specs/` son contrato aprobado y de solo lectura (`CLAUDE.md`
> §1.3). Esta la escribe Claude Code el 12-ago-2026, a petición del PO, porque **LOGIN-01 no
> existe en ninguna parte**: no está entre los 32 HTML aprobados, no está entre las 8
> pantallas del alcance (`Plan §9`) y no tiene mock.
>
> **Es la novena pantalla que nadie planificó, y es la primera que ve el socio** el día 11.
> Eso es F-016, abierto desde el día 2.
>
> **Lo que no se inventa aquí:** el sistema de diseño. Todo sale de
> `openspec/architecture/design-system.md` y de `app/src/styles/tokens.css`, que es lo que
> el PO pidió — *"que siga los estándares del resto de la aplicación"*.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | LOGIN-01 |
| Nombre | Iniciar sesión |
| Módulo | 00 — Acceso |
| Nav activo | **Ninguno.** No hay shell: esta pantalla se pinta **antes** de que exista sesión |

---

## 2. Layout

**Variante: pantalla completa sin shell.** No hay brand bar, ni nav, ni sidebar, ni panel de
VERA. `App.tsx` devuelve `<Login>` en vez del shell cuando el estado de sesión es `anonymous`
o `orphan`, así que **nada del shell está montado** y no se puede reutilizar.

- Fondo: el azul profundo de la marca, el mismo de la barra superior del shell.
- La tarjeta de acceso, centrada vertical y horizontalmente, con ancho máximo acotado: un
  formulario de dos campos estirado a 1920px se lee mal.
- Responsive: por debajo de 480px la tarjeta ocupa el ancho disponible con su margen.

---

## 3. Contenido

| Elemento | Literal | Notas |
|---|---|---|
| Eyebrow | `Bearingworld.io` | **Nunca "Rinworld"** (`CLAUDE.md` §1.2) |
| Título | `Iniciar sesión` | `<h1>`. Es el nombre accesible del `<form>` también |
| Etiqueta 1 | `Correo electrónico` | `<label for>` real, no `aria-label` |
| Placeholder 1 | `nombre@empresa.com` | Dato de ejemplo **en placeholder, nunca en `value`** |
| Etiqueta 2 | `Contraseña` | `<label for>` real |
| Botón | `Entrar` / `Entrando…` | El segundo mientras hay envío en curso |
| Nota de cifrado | `Cifrado extremo a extremo · el servidor no ve tu contenido` | Ver §6 |

---

## 4. Comportamiento

| Regla | Detalle |
|---|---|
| RNG-LOG-01 | **El botón está deshabilitado hasta que los dos campos tienen contenido.** Un correo de solo espacios no cuenta |
| RNG-LOG-02 | **Un envío en curso deshabilita el botón.** Dos `signInWithPassword` seguidos contra el mismo GoTrue es la carrera que hizo intermitente la suite del día 2 |
| RNG-LOG-03 | El error de autenticación se pinta **dentro de la tarjeta**, en un nodo con `role="alert"`, y dice el mensaje real que llega — nunca uno genérico (F-020) |
| RNG-LOG-04 | `autoComplete="username"` y `autoComplete="current-password"`. Sin esto el gestor de contraseñas del navegador no rellena, y el socio entra a mano delante de todos el día 11 |
| RNG-LOG-05 | El formulario se envía **también con Enter**: es un `<form>` con `type="submit"`, no un `<div>` con `onClick` |

---

## 5. Lo que esta pantalla NO tiene, y es deliberado

| Ausencia | Por qué |
|---|---|
| **Registro / "Crear cuenta"** | El alta de organización es `organization-onboarding`, que **no está en el alcance del MVP** (`Plan §9`). Las cuentas las provisiona el operador. Un enlace que no lleva a ninguna parte es peor que su ausencia |
| **"¿Has olvidado tu contraseña?"** | Igual: no hay flujo de recuperación construido. Y además **prometería recuperar algo que en el MVP no se puede** — las claves E2EE viven en memoria de sesión y se pierden al recargar (`CLAUDE.md` §4). Es F-027 otra vez: el indicador informa, no ofrece |
| **"Recordarme"** | `supabase.ts` ya fija `persistSession: true` para todo el mundo. Una casilla que no cambia nada es una mentira con casilla |
| **SSO / OAuth** | No hay proveedor configurado en Auth |
| **Selector de idioma** | El MVP es solo español |

---

## 6. La nota de cifrado, y por qué es la única frase de producto que se permite aquí

`Cifrado extremo a extremo · el servidor no ve tu contenido` **es el argumento entero del
producto**, y esta es la primera pantalla donde el socio lo lee. Se queda.

**Lo que no puede hacer es prometer de más.** En el MVP no hay respaldo de clave, ni
passphrase, ni recuperación (`CLAUDE.md` §4). Así que la frase describe lo que el servidor
**no** ve, y no ofrece ninguna acción. **Ningún botón al lado, ningún enlace a "saber más"
que no existe.**

---

## 7. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-LOG-01 | Los dos campos tienen `<label for>` real, así que `getByLabel('Correo electrónico')` y `getByLabel('Contraseña')` los encuentran |
| CA-LOG-02 | El botón `Entrar` nace deshabilitado y se habilita solo con los dos campos rellenos |
| CA-LOG-03 | Al enviar se llama a `onSubmit(email.trim(), password)` **una sola vez**, aunque se pulse dos veces |
| CA-LOG-04 | Un `error` no nulo se pinta en un nodo con `role="alert"` con su texto literal |
| CA-LOG-05 | El campo de contraseña es `type="password"` y **nunca** aparece su valor en el DOM serializado |
| CA-LOG-06 | No hay enlace ni botón de registro, de recuperación de contraseña ni de "recordarme" |
| CA-LOG-07 | Ni un color literal: todo `var(--bw-…)` |

---

## 8. ⚠ Lo que romper aquí rompe la suite entera

`app/e2e/fixtures.ts` autentica con **estos tres selectores**:

```ts
page.getByLabel('Correo electrónico')
page.getByLabel('Contraseña')
page.getByRole('button', { name: 'Entrar' })
```

Y `auth.setup.ts` corre **antes que todos los demás proyectos**: si el login deja de
encontrarse por ahí, **no falla el login — falla la suite completa**, y el informe apunta a
cuarenta tests que no tienen nada que ver. Los tres literales son contrato duro.

Y una más, de `fixtures.ts` y con su hallazgo detrás (**F-038**): tras rellenar la
contraseña, el helper la **vacía** antes de continuar, porque Playwright adjunta al informe
un volcado del DOM con el `value` de cada campo y ese informe se sube como artefacto de la
CI. La contraseña de la cuenta de pruebas estuvo descargable así. **El componente tiene que
seguir leyendo el valor en el `submit`**, no en un efecto posterior, o vaciarlo ahí rompería
el login.

---

*Spec LOGIN-01 · v1.0 · escrita el 12-ago-2026 por Claude Code · F-016*
