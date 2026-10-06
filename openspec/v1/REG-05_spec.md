# Spec de Pantalla — `REG-05` · Introducción a las claves E2EE

> **⚠ ESTA SPEC NO ES UNA DE LAS NUEVE CAPABILITIES CERRADAS NI UNA SPEC APROBADA.** La escribe
> Claude Code el 6-oct-2026 porque `REG-05` es la única pantalla del Módulo 01 con HTML aprobado
> (`REG-05 · E2EE v1.0.html`) y captura (`specs/REG-05.pdf`) pero **sin spec en Markdown** en
> `openspec/design-gui/specs y html aprobados/specs/`, y el arnés exige una. Mismo precedente que
> `openspec/mvp/LOGIN-01_spec.md`.
>
> **No inventa nada.** Junta dos fuentes y dice cuál manda:
> - la spec funcional, `docs/Rinworld.io_Funcional_Modulo01_Onboarding_v1.5.md` §3.3.2;
> - el **HTML aprobado**, que **manda** donde discrepan (`F-170`).

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-05 |
| Nombre | Introducción a las claves E2EE |
| Módulo | 01 — Onboarding · Fase B (`REG-05` → `REG-06` → `REG-07`) |
| Quién la ve | Un **ADMIN** en estado **`REGISTERED`** (el que acaba de crear `REG-01`) |
| Shell | Dentro del shell estándar, como `REG-09`. VERA con el subtítulo `Asistente de registro` |
| Nav activo | El que hubiera; la pantalla ocupa el panel de contenido entero |

## 2. Propósito (spec funcional §3.3.2)

Pantalla **explicativa** antes de generar las claves. El usuario tipo tiene más de 50 años y
viene de la distribución, no de la tecnología: tiene que entender **qué va a pasar y por qué**
antes del paso técnico. Lenguaje de negocio, no criptográfico.

**No hace nada más que explicar.** No lee ni escribe en la base, no llama a la red y no toca
criptografía: el par de claves y el backup cifrado los crea `REG-07`.

## 3. Contenido (del HTML aprobado, literal)

De arriba abajo, en una columna centrada de hasta 600 px:

1. **Pasos del registro**: `Solicitud` (hecho) · `Organización` (hecho) · `Seguridad` (actual,
   número 3) · `Activación` (pendiente, número 4). Los hechos llevan un icono de verificación en
   latón; el actual va en azul de acción; el pendiente en gris.
2. **Antetítulo**: `Módulo 01 · Onboarding`.
3. **Título**: `Antes de continuar,` / `una cosa importante` (dos líneas).
4. **Tres bloques**, cada uno con un icono en un cuadrado de latón translúcido, un título y una
   descripción:
   - candado · `Tus negociaciones son privadas` · `Los precios y condiciones que intercambies en
     Bearingworld.io se cifran en tu dispositivo. Ni nosotros ni nadie puede leerlos.`
   - llave · `Tú tienes la llave` · `Para garantizar esa privacidad, vamos a generar un par de
     claves criptográficas únicas para ti.`
   - escudo · `Necesitas una frase de seguridad` · `Guardaremos una copia cifrada de tu clave en
     nuestros servidores, protegida con una frase que solo tú conocerás. Si la pierdes,
     perderás el acceso a tu historial cifrado.`
5. **Aviso** con borde izquierdo de latón e icono de advertencia: **`Anota tu frase de seguridad
   en un lugar seguro.`** `No podemos recuperarla por ti.`
6. **Botón** primario a todo el ancho: `Entendido, crear mi frase de seguridad` → `REG-06`.

## 4. Dónde discrepan las fuentes, y qué manda

| Spec funcional §3.3.2 | HTML aprobado — **manda** |
|---|---|
| Titular «Tu privacidad está garantizada matemáticamente» | `Antes de continuar, una cosa importante` |
| Tres puntos con otra redacción | Los tres bloques de §3, literales |
| Botón «Entendido — Generar mis claves» | `Entendido, crear mi frase de seguridad` |
| Enlace opcional «¿Cómo funciona esto?» con modal | **No existe**: el HTML no lo dibuja |
| — | La captura `REG-05.pdf` dice `Rinworld.io`; el HTML ya dice `Bearingworld.io` (`CLAUDE.md` §1.2) |

## 5. Fuera de esta pantalla

- La cabecera mínima, la barra de marca y el panel de VERA del HTML: los pone el shell.
- La conversación de demostración de VERA (§8 de la funcional): la monta el shell, no esta pantalla.
- Avisar al cerrar la ventana a medias (funcional §8): es de toda la Fase B, no de `REG-05`.
