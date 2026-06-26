# Spec de Pantalla — `REG-05` · Introducción a las Claves E2EE

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-05 |
| Nombre | Introducción a las Claves E2EE |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.5 · Módulo 01 v1.5 · ADR-001 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

Pantalla puramente informativa. Sin campos de entrada. El usuario acaba de completar el FRO (REG-01) y antes de establecer su passphrase necesita entender qué son las claves E2EE y por qué son importantes. Panel de contenido centrado sobre fondo blanco.

---

## 3. Panel de contenido

### Título de la pantalla
```
Antes de continuar, una cosa importante
```

### Componentes presentes

**Bloque explicativo principal**

Tres bloques visuales en columna, cada uno con icono Tabler + título + descripción breve:

| Icono | Título | Descripción |
|---|---|---|
| `ti-lock` | Tus negociaciones son privadas | Los precios y condiciones que intercambies en Bearingworld.io se cifran en tu dispositivo. Ni nosotros ni nadie puede leerlos. |
| `ti-key` | Tú tienes la llave | Para garantizar esa privacidad, vamos a generar un par de claves criptográficas únicas para ti. |
| `ti-shield` | Necesitas una frase de seguridad | Guardaremos una copia cifrada de tu clave en nuestros servidores, protegida con una frase que solo tú conocerás. Si la pierdes, perderás el acceso a tu historial cifrado. |

**Bloque de aviso crítico** (borde izquierdo brass, fondo brass tenue)
> Anota tu frase de seguridad en un lugar seguro. No podemos recuperarla por ti.

**Botón de avance:** `Entendido, crear mi frase de seguridad`
Redirige a REG-06. Siempre habilitado — no requiere ninguna acción previa del usuario.

---

### Datos de ejemplo

No aplica — pantalla estática sin datos variables.

---

## 4. Formulario

No aplica.

---

## 5. Panel VERA

**Estado:** Visible y activa — modo explicativo.

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Este paso es el más importante del registro. Tu frase de seguridad protege el acceso a todo tu historial de negociaciones. Una vez la establezcas, guárdala en un lugar seguro — no hay forma de recuperarla si la pierdes.
>
> **Usuario dice:**
> ¿Qué pasa si la pierdo?
>
> **VERA responde:**
> Si pierdes la frase y no tienes backup en la nube, perderás el acceso a tu historial cifrado anterior. Podremos generar un nuevo par de claves, pero los mensajes cifrados con las claves antiguas serán permanentemente inaccesibles.

---

## 6. Estados especiales

No aplica. Pantalla estática — un único estado posible.

---

## 7. Notas y excepciones al sistema base

- Sin top nav completo — cabecera mínima con logo. El usuario está en medio del flujo de onboarding, aún sin acceso a la plataforma.
- El contenido explicativo debe estar redactado en lenguaje sencillo (ver sección 4.5 del PRD v1.1: "el argumento comercial en lenguaje sencillo"). Sin jerga criptográfica expuesta al usuario.
- El botón de avance es el único botón de la pantalla — no hay botón "Atrás" (el FRO ya fue enviado).

---

## 8. Prioridad de construcción

- [ ] Alta — paso crítico del flujo de activación.

---

*Spec REG-05 · v1.0 · Bearingworld.io · Junio 2026*
