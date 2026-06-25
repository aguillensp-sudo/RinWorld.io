# Spec de Pantalla — `REG-00` · FSR — Formulario de Solicitud de Registro

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-00 |
| Nombre | FSR — Formulario de Solicitud de Registro |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.1 · Módulo 01 v1.5 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

Pantalla exclusiva de la **Ruta 00.2** (usuario desconocido sin token de invitación). Fondo Deep Steel (`#1B2537`) con tarjeta blanca centrada en el panel de contenido (67%). VERA activa en el tercio derecho asistiendo al solicitante. Sin top nav completo — solo cabecera mínima con el logo.

---

## 3. Panel de contenido

### Título de la pantalla
```
Solicita acceso a Bearingworld.io
```

### Subtítulo
```
Nuestro equipo revisará tu solicitud y te contactará en un plazo máximo de 48 horas.
```

---

### Componentes presentes

**Formulario** — ver sección 4.

**Botón de envío:** `Enviar solicitud`
- Deshabilitado hasta que todos los campos obligatorios estén rellenos y válidos
- Azul al 35% de opacidad cuando deshabilitado

**Enlace secundario bajo el formulario:**
`¿Tienes un enlace de invitación? Accede directamente →`
Redirige al flujo de Ruta 00.1 (validación de token).

---

### Datos de ejemplo

```
Email: john@bearings.com
Nombre y apellidos: John Reece
Nombre de la organización: Bearings
País: United States of America (US)
Teléfono: +1
Sitio web: https://www.bearings.com
```

---

## 4. Formulario — detalle de campos

| Nº | Campo | Tipo | Oblig. | Placeholder / Ejemplo | Validación |
|----|---|---|---|---|---|
| 1 | Email del solicitante | email | S | `tu@empresa.com` | Formato email válido |
| 2 | Nombre y apellidos | text | S | `Nombre y apellidos` | Mín. 2 caracteres |
| 3 | Nombre de la organización | text | S | `Nombre legal de la empresa` | Mín. 2 / máx. 120 caracteres |
| 4 | País de la organización | select | S | `Selecciona un país` | Lista ISO 3166-1 |
| 5 | Teléfono de contacto | text | S | `+34 963 456 789` | Campo obligatorio, sin validación de formato estricta |
| 6 | Sitio web | url | S | `https://www.empresa.com` | Obligatorio · debe comenzar por https:// |

**Botón de envío:** `Enviar solicitud`

**Secciones:** Formulario único, sin divisiones.

---

## 5. Panel VERA

**Estado:** Visible y activa — asiste al solicitante durante el proceso de solicitud.

**Subtítulo del panel:** `Asistente de acceso`

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Hola. Si tu empresa distribuye rodamientos industriales y quieres acceder a Bearingworld.io, completa este formulario. Nuestro equipo revisará la solicitud y te avisaremos por email.
>
> **Usuario dice:**
> ¿Cuánto tarda la aprobación?
>
> **VERA responde:**
> El plazo habitual es de 24 a 48 horas en días laborables. Recibirás un email con el resultado en la dirección que indiques en el formulario.

---

## 6. Estados especiales

**Estado vacío:** Todos los campos en blanco con placeholders.

**Error inline:**
- Email con formato inválido: `Introduce un email válido`
- Sitio web sin https://: `La URL debe comenzar por https://`
- Campo obligatorio vacío al intentar enviar: borde rojo + texto bajo el campo

**Estado de éxito (post-envío):**
Redirección automática a REG-00-WAIT. No hay mensaje de éxito inline — el feedback visual es la propia pantalla de espera.

---

## 7. Notas y excepciones al sistema base

- Sin top nav completo — solo logo Bearingworld centrado en cabecera. No hay menú de navegación porque el usuario no está autenticado y no tiene acceso a ninguna sección.
- Esta pantalla **no existe** en la Ruta 00.1 (token de invitación). Un usuario que llega con token válido salta directamente al FRO (REG-01).
- El enlace `¿Tienes un enlace de invitación?` es el único punto de cruce entre rutas visible para el usuario.

---

## 8. Prioridad de construcción

- [ ] Media — pantalla de entrada para la ruta de crecimiento orgánico.

---

*Spec REG-00 · v1.0 · Bearingworld.io · Junio 2026*
