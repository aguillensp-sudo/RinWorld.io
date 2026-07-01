# Spec de Pantalla — `REG-01` · FRO — Formulario de Registro de Organización

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-01 |
| Nombre | FRO — Formulario de Registro de Organización |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.4 · Módulo 01 v1.5 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido + VERA.

- Panel de contenido: **67% del viewport** · fondo Cold White `#F1F3F6`
- Tarjeta de formulario: fondo blanco `#FFFFFF` · border-radius 8px · **llena el panel (max-width 900px, padding lateral 48px)** · los campos se ensanchan para aprovechar el ancho · esquinas brass decorativas
- Panel VERA: **33% del viewport** · arrastrable · colapsable a 32px · expandible hasta 50%
- Sidebar: overlay puro (se superpone, no mueve el contenido)
- Nav bar: ítem activo ninguno (pantalla de registro, usuario no autenticado aún)

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 01 · Onboarding
```
- este texto no aparece en la version de produccion solo se usa a nivel interno
Montserrat 600 · 14px · uppercase · letter-spacing 1.5px · Steel Mist

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

**Aviso brass (role-notice):**
> Tu usuario quedará registrado automáticamente como **Administrador de la organización**.

Posición: al inicio de la Sección 2, antes de los campos del administrador.

**Formulario:** FRO — ver sección 4.

**Ref de pantalla (esquina superior derecha de la tarjeta):**
```
REG-01 / FRO · v1.0
```
- este texto no aparece en la version de produccion solo se usa a nivel interno

IBM Plex Mono · 10px · Steel Mist

---

### Datos de ejemplo para el prototipo

```
Sección 1 — Organización:
  Nombre legal: Rodamientos del Sur SL
  NIF/CIF: B-12345678
  Dirección: Calle Industria, 47, Nave 3
  CP: 41900
  País de sede: España (ES)
  Email contacto: info@rodamientosdelsur.es
  Tel prefijo: +34 · número: 954 123 456
  Web: https://www.rodamientosdelsur.es
  Países de operación: [España] [Portugal]
  Marcas: [SKF] [FAG] [NSK]
  Logo: estado vacío (upload area sin archivo seleccionado)
  Visibilidad: "Visible para todos los miembros" (checked)

Sección 2 — Administrador:
  Nombre completo: Juan Martínez Herrera
  Email: juan.martinez@rodamientosdelsur.es
  Contraseña: (campo relleno, pw-strength en nivel 3/4)
  Repetir: (campo relleno, coincide)
  T&C: marcado → botón "Crear mi cuenta" habilitado
```

---

## 4. Formulario — detalle de campos

### Sección 1 de 2 · Datos de la organización

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Nombre legal de la empresa | text | S | `Rodamientos del Sur SL` | `Mín 5 / máx 120 caracteres` | Mín 5 / máx 120. Pre-relleno desde FSR si Ruta 00.2 |
| 2 | NIF / CIF | text | S | `B-12345678` | `Dato interno · máx 20 caracteres` | Máx 20 caracteres. Sin validación de formato. Label incluye icono candado + sensitive-tag "DATO INTERNO" |
| 3 | Dirección | text | S | `Calle Industria, 47, Nave 3` | `Máx 150 caracteres` | Máx 150 caracteres. Visible en ficha pública y Directorio |
| 4 | Código postal | text | S | `41900` | `Máx 10 caracteres · sin validación de formato` | Máx 10 caracteres |
| 5 | País de sede | select | S | `Selecciona un país` | `Lista ISO 3166-1 · máx 15 caracteres` | Lista ISO 3166-1. Determina prefijo telefónico |
| 6 | Email de contacto público | email | S | `info@empresa.com` | `Máx 30 caracteres · distinto del email del administrador` | Formato email válido. Máx 30 caracteres. Publicado en Directorio y ficha pública |
| 7 | Teléfono | phone | S | Prefijo: `+34 · ES` / Número: `954 123 456` | `Solo dígitos, espacios y guiones` | Campo compuesto: select prefijo (valor por defecto según país sede) + input número |
| 8 | Sitio web corporativo | url | N | `https://www.empresa.com` | `Debe comenzar por https:// si se introduce` | Formato URL con https:// |
| 9 | Países de operación | tags | S | `Buscar país...` | `Mín 1 · país de sede preseleccionado` | Mín 1 país. Lista ISO 3166-1 |
| 10 | Marcas principales que distribuye | tags | N | `Escribe una marca...` | `Máx 20 tags · máx 60 caracteres por tag` | Máx 20 tags. Máx 60 chars por tag. Autocompletado fabricantes |
| 11 | Logo de la empresa | file | N | `Arrastra o haz clic para subir` | `PNG, JPG o WEBP · máx. 2 MB` | PNG/JPG/WEBP · máx 2MB |
| 12 | Visibilidad del inventario | radio | S | — | — | Default: "Visible para todos los miembros". Opciones con descripción secundaria en mono |

