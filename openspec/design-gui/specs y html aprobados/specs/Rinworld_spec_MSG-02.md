# Spec de Pantalla — `MSG-02` · Vista de un Hilo

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | MSG-02 |
| Nombre | Vista de un Hilo |
| Módulo | 04 — Mensajería E2EE, Consultas y Negociación |
| Referencia funcional | Inventario Maestro v1.1 § 5.2 · Módulo 04 v1.5 §§ 4, 7 · spec messaging-and-negotiation: single-thread-model, e2ee-content-encryption, thread-lifecycle, vera-drafting-assistance |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Hilos**
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde MSG-01 (clic en un hilo) o desde cualquier pantalla con botón `Contactar` o `Consultar`

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 04 · Mensajería E2EE
```

### Breadcrumb de navegación
```
Hilos › [Nombre de la organización contraparte]
```
IBM Plex Mono · 11px · uppercase · Steel Mist. "Hilos" enlaza a MSG-01.

### Cabecera del hilo

- **Nombre de la organización contraparte** — Montserrat 700 · 22px · enlace a DIR-02 (ficha pública)
- **Badge de estado del hilo** — mismo sistema de colores que MSG-01
- **Badge de país** — IBM Plex Mono · código ISO 2 letras

---

### Componentes presentes

**Indicador de cifrado (si passphrase no activa en la sesión)**

Bloque brass en la parte superior del área de historial:
> **Contenido cifrado** — Introduce tu frase de seguridad para descifrar este hilo.
> [Botón primario: `Introducir frase de seguridad`]

Mientras no se introduce la passphrase: el historial muestra los elementos como bloques opacos con tipo y timestamp visible, pero sin contenido.

**Historial de elementos (área central, scrollable)**

Lista cronológica ascendente (el elemento más antiguo arriba, el más reciente abajo) de todos los elementos del hilo:

- **Mensajes libres:** burbuja de conversación con fondo diferenciado según si es propio (alineado a la derecha, fondo Deep Steel) o del interlocutor (alineado a la izquierda, fondo blanco). Contenido: texto descifrado (si passphrase activa) o bloque opaco.
- **Tarjetas de consulta** (MSG-03): componente visual diferenciado — ver sección 7 notas.
- **Tarjetas de oferta** (MSG-03): componente visual diferenciado — ver sección 7 notas.

Cada elemento muestra: organización autora · timestamp · indicador de leído/no leído.

**Campo de mensaje libre (al pie del historial)**

- Textarea: `Escribe un mensaje...`
- Botón enviar: icono flecha (envía al pulsar Enter o clic)
- El contenido se cifra E2EE antes de enviarse — el usuario escribe en claro, el sistema cifra antes de la transmisión
- VERA puede ayudar a redactar si el usuario lo solicita desde el panel

**Botón `Crear oferta`** (barra de acciones bajo el textarea)

Siempre visible dentro de un hilo ABIERTO, CON CONSULTA PENDIENTE o CON OFERTA PENDIENTE. Abre el formulario de tarjeta de oferta (MSG-03).

**Acciones del hilo** (menú desplegable o botones secundarios en la cabecera)

| Acción | Disponible en estado | Resultado |
|---|---|---|
| `Marcar acuerdo alcanzado` | ABIERTO · CON CONSULTA PENDIENTE · CON OFERTA PENDIENTE | Estado → ACUERDO ALCANZADO |
| `Revertir a abierto` | ACUERDO ALCANZADO | Estado → ABIERTO |
| `Cerrar sin acuerdo` | ABIERTO · CON CONSULTA PENDIENTE · CON OFERTA PENDIENTE | Estado → CERRADO SIN ACUERDO (irreversible — pide confirmación) |

---

### Datos de ejemplo

```
Hilo con: NSK Europe Ltd (DE)
Estado: CON OFERTA PENDIENTE [naranja]

