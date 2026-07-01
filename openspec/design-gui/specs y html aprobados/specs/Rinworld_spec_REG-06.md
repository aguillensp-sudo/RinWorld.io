# Spec de Pantalla — `REG-06` · Establecer Backup Passphrase

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-06 |
| Nombre | Establecer Backup Passphrase |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.6 · Módulo 01 v1.5 · ADR-001 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

Formulario de una sola sección. Panel de contenido centrado sobre fondo blanco. VERA activa asistiendo y advirtiendo sobre la importancia del paso.

---

## 3. Panel de contenido

### Título de la pantalla
```
Crea tu frase de seguridad
```

### Subtítulo
```
Esta frase protege tu clave privada. Es diferente a tu contraseña de acceso y debes guardarla en un lugar seguro.
```

---

### Componentes presentes

**Formulario** — ver sección 4.

**Indicador de fortaleza de passphrase**
Barra visual bajo el campo de passphrase con cinco niveles:
- `Muy débil` — rojo
- `Débil` — naranja
- `Aceptable` — amarillo
- `Fuerte` — verde claro
- `Muy fuerte` — verde

Calculado con zxcvbn. El botón de avance solo se habilita con nivel ≥ `Fuerte` (score ≥ 3) y mínimo 12 caracteres.

**Botón de avance:** `Continuar`
- Deshabilitado hasta: passphrase con fortaleza ≥ Fuerte + repetición coincidente + checkbox marcado
- Azul al 35% cuando deshabilitado

---

### Datos de ejemplo

```
Backup passphrase: ••••••••••••••••••• (rellena, nivel "Muy fuerte")
Repetir: ••••••••••••••••••• (coincide)
Checkbox: marcado
Indicador: verde — Muy fuerte
```

---

## 4. Formulario — detalle de campos

| Nº | Campo | Tipo | Oblig. | Placeholder / Ejemplo | Validación |
|----|---|---|---|---|---|
| 1 | Backup passphrase | password | S | `Mín. 12 caracteres` | Distinta de la contraseña de login · score zxcvbn ≥ 3 · mín. 12 caracteres |
| 2 | Repetir backup passphrase | password | S | `Repite la frase` | Debe coincidir exactamente con el campo 1 |
| 3 | Confirmación de comprensión | checkbox | S | — | Texto: "Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente." |

**Botón de envío:** `Continuar`

---

## 5. Panel VERA

**Estado:** Visible y activa — modo de advertencia y guía.

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Esta frase debe ser diferente a tu contraseña de acceso. Te recomiendo usar una frase larga y memorable — por ejemplo, cuatro palabras aleatorias unidas. Anótala ahora antes de continuar.
>
> **Usuario dice:**
> ¿Puede ser la misma que mi contraseña?
>
> **VERA responde:**
> No. El sistema no lo permitirá — deben ser distintas por diseño. La passphrase de backup protege tus claves criptográficas, que son independientes de tu acceso a la plataforma.

---

## 6. Estados especiales

**Error: passphrase idéntica a contraseña de login**
- Mensaje inline: `La frase de seguridad debe ser diferente a tu contraseña de acceso`
- Botón `Continuar` permanece deshabilitado

**Error: passphrase demasiado débil**
- Indicador muestra nivel `Muy débil`, `Débil` o `Aceptable`
- Mensaje inline: `La frase necesita ser más fuerte para continuar`
- Botón deshabilitado

**Error: campos no coinciden**
- Mensaje inline bajo el campo 2: `Las frases no coinciden`
- Botón deshabilitado

**Estado de éxito:**
Redirección automática a REG-07 (generación de claves). No hay confirmación visual en esta pantalla — el avance es el feedback.

---

## 7. Notas y excepciones al sistema base

- Esta pantalla **bloquea la navegación**: el usuario no puede saltar a ninguna otra sección hasta completarla (FL-03, Módulo 01 v1.5).
- El checkbox de comprensión es semánticamente distinto a un T&C — es una confirmación de consecuencias, no una aceptación legal. El texto debe ser exacto al especificado.
- Sin top nav completo — cabecera mínima con logo.

---

## 8. Prioridad de construcción

- [ ] Alta — paso bloqueante del flujo de activación.

---

*Spec REG-06 · v1.0 · Bearingworld.io · Junio 2026*
