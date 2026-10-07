# Propuesta de diseño — `INVT-02` y `ACT-02` (sin aprobar)

**Estado: PROPUESTA del 7-oct-2026, sin aprobar por el PO.** No es contrato (`CLAUDE.md` §1.3): no se construye hasta que el
PO diga sí o corrija. Los HTML de esta carpeta son maquetas de revisión con una barra de estados («Propuesta · estados») que
**no formaría parte de la pantalla real**. Parten de `REG-01 · FRO v1.4` (misma cáscara, mismos tokens, mismas clases); lo único
nuevo es el CSS de la cabecera de este fichero, con tokens ya existentes (`design-system.md` §1.1, §1.4, §1.5).

Cierran, si se aprueban, los dos huecos de V1: **`F-212`** (una invitación no lleva a ningún sitio) y **`F-217`** (el alta crea
una cuenta que nadie puede activar).

## Cómo encajan

```
ADMIN  →  INVT-01  «Invitar»  →  se muestra el ENLACE una vez (como ADMIN-01)  →  el ADMIN se lo pasa al invitado
invitado →  INVT-02 (sin sesión: crea nombre + contraseña)  →  cuenta REGISTERED
         →  ACT-02 (con sesión: «Activa tu cuenta»)  →  REG-05 → REG-06 → REG-07  →  ACTIVE
FRU (alta con contraseña del ADMIN)  →  el usuario entra  →  ACT-02 (variante «contraseña provisional»)  →  igual
```

Las dos puertas (enlace o alta con contraseña) acaban en la misma pantalla, `ACT-02`.

---

## `INVT-02` · Aceptar invitación

| Campo | Valor |
|---|---|
| Código | INVT-02 |
| Módulo | 01 — Onboarding |
| Ruta | `/invitacion#t=<token>` — el token va en el **fragmento**, que el navegador no envía al servidor ni queda en logs |
| Sesión | **Sin sesión.** La cáscara se muestra sin el bloque de usuario ni el menú |
| Layout | Cáscara completa como `REG-01`: contenido 67 % + VERA 33 % (`Asistente de registro`) |
| HTML | `INVT-02 · INV v1.0.html` |

**Título:** `Te han invitado a Bearingworld.io`. **Subtítulo:** `Crea tu usuario para unirte a la organización que te ha invitado. Tu administrador ya ha hecho el resto.`

**Bloque de invitación (solo lectura):** Organización · Invitado por (nombre y rol) · Tu rol (`Editor`, siempre) · Tu correo · Caduca (fecha y días que quedan).

**Formulario** (mismos campos y reglas que `FRU`, para no inventar validaciones):

| Nº | Campo | Tipo | Oblig. | Validación |
|---|---|---|---|---|
| 1 | Nombre completo | text | S | Mín. 2 / máx. 100 |
| 2 | Correo | email · **solo lectura** | — | Es el de la invitación; no se edita |
| 3 | Contraseña | password | S | Mín. 10 · 1 may · 1 min · 1 número · 1 símbolo · barra de fortaleza |
| 4 | Repetir contraseña | password | S | Igual que la anterior |
| 5 | Acepto los Términos y Condiciones | checkbox | S | Bloquea el envío |

**Aviso (brass):** `Al terminar tendrás que activar tu cuenta con tu propia frase de seguridad. Solo tú la conoces: ni tu administrador ni Bearingworld.io pueden recuperarla.`
**Botón:** `Crear mi cuenta y unirme` (deshabilitado hasta que todo sea válido). Al acabar: se inicia sesión y se va a `ACT-02`.

**Estados** (todos en la maqueta):

| Estado | Título | Texto | Acción |
|---|---|---|---|
| Caducada | `Esta invitación ha caducado` | Las invitaciones valen 7 días. Pide a tu administrador que genere una nueva. | — |
| Usada / anulada / desconocida | `Este enlace no es válido` | **Un solo texto para los tres casos**: no se revela si el token existió | — |
| Cupo lleno | `La organización ha llegado a su límite de usuarios` | La invitación sigue vigente | — |
| Correo ya registrado | `Este correo ya tiene una cuenta` | Una cuenta solo pertenece a una organización | `Iniciar sesión` |

**Servidor (para quien lo construya):**

- Edge Function `accept-invitation`, **sin JWT** (como `access-request` y `register-organization`): su único permiso es el token y
  un límite por hora. `anon` no ejecuta nada de `public`.
- **Solo se guarda el hash del token**, de un solo uso, 7 días (lo que ya promete la spec de `INVT-01`). Mismo criterio que el
  enlace de `ADMIN-01`.
- Comprueba cupo (límite de 5) y unicidad del correo **al canjear**, no al invitar. Crea la cuenta de Auth, la fila de `members`
  `REGISTERED` y marca la invitación `Aceptada` en una sola transacción; si falla, borra la cuenta de Auth (patrón de
  `register-additional-member`).
- Sin proveedor de correo (`F-212`): el enlace lo copia el ADMIN y se lo pasa por su cuenta. **No se afirma nunca que se envió
  un correo.**

