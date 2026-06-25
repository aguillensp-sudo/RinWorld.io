# Spec de Pantalla — `REG-01` · FRO — Registro de Organización y Administrador

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-01 |
| Nombre | FRO — Formulario de Registro de Organización y Administrador |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.4 · Módulo 01 v1.5 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

El usuario no está autenticado pero VERA permanece visible en el panel derecho para asistir durante el proceso de registro. El formulario ocupa el panel de contenido (~55% del viewport) sobre fondo blanco `#FFFFFF`, centrado horizontalmente dentro de ese panel. El panel VERA ocupa el tercio derecho (~33%) con fondo Warm Cream `#FAF8F4`.

**Logo de Bearingworld** visible en cabecera de la tarjeta (bearing SVG + logotipo).

---

## 3. Panel de contenido

### Título de la pantalla
```
Crear tu cuenta en Bearingworld.io
```

### Subtítulo
```
Completa los datos de tu organización y de tu usuario administrador.
Tu rol de Administrador se asignará automáticamente.
```

---

### Componentes presentes

**Formulario en dos secciones** — ver detalle completo en sección 4.

**Separador de sección** entre Sección 1 y Sección 2: línea divisoria con etiqueta centrada. Textos:
- `— Sección 1 de 2 · Datos de la organización —`
- `— Sección 2 de 2 · Usuario administrador —`

**Botón principal de envío**
- Texto: `Crear mi cuenta`
- Estado habilitado: todos los campos obligatorios válidos + checkbox T&C marcado
- Estado deshabilitado: azul `#2563EB` al 35% de opacidad · cursor `not-allowed`
- Posición: al pie del formulario, ancho completo de la tarjeta

**Botón alternativo Google SSO**
- Texto: `Continuar con Google`
- Icono: logo Google a la izquierda del texto
- Estilo: **excepción al sistema base** — fondo blanco · borde 1px `#dadce0` · texto `#1B2537` · icono Google a color. Es el único botón de la plataforma con este tratamiento, justificado por su naturaleza OAuth externa.
- Posición: encima del botón "Crear mi cuenta", separado por un divisor con texto `— o —`
- Nota constructiva: el botón Google aparece únicamente en la Sección 2, no en la 1

**Aviso de rol no editable** (bloque informativo, no campo):
> `Tu usuario quedará registrado automáticamente como Administrador de la organización.`
> Estilo: fondo brass tenue `rgba(184,146,74,0.08)` · borde izquierdo brass · texto Steel Mist · 12px

---

### Datos de ejemplo para el prototipo

**Sección 1:**
- Nombre legal: `Rodamientos del Sur SL`
- NIF/CIF: `B-12345678`
- Dirección: `Calle Industria, 47, Nave 3`
- Código postal: `41900`
- País de sede: `España (ES)`
- Email contacto público: `info@rodamientosdelsur.es`
- Teléfono: `+34 · 954 123 456`
- Web: `https://www.rodamientosdelsur.es`
- Países de operación: `España, Portugal`
- Marcas: `SKF · FAG · NSK`
- Logo: estado "archivo seleccionado" → `logo_rds.png · 148 KB`
- Visibilidad inventario: `Visible para todos los miembros` (seleccionado por defecto)

**Sección 2:**
- Nombre completo: `Juan Martínez Herrera`
- Email: `juan.martinez@rodamientosdelsur.es`
- Contraseña: campo relleno con puntos (••••••••••••)
- Repetir contraseña: coincide, sin error visible
- T&C checkbox: marcado

---

## 4. Formulario — detalle de campos

### Sección 1 de 2 — Datos de la organización

| Nº | Nombre del campo | Tipo | Oblig. | Placeholder / Ejemplo | Validación visible |
|----|---|---|---|---|---|
| 1 | Nombre legal de la empresa | text | S | `Rodamientos del Sur SL` | Min 2 / max 120 chars |
| 2 | NIF / CIF | text | S | `B-12345678` | Solo obligatorio, sin formato |
| 3 | Dirección | text | S | `Calle Industria, 47, Nave 3` | Max 200 chars |
| 4 | Código postal | text | S | `41900` | Sin validación de formato |
| 5 | País de sede | select | S | `Selecciona un país` | Lista ISO 3166-1 |
| 6 | Email de contacto público | email | S | `info@empresa.com` | Formato email · distinto del email de admin |
| 7 | Teléfono — prefijo | select | S | `+34` | Valor por defecto según campo 5 |
| 7 | Teléfono — número | text | S | `954 123 456` | Solo dígitos, espacios y guiones |
| 8 | Sitio web corporativo | url | N | `https://www.empresa.com` | Debe comenzar por https:// si se introduce |
| 9 | Países de operación | multi-select | S (mín 1) | `Buscar país...` | País de sede preseleccionado |
| 10 | Marcas principales que distribuye | tags input | N | `Escribe una marca...` | Max 20 tags · autocompletado fabricantes |
| 11 | Logo de la empresa | file upload | N | `PNG, JPG o WEBP · máx. 2 MB` | Formato y peso validados al seleccionar |
| 12 | Visibilidad del inventario | radio group | S | — | Opción A: `Visible para todos los miembros` (defecto) / Opción B: `Visibilidad restringida` |