Historial (cronológico):
  [Hace 3 días · Rodamientos del Sur SL]
  TARJETA DE CONSULTA · 6205-2RS · FAG
  [contenido descifrado visible si passphrase activa]

  [Hace 2 horas · NSK Europe Ltd]
  TARJETA DE OFERTA · 6205-2RS · NSK
  [contenido descifrado: precio, cantidad, plazo, coste envío]

  [Hace 1 hora · Rodamientos del Sur SL]
  Mensaje libre: "Gracias por la oferta. ¿Podríais bajar el precio de envío?"

Campo de mensaje: [vacío · esperando respuesta]
Botones: [Crear oferta] [Marcar acuerdo alcanzado] [Cerrar sin acuerdo]
```

---

## 4. Formulario

No aplica directamente — el formulario de tarjeta de consulta y de oferta se gestiona en MSG-03 (renderizado como componente dentro de MSG-02).

El campo de mensaje libre no es un formulario en sentido estricto — es un textarea de entrada continua.

---

## 5. Panel VERA

**Estado:** Activa — modo mensajería, hilo activo.

**Subtítulo del panel:** `Agente de mensajería`

**Conversación tipo:**

> **VERA dice (al abrir el hilo):**
> NSK Europe Ltd te ha enviado una oferta para el 6205-2RS hace 2 horas. [Solo metadatos — sin revelar precio ni cantidad]
>
> **Usuario dice:**
> Ayúdame a responder aceptando con condición de reducir el envío
>
> **VERA responde:**
> Te propongo este mensaje — revísalo antes de enviarlo:
> "Hola, muchas gracias por la oferta. Estaríamos interesados en proceder si podéis reducir el coste de envío. ¿Es posible?"
> ¿Lo enviamos tal cual o quieres modificar algo?

**Límites de VERA en este módulo:**
- Opera únicamente sobre metadatos y sobre contenido en claro que el usuario está redactando activamente
- Nunca accede al contenido cifrado de elementos ya enviados o recibidos
- Nunca propone cifras de precio que el usuario no haya proporcionado explícitamente
- El resumen de conversación está diferido a V2

---

## 6. Estados especiales

**Passphrase no activa:**
- Todos los elementos del historial se muestran como bloques opacos
- Tipo y timestamp sí son visibles
- Bloque brass con botón `Introducir frase de seguridad`

**Hilo CERRADO SIN ACUERDO:**
- El campo de mensaje y el botón `Crear oferta` desaparecen
- Solo se muestra el historial en modo lectura
- Botón `Revertir a abierto` no disponible — es el único estado irreversible

**Hilo ACUERDO ALCANZADO:**
- El historial es de solo lectura pero accesible
- El campo de mensaje libre sigue disponible para comunicación post-acuerdo
- Botón `Revertir a abierto` disponible

**Hilo vacío recién creado (primer contacto vía `Contactar`):**
- El historial está vacío
- VERA sugiere: `¿Quieres enviar un mensaje de presentación o ir directamente a una consulta de referencia?`

---

## 7. Notas y excepciones al sistema base

- **Todo el contenido está cifrado E2EE** — el usuario escribe o ve en claro en su dispositivo, pero el servidor solo almacena y reenvía ciphertext. Ningún elemento del historial se muestra sin passphrase activa.
- Las tarjetas de consulta y oferta se renderizan como **componentes visuales diferenciados** dentro del historial — no son bubbles de texto genérico. Tienen su propio diseño de tarjeta (ver spec MSG-03).
- El estado del hilo se calcula **exclusivamente desde metadatos** — nunca requiere descifrar contenido.
- El único estado irreversible es **CERRADO SIN ACUERDO** — requiere confirmación explícita antes de ejecutarse.
- VERA **nunca propone precios** que el usuario no haya proporcionado explícitamente. El resumen de conversación (que requeriría acceso a contenido descifrado) está diferido a V2.

---

## 8. Prioridad de construcción

- [x] **Alta**

---

*Spec MSG-02 · v1.0 · Bearingworld.io · Junio 2026*