### Cambio que arrastra en `INVT-01` (aprobada: lo propongo, no lo hago)

1. Al `Enviar invitación`, un modal con el enlace **visible una sola vez**, botón `Copiar` y la frase `Cópialo ahora: no se vuelve a
   mostrar`. Sustituye al texto actual de `0037`.
2. Columna de estado de la invitación: `Pendiente` · `Aceptada` · `Caducada` · `Anulada`.
3. Acciones: `Anular` (revoca el enlace) y `Generar nuevo enlace` (revoca el anterior, como en `ADMIN-01`).

---

## `ACT-02` · Activa tu cuenta (miembro invitado)

| Campo | Valor |
|---|---|
| Código | ACT-02 |
| Módulo | 01 — Onboarding |
| Quién la ve | Un miembro `REGISTERED` **que no es ADMIN**: hoy `App.tsx` solo manda al ADMIN a la Fase B (`F-217`) |
| Layout | Cáscara completa con VERA `Asistente de registro`; menú vacío (no puede usar nada aún) |
| HTML | `ACT-02 · ACT v1.0.html` |

**Título:** `Activa tu cuenta`. **Subtítulo:** `Ya formas parte de {organización}. Para escribir mensajes, consultas y ofertas necesitas tu propia clave de cifrado.`

**Bloque de cuenta:** Usuario · Organización · Rol · Estado (`Pendiente de activar`).
**Tres pasos (reutiliza las pantallas existentes):** `REG-05` entender la clave · `REG-06` elegir la frase · `REG-07` guardarla.
**Dos cajas:** *Hasta que la actives* (ves la información de tu organización; no puedes enviar mensajes, consultas ni ofertas, que es lo
que hace hoy un `REGISTERED`, `F-222`) y *Cuando la actives* (acceso completo como Editor; clave en este navegador y copia cifrada en
el servidor).
**Aviso (brass):** `La frase es solo tuya. Tu administrador no puede restablecerla. Si la pierdes y no tienes otro navegador con tu clave, tendría que invitarte de nuevo y perderías el acceso al contenido cifrado anterior.`
**Botones:** `Empezar la activación` (→ `REG-05`) y `Ahora no, cerrar sesión`.

**Variantes:**

| Variante | Cuándo | Qué cambia |
|---|---|---|
| Contraseña provisional | Cuenta creada por `FRU` (el ADMIN puso la contraseña) | Antes de nada: `Antes de empezar, elige tu contraseña` (provisional + nueva ×2). Sin esto, el ADMIN conocería la contraseña de un usuario para siempre |
| Ya activada, otro navegador | `ACTIVE` con backup y sin clave local | No es pantalla nueva: enruta a `REC-01` |

`REG-05`, `REG-06` y `REG-07` **no cambian** salvo su texto, que hoy dice «tu organización» de forma que sirve al ADMIN; hay que
revisar que no afirme nada que solo valga para el ADMIN.

---

## Decisiones que necesito del PO

1. **¿Se aprueba que un EDITOR genere su propia clave** (Fase B para no-ADMIN)? Es lo que supone `ACT-02`. Toca `ADR-002` §10 (Q-1)
   —reparto de claves en el hilo— que hay que leer entero antes de construir. No lo he releído para esta propuesta.
2. **El aviso de la frase perdida de un EDITOR.** Lo he escrito como `reinvitar y perder lo anterior`; **no lo he comprobado
   contra el código ni contra ADR-001**. Es lo que mejor encaja con `F-217` y con que `discard_key_backup` sea solo del ADMIN, pero puede
   haber una vía mejor (p. ej. que el ADMIN pueda descartar el backup de un EDITOR).
3. **¿El alta de `FRU` con contraseña del ADMIN se queda?** Con `INVT-02` queda un solo camino bueno. Mantener los dos tiene un coste
   (la variante de contraseña provisional); quitar `FRU` lo evita pero toca una pantalla aprobada y construida.
4. **Sin sesión, ¿cáscara completa o página aislada?** Lo hago como `REG-01` (completa, sin bloque de usuario ni menú) por
   coherencia; es lo más barato de cambiar.
5. **El correo.** Mientras no haya proveedor (`F-212`) y dominio (`F-233`), el enlace se entrega a mano. Es una decisión de producto,
   no un detalle: un invitado que no recibe nada por sí mismo es fricción real.

## Lo que no he comprobado

- Las maquetas solo se han abierto en el panel del navegador, **sin ver la maquetación** (el panel salía minúsculo): comprobado que
  cargan sin errores de consola y que existen los cuatro y los tres estados. Hay que abrirlas en un navegador normal.
- El logo se ve roto si la carpeta no lleva `intentologo.png` (va copiado aquí). VERA responde con el texto genérico de `REG-01`
  fuera de las tres sugerencias; no he reescrito su base de respuestas.
- Los textos son míos. Ninguno está aprobado; los del aviso de la frase de `ACT-02` son los de mayor riesgo (afirman algo sobre
  una recuperación que no existe).