### Sección 2 de 2 — Usuario administrador

| Nº | Nombre del campo | Tipo | Oblig. | Placeholder / Ejemplo | Validación visible |
|----|---|---|---|---|---|
| 13 | Nombre completo | text | S | `Nombre y apellidos` | Min 2 / max 100 chars |
| 14 | Email del administrador | email | S | `tu@empresa.com` | Formato email · unicidad en tiempo real |
| 15 | Contraseña | password | S | `Mín. 10 caracteres` | 1 mayúscula · 1 minúscula · 1 número · 1 símbolo |
| 16 | Repetir contraseña | password | S | `Repite la contraseña` | Debe coincidir exactamente |
| 17 | Acepto los Términos y Condiciones | checkbox | S | — | Bloquea el envío si no está marcado |

**Botón de envío:** `Crear mi cuenta`

**Secciones:** 2 secciones claramente separadas con divisor etiquetado (ver sección 3).

---

## 5. Panel VERA

**Estado:** Visible y activa — asiste al usuario durante el proceso de registro.

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Hola, soy VERA. Estoy aquí para ayudarte a completar tu registro en Bearingworld.io. Si tienes dudas sobre algún campo o necesitas orientación, pregúntame.
>
> **Usuario dice:**
> ¿Qué pongo en países de operación?
>
> **VERA responde:**
> Indica los países donde tu organización distribuye o compra rodamientos habitualmente. El país de sede ya estará preseleccionado — puedes añadir más si operas en otros mercados.

---

## 6. Estados especiales

**Estado vacío (carga inicial)**
Todos los campos en blanco salvo:
- Campo 5 (País de sede): vacío hasta selección del usuario
- Campo 7 (Prefijo teléfono): sin valor hasta que se seleccione país
- Campo 9 (Países de operación): vacío hasta selección
- Campo 12 (Visibilidad): `Visible para todos los miembros` preseleccionado

**Pre-relleno desde FSR (Ruta 00.2)**
Si el usuario viene de la ruta de solicitud aprobada por operador, los siguientes campos aparecen pre-rellenados con los datos del FSR y son editables:
- Campo 1: Nombre legal
- Campo 5: País de sede
- Campo 7: Teléfono (si se introdujo en FSR)
- Campo 8: Sitio web (si se introdujo en FSR)

**Estado de error inline**
- Campo requerido vacío al intentar enviar: borde rojo + mensaje bajo el campo
- Email de admin ya registrado: `Este email ya tiene cuenta en Bearingworld.io` (en tiempo real, sin esperar al envío)
- Email de contacto público igual al de admin: `Debe ser distinto del email del administrador`
- Web sin https://: `La URL debe comenzar por https://`
- Contraseñas no coinciden: `Las contraseñas no coinciden`
- Archivo de logo demasiado grande o formato incorrecto: `Formato no válido o archivo superior a 2 MB`

**Estado de éxito**
Al pulsar "Crear mi cuenta" con todos los campos válidos: redirección automática a REG-05 (pantalla informativa de introducción a las claves E2EE).

---

## 7. Notas y excepciones al sistema base

- Sin sidebar · con VERA visible — pantalla pre-autenticación pero con asistencia activa.
- El campo de teléfono es un componente compuesto (prefijo select + número text) en la misma línea.
- El campo de países de operación (multi-select con búsqueda) requiere componente específico — similar a un tag input con búsqueda ISO.
- El botón Google SSO es el único elemento con icono externo (logo Google) en toda la pantalla.
- El aviso de rol no editable tiene estilo propio (bloque informativo con acento brass) — no es un error ni una alerta de sistema.
- El NIF/CIF es nuevo en v1.1 — debe marcarse visualmente de alguna forma que lo distinga como campo sensible (dato interno, no publicado). Sugerencia: icono de candado pequeño junto al label.

---

## 8. Prioridad de construcción

- [x] **Alta** — es la pantalla de entrada al producto para todo usuario nuevo.

---

*Spec REG-01 · v1.0 · Bearingworld.io · Junio 2026*