**Opciones del campo 12 (radio con descripción):**
- `Visible para todos los miembros` — desc: `Cualquier distribuidor verificado puede consultar tu stock`
- `Visibilidad restringida` — desc: `Solo miembros autorizados previamente por ti`

---

### Sección 2 de 2 · Usuario administrador

**Aviso brass (role-notice)** aparece aquí, antes de los campos.

**Google SSO:**
```
[G] Continuar con Google
```
Botón blanco · borde 1px `#dadce0` · icono Google a color. Aparece ANTES del divisor `— o —`.

**Divisor:** `— o —` en IBM Plex Mono · uppercase · letter-spacing 0.18em

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 13 | Nombre completo | text | S | `Nombre y apellidos` | `Mín 6 / máx 50 caracteres` | Mín 6 / máx 50 caracteres |
| 14 | Email del administrador | email | S | `tu@empresa.com` | `Formato email · unicidad en tiempo real` | Formato email + unicidad en tiempo real |
| 15 | Contraseña | password | S | `Mín. 10 caracteres` | `1 may · 1 min · 1 número · 1 símbolo` | Mín 10 chars · 1 may · 1 min · 1 num · 1 símbolo. Incluye pw-strength (4 barras) |
| 16 | Repetir contraseña | password | S | `Repite la contraseña` | `Debe coincidir exactamente` | Coincidencia exacta con campo 15 |
| 17 | Acepto los T&C | checkbox-field | S | — | — | Bloquea el botón de envío hasta ser marcado. Texto: "Acepto los **Términos y Condiciones** de Bearingworld.io." |

**Botón de envío:** `Crear mi cuenta`
- Deshabilitado (azul 35%) hasta que el campo 17 esté marcado
- Habilitado: fondo azul sólido · hover ligeramente más oscuro

---

## 5. Panel VERA

**Estado:** Activa con conversación en curso — modo asistencia de registro.

**Subtítulo del panel:** `Asistente de registro`

**Conversación tipo:**

> **VERA dice (mensaje inicial automático):**
> Hola, soy VERA. Estoy aquí para ayudarte a completar tu registro en Bearingworld.io. Si tienes dudas sobre algún campo o necesitas orientación, pregúntame.
>
> **Usuario dice:**
> ¿Qué pongo en países de operación?
>
> **VERA responde:**
> Indica los países donde tu organización distribuye o compra rodamientos habitualmente. El país de sede ya estará preseleccionado — puedes añadir más si operas en otros mercados.

---

## 6. Estados especiales

**Estado vacío (carga inicial):**
Todos los campos vacíos con placeholders. T&C desmarcado. Botón "Crear mi cuenta" deshabilitado.

**Error inline por campo:**
- Email formato inválido: `Introduce un email válido`
- Email ya registrado (campo 14): `Este email ya tiene cuenta en Bearingworld.io`
- Web sin https://: `La URL debe comenzar por https://`
- Contraseñas no coinciden: `Las contraseñas no coinciden`
- Campo obligatorio vacío al intentar enviar: borde rojo + hint en rojo

**Estado de éxito:**
Redirección automática a REG-05. Sin mensaje de éxito inline.

---

## 7. Notas y excepciones al sistema base

- La tarjeta del formulario tiene esquinas decorativas (`corner tl/tr/bl/br`) — elemento signature de las pantallas de registro.
- El aviso brass (role-notice) aparece en la Sección 2, antes de los campos del administrador — no al inicio del formulario.
- Google SSO aparece antes del divisor `— o —`, que a su vez aparece antes de los campos de contraseña.
- El campo 2 (NIF/CIF) lleva: icono candado en el label + sensitive-tag "DATO INTERNO" en mono rojo.
- Los campos 3 y 4 (Dirección y CP) van en la misma fila del grid (dos columnas).
- Los campos 15 y 16 (Contraseña y Repetir) van en la misma fila del grid.
- Todos los demás campos van a ancho completo (span 2 columnas).

---

## 8. Prioridad de construcción

- [x] **Alta**

---

*Spec REG-01 · v1.4 · APROBADA · Bearingworld.io · Junio 2026*
