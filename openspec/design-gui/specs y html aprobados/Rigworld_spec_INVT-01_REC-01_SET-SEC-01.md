# Spec de Pantallas — `INVT-01` · `REC-01` · `SET-SEC-01`

Módulo 01 — Pantallas de gestión post-registro

---

# INVT-01 · Panel de Gestión de Invitaciones

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INVT-01 |
| Nombre | Panel de Gestión de Invitaciones |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.9 · Módulo 01 v1.5 |

## 2. Layout

**Shell completo** — brand bar + nav bar + sidebar overlay + panel VERA. Accesible únicamente por el rol **Administrador** desde Ajustes → Gestión de usuarios.

## 3. Panel de contenido

### Título
```
Gestión de invitaciones
```

### Componentes

**Campo de invitación**
- Label: `Invitar nuevo usuario`
- Input email + botón `Enviar invitación` (primario, en línea)
- Validación en tiempo real: email no debe estar ya registrado en la plataforma
- Deshabilitado si la organización ya tiene 5 usuarios activos (límite alcanzado)
- Sin selector de rol — el invitado se asigna automáticamente como Editor

**Aviso de límite** (cuando quedan 0 plazas):
> Tu organización ha alcanzado el límite de 5 usuarios. Para añadir uno nuevo, debes eliminar uno existente.

**Tabla de invitaciones enviadas** (solo lectura)

| Columna | Descripción |
|---|---|
| Email | Email al que se envió la invitación |
| Estado | Pendiente · Aceptada · Expirada |
| Fecha de envío | Fecha y hora |
| Expira en | Días restantes (solo para Pendiente) |
| Acciones | `Reenviar` (si expirada) · ninguna si aceptada |

**Tabla de usuarios activos** (solo lectura)

| Columna | Descripción |
|---|---|
| Nombre | Nombre completo del usuario |
| Email | Email de login |
| Rol | Editor (todos, no editable) / Administrador (el propio) |
| Estado | Activo · Suspendido |
| Acciones | `Eliminar usuario` (ACCIÓN IRREVERSIBLE con confirmación explícita) |

## 4. Panel VERA

**Estado:** Activa · modo gestión.

**Conversación tipo:**
> **Usuario:** ¿cuántas invitaciones puedo enviar?
> **VERA:** Puedes tener hasta 5 usuarios en total en tu organización. Ahora tienes 2 activos y 1 invitación pendiente, así que puedes invitar a 2 más.

## 5. Estados especiales

- **Email ya registrado en la plataforma:** inline `Este email ya tiene cuenta en Bearingworld.io`
- **Invitación reenviada:** confirmación visual inline + VERA confirma en el chat
- **Eliminación de usuario:** modal de confirmación con texto `Esta acción es irreversible. El usuario perderá acceso inmediatamente.` + botón `Eliminar` (primario) + botón `Cancelar`

## 6. Notas

- Renombrada de INV-01 a INVT-01 en v1.1 para evitar conflicto con INV-01 del Módulo 02.
- Solo visible para el Administrador — los Editores no tienen acceso a esta pantalla.

## 7. Prioridad

- [ ] Media

---

# REC-01 · Recuperación de Clave Privada

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REC-01 |
| Nombre | Recuperación de Clave Privada |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.10 · ADR-001 § 7.2 |

## 2. Layout

**Shell completo** — brand bar + nav bar + sidebar overlay + panel VERA. Aparece cuando el sistema detecta que la clave privada no está en IndexedDB del dispositivo actual (nuevo dispositivo o sesión limpia).

## 3. Panel de contenido

### Título
```
Recupera el acceso a tus mensajes cifrados
```

### Subtítulo
```
Introduce tu frase de seguridad para restaurar tus claves en este dispositivo.
```

### Componentes

**Formulario** — ver sección 4.

**Enlace bajo el formulario:**
`He perdido mi frase de seguridad →`
Abre un flujo de generación de nuevo par de claves con advertencia de pérdida permanente de historial.

**Contador de intentos:**
Visible a partir del segundo intento fallido: `X de 5 intentos restantes`

**Botón:** `Restaurar acceso`

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Validación |
|----|---|---|---|---|
| 1 | Backup passphrase | password | S | Rate limiting: 5 intentos · cooldown 30 min tras agotar (ADR-001) |

## 5. Panel VERA

> **VERA dice:**
> Para acceder a tus mensajes cifrados en este dispositivo, necesitas introducir tu frase de seguridad. Es la misma que estableciste durante el registro.

## 6. Estados especiales

**Passphrase incorrecta:**
- Inline: `Frase de seguridad incorrecta`
- Contador de intentos restantes visible

**5 intentos agotados:**
- Bloqueo de 30 minutos server-side
- Mensaje con cuenta atrás: `Demasiados intentos. Vuelve a intentarlo en 28:43`

**Pérdida confirmada de passphrase (flujo alternativo):**
- Modal de advertencia con checkbox de comprensión: `Entiendo que perderé permanentemente el acceso a mi historial cifrado anterior`
- Solo tras marcar el checkbox: botón `Generar nuevas claves`
- Redirige a REG-06 → REG-07 con claves nuevas

## 7. Prioridad

- [ ] Alta — bloquea el acceso a los mensajes cifrados.

---

# SET-SEC-01 · Cambiar Backup Passphrase

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | SET-SEC-01 |
| Nombre | Cambiar Backup Passphrase |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.11 · ADR-001 § 8 |

## 2. Layout

**Shell completo** — brand bar + nav bar + sidebar overlay + panel VERA. Accesible desde Ajustes → Seguridad.

## 3. Panel de contenido

### Título
```
Cambiar frase de seguridad
```

### Componentes

**Formulario** — ver sección 4.

**Aviso crítico** (bloque brass tenue):
> Cambiar la frase de seguridad re-cifrará tu clave privada. El backup anterior en servidor se sobrescribe — no existe histórico de versiones anteriores.

**Botón:** `Guardar nueva frase`
Deshabilitado hasta que todos los campos sean válidos.

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Validación |
|----|---|---|---|---|
| 1 | Passphrase actual | password | S | Verificada antes de permitir el cambio |
| 2 | Nueva passphrase | password | S | Misma política que REG-06: score zxcvbn ≥ 3 · mín. 12 caracteres · distinta de la contraseña de login |
| 3 | Repetir nueva passphrase | password | S | Debe coincidir exactamente con el campo 2 |

## 5. Panel VERA

> **VERA dice:**
> Al cambiar la frase, tu clave privada se re-cifrará con la nueva frase y el backup anterior se reemplazará. No hay forma de recuperar la frase anterior una vez guardada.

## 6. Estados especiales

**Passphrase actual incorrecta:**
- Inline: `La frase actual no es correcta`

**Nueva passphrase demasiado débil:**
- Indicador de fortaleza igual que en REG-06

**Éxito:**
- Mensaje inline: `Frase de seguridad actualizada correctamente`
- VERA confirma en el chat

## 7. Prioridad

- [ ] Baja — funcionalidad de mantenimiento de cuenta.

---

*Specs INVT-01 · REC-01 · SET-SEC-01 · v1.0 · Bearingworld.io · Junio 2026*
