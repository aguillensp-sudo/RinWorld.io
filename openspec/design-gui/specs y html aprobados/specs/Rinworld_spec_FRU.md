# Spec de Pantalla — `FRU` · Formulario de Registro de Usuario Adicional

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | FRU |
| Nombre | Formulario de Registro de Usuario Adicional |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.8B · Módulo 01 v1.5 |

---

## 2. Layout

**Shell completo** en ambos puntos de entrada — brand bar + nav bar + sidebar overlay + panel VERA.


Formulario centrado (max-width 520px) en el panel de contenido sobre fondo blanco.

---

## 3. Panel de contenido

### Título de la pantalla

**Desde REG-09:**
```
Registrar un nuevo usuario
```

**Desde enlace de invitación:**
```
Completa tu registro en Bearingworld.io
```

### Subtítulo

**Desde REG-09:**
```
El usuario se añadirá a tu organización con rol Editor.
```

**Desde enlace de invitación:**
```
Has sido invitado a unirte a [Nombre de la organización] en Bearingworld.io.
```

---

### Componentes presentes

**Aviso de rol no seleccionable** (bloque brass tenue):
> Este usuario quedará registrado automáticamente como Editor de la organización. No existe selector de rol.

**Formulario** — ver sección 4.

**Botón de envío:** `Registrar usuario`
Deshabilitado hasta que todos los campos obligatorios estén válidos y T&C marcado.

---

### Datos de ejemplo

```
Nombre completo: María López García
Email: maria.lopez@rodamientosdelsur.es
Contraseña: ••••••••••• (rellena)
Repetir: ••••••••••• (coincide)
T&C: marcado
```

---

## 4. Formulario — detalle de campos

| Nº | Campo | Tipo | Oblig. | Placeholder / Ejemplo | Validación |
|----|---|---|---|---|---|
| 1 | Nombre completo | text | S | `Nombre y apellidos` | Mín. 2 / máx. 100 caracteres |
| 2 | Email | email | S | `usuario@empresa.com` | Formato email · verificación de unicidad en tiempo real en toda la plataforma |
| 3 | Contraseña | password | S | `Mín. 10 caracteres` | Mín. 10 caracteres · 1 mayúscula · 1 minúscula · 1 número · 1 símbolo |
| 4 | Repetir contraseña | password | S | `Repite la contraseña` | Debe coincidir exactamente |
| 5 | Acepto los Términos y Condiciones | checkbox | S | — | Bloquea el envío si no está marcado |

**Botón de envío:** `Registrar usuario`

**Sin ningún campo de organización** — ni en modo solo lectura. El usuario invitado no ve ni confirma datos de la organización a la que se une.

---

## 5. Panel VERA

**Estado:** Visible y activa.

**Conversación tipo (desde REG-09):**

> **VERA dice:**
> Introduce los datos del nuevo usuario. Recibirá un email de confirmación y también tendrá que establecer su propia frase de seguridad para acceder a los mensajes cifrados.
>
> **Usuario dice:**
> ¿El nuevo usuario puede ver nuestros precios acordados?
>
> **VERA responde:**
> Solo si tiene acceso a las claves E2EE correspondientes. Los mensajes cifrados son accesibles por los miembros de la organización que los generaron — depende de cómo gestiones el acceso desde Ajustes.

---

## 6. Estados especiales

**Error: email ya registrado en la plataforma**
- Inline en tiempo real: `Este email ya tiene cuenta en Bearingworld.io. No puede invitarse a un usuario ya registrado.`
- Botón deshabilitado

**Error: contraseñas no coinciden**
- Inline: `Las contraseñas no coinciden`

**Estado de éxito (desde REG-09):**
Vuelve a REG-09 con el contador actualizado (`X de 5 usuarios registrados`) y la misma pregunta `¿Quieres añadir otro usuario?`

**Estado de éxito (desde enlace de invitación):**
Redirige al flujo E2EE del nuevo usuario — REG-05 → REG-06 → REG-07 → dashboard.

---

## 7. Notas y excepciones al sistema base

- **Sin ningún campo de organización** — este es el punto diferencial del FRU vs FRO. Ni nombre de empresa, ni país, ni NIF, ni nada relacionado con la organización. El usuario invitado queda vinculado automáticamente.
- El token de invitación enviado por email es válido durante **7 días**. Si caduca, el usuario debe solicitar al Administrador que envíe una nueva invitación desde INVT-01.
- El nuevo usuario también completará su propio flujo E2EE (REG-05, REG-06, REG-07) tras registrarse — la passphrase es individual, no compartida por la organización.

---

## 8. Prioridad de construcción

- [ ] Media

---

*Spec FRU · v1.0 · Bearingworld.io · Junio 2026*
