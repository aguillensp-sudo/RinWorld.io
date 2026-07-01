# Spec de Pantalla — `REG-09` · Bienvenida, Usuarios Adicionales y Acceso al Dashboard

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-09 |
| Nombre | Bienvenida, Usuarios Adicionales y Acceso al Dashboard |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.8 · Módulo 01 v1.5 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

Última pantalla del flujo de onboarding. Tono celebratorio pero contenido. El usuario está en estado KEY_ACTIVE y a punto de convertirse en ACTIVE. Panel de contenido centrado sobre fondo blanco.

---

## 3. Panel de contenido

### Título de la pantalla
```
¡Bienvenido a Bearingworld.io, Juan!
```
*(El nombre se personaliza con el nombre del administrador registrado.)*

### Subtítulo
```
Tu organización ya está activa. Antes de ir al panel, ¿quieres registrar más usuarios de tu equipo?
```

---

### Componentes presentes

**Pregunta de decisión — registro de usuarios adicionales**
Dos botones primarios en columna:

- `Sí, añadir un usuario ahora` → redirige a FRU (formulario de usuario adicional). Proceso iterativo hasta el límite de 5 usuarios por organización.
- `No, ir al panel` → redirige a `/dashboard`. Transiciona el estado a ACTIVE.

**Contador de usuarios** (visible si el Administrador ya ha añadido alguno en esta sesión):
`X de 5 usuarios registrados`

**Nota informativa bajo los botones:**
`Podrás invitar más usuarios desde Configuracion → Gestión de usuarios en cualquier momento.`

---

### Datos de ejemplo

```
Nombre: Juan
Organización: Rodamientos del Sur SL
Estado: primera vez en REG-09 (0 usuarios adicionales añadidos aún)
```

---

## 4. Formulario

No aplica — pantalla de decisión, no formulario.

---

## 5. Panel VERA

**Estado:** Visible y activa — modo de bienvenida.

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> ¡Ya está todo listo, Juan! Tu organización Rodamientos del Sur SL está activa en Bearingworld.io. Si quieres, puedo ayudarte a añadir compañeros ahora o puedes hacerlo más adelante desde Ajustes.
>
> **Usuario dice:**
> ¿Cuántos usuarios puedo añadir?
>
> **VERA responde:**
> Hasta 5 usuarios en total por organización, incluyéndote a ti. Ahora mismo eres el único, así que puedes añadir hasta 4 más. Todos se registrarán con rol Editor.

---

## 6. Estados especiales

**Con usuarios ya añadidos en la misma sesión:**
El título cambia a `¿Quieres añadir otro usuario?` y el contador muestra `X de 5 usuarios registrados`. Si ya se han añadido 4 (límite de 5 con el Administrador), el botón "Sí, añadir un usuario" desaparece y solo queda "Ir al panel".

**Límite alcanzado (5 usuarios):**
Solo muestra el botón `Ir al panel`. Sin mensaje de error — simplemente el botón de añadir no existe.

---

## 7. Notas y excepciones al sistema base

- El tono de esta pantalla es el único momento celebratorio del flujo — el título usa el nombre del usuario y el subtítulo confirma que la organización está activa. El resto del sistema es funcional y neutro.
- Sin top nav completo — primera pantalla en que el usuario tiene acceso, pero aún se mantiene la cabecera mínima para no romper el flujo de onboarding.

---

## 8. Prioridad de construcción

- [ ] Media

---

*Spec REG-09 · v1.0 · Bearingworld.io · Junio 2026*
