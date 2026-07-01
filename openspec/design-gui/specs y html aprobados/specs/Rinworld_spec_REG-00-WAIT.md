# Spec de Pantalla — `REG-00-WAIT` · Espera de Aprobación del Operador

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-00-WAIT |
| Nombre | Pantalla de espera de aprobación del operador |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.2 · Módulo 01 v1.5 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible · pantalla de un solo uso.

Pantalla de solo lectura. Sin campos de entrada. El usuario no tiene credenciales todavía — accede mediante el token de seguimiento generado al enviar el FSR. Una vez cerrada o resuelta la solicitud, esta pantalla no es accesible de nuevo por ningún medio.

---

## 3. Panel de contenido

### Título de la pantalla
```
Tu solicitud está en revisión
```

### Subtítulo
```
Nuestro equipo está analizando los datos de tu organización.
Te avisaremos por email en cuanto tengamos una respuesta.
```

---

### Componentes presentes

**Indicador de estado animado**
- Rodamiento SVG girando lentamente (elemento signature del sistema)
- Bajo el rodamiento: texto `Revisando solicitud...`
- Color: Brass `#B8924A`

**Bloque informativo de datos enviados** (solo lectura)
Resumen de los datos del FSR que el usuario envió, para que pueda verificar que son correctos:

| Campo | Valor (ejemplo) |
|---|---|
| Email | carlos.ruiz@distribucionesruiz.com |
| Nombre y apellidos | Carlos Ruiz |
| Organización | Distribuciones Ruiz SL |
| País | España |
| Teléfono | +34 963 456 789 |
| Sitio web | https://www.distribucionesruiz.com |

**Aviso de pantalla de un solo uso** (bloque brass tenue)
> Esta pantalla solo está disponible durante esta sesión. Una vez cerres el navegador o recibas respuesta por email, no podrás volver a acceder a ella.

**Botón de cierre voluntario:** `Cerrar y esperar el email`
Cierra la sesión temporal y redirige a la página de inicio pública. El usuario recibirá la respuesta por email independientemente.

---

### Datos de ejemplo

```
Estado: EN REVISIÓN
Email confirmado: carlos.ruiz@distribucionesruiz.com
Nombre y apellidos: Carlos Ruiz
Organización: Distribuciones Ruiz SL
País: España
Teléfono: +34 963 456 789
Sitio web: https://www.distribucionesruiz.com
Fecha de envío: Hoy, 11:23
```

---

## 4. Formulario

No aplica. Pantalla de solo lectura — ningún campo de entrada.

---

## 5. Panel VERA

**Estado:** Visible y activa — modo informativo.

**Subtítulo del panel:** `Asistente de acceso`

**Conversación tipo:**

> **VERA dice (mensaje automático al cargar):**
> Tu solicitud ha sido recibida. El equipo de Bearingworld.io la revisará y te enviará una respuesta a carlos.ruiz@distribucionesruiz.com. No necesitas hacer nada más por ahora.
>
> **Usuario dice:**
> ¿Puedo acelerar el proceso?
>
> **VERA responde:**
> No hay un proceso de revisión exprés, pero el plazo habitual es de 24 a 48 horas en días laborables. Si tienes algún contacto en Bearingworld.io que pueda invitarte directamente, el acceso sería inmediato.

---

## 6. Estados especiales

**Estado aprobado** (detectado por polling)
- El indicador animado se detiene
- Aparece icono de verificación verde
- Mensaje: `¡Tu solicitud ha sido aprobada! Revisa tu email para continuar.`
- VERA informa en el chat
- No hay redirección automática — el usuario debe abrir el email y pulsar el enlace al FRO

**Estado rechazado** (detectado por polling)
- Indicador animado se detiene
- Icono de aviso naranja
- Mensaje: `Tu solicitud no ha sido aprobada en este momento.`
- Motivo visible si el operador lo introdujo
- VERA informa en el chat con el motivo si está disponible

**Estado de carga / polling**
- Polling periódico silencioso en background
- Sin indicador de polling visible para el usuario — el rodamiento girando es el único feedback de actividad

---

## 7. Notas y excepciones al sistema base

- **Pantalla de un solo uso**: no existe ruta de regreso. Si el usuario cierra el navegador antes de recibir respuesta, solo recupera el estado cuando llegue el email de resolución.
- El rodamiento girando como indicador de procesamiento es el **elemento signature** del sistema en estados de espera — definido en el sistema base.
- No hay botón de reenvío de solicitud ni edición de datos — si el usuario quiere corregir algo, debe iniciar una nueva solicitud desde REG-00.
- Sin top nav — misma cabecera mínima que REG-00.

---

## 8. Prioridad de construcción

- [ ] Media

---

*Spec REG-00-WAIT · v1.0 · Bearingworld.io · Junio 2026*
