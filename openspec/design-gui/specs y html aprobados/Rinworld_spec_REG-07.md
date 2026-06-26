# Spec de Pantalla — `REG-07` · Generación de Claves y Almacenamiento de Backup

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | REG-07 |
| Nombre | Generación de Claves y Almacenamiento de Backup |
| Módulo | 01 — Onboarding |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 2.7 · ADR-001 §§ 6.1, 6.2, 7.1 |

---

## 2. Layout

**Variante:** Sin sidebar · con VERA visible.

Pantalla de procesamiento — sin campos de entrada ni interacción posible durante la ejecución. El usuario espera mientras el sistema realiza cuatro operaciones criptográficas en secuencia. Panel de contenido centrado sobre fondo blanco.

---

## 3. Panel de contenido

### Título de la pantalla
```
Generando tus claves de seguridad
```

### Subtítulo
```
Este proceso tardará unos segundos. No cierres esta ventana.
```

---

### Componentes presentes

**Indicador de progreso por pasos**
Cuatro pasos secuenciales con estado visual (pendiente / en curso / completado):

| Paso | Descripción visible al usuario | Operación técnica real |
|---|---|---|
| 1 | Generando tu par de claves | X25519 keypair generation |
| 2 | Protegiendo tu clave privada | Argon2id KDF `{m:65536, t:3, p:4}` + AES-256-GCM encryption |
| 3 | Guardando el backup en servidor | Upload `{encrypted_key_blob, key_iv, argon2_salt, kdf_params}` |
| 4 | Verificando la integridad | Server confirmation + estado → KEY_ACTIVE |

**Rodamiento SVG girando** durante el paso activo (elemento signature del sistema para estados de procesamiento). Se detiene al completar.

**Aviso de no cerrar** — visible durante todo el proceso:
> No cierres ni recargues esta ventana. El proceso puede tardar hasta 30 segundos.

---

### Datos de ejemplo

```
Paso 1: ✓ completado
Paso 2: ⟳ en curso (rodamiento girando)
Paso 3: pendiente
Paso 4: pendiente
```

---

## 4. Formulario

No aplica — pantalla de procesamiento sin ningún campo.

---

## 5. Panel VERA

**Estado:** Visible — modo informativo pasivo durante el proceso.

**Conversación tipo:**

> **VERA dice (al iniciar el proceso):**
> Estamos generando tu par de claves criptográficas y guardando el backup cifrado. Solo tardará unos segundos.
>
> **VERA dice (al completar):**
> Todo listo. Tu clave privada está generada y el backup está seguro. Puedes continuar.

---

## 6. Estados especiales

**Estado en proceso:** Los cuatro pasos avanzan secuencialmente. El usuario no puede interactuar.

**Estado completado con éxito:**
- Todos los pasos con icono `✓` verde
- Mensaje: `¡Todo listo! Tu cuenta está protegida.`
- Botón que aparece: `Continuar` → redirige a REG-09
- VERA notifica en el chat

**Estado de error en paso 3 (fallo de red al subir el backup):**
- Icono de aviso en el paso 3
- Mensaje: `No hemos podido guardar el backup. Comprueba tu conexión e inténtalo de nuevo.`
- Botón: `Reintentar` (reintenta desde el paso 3, no vuelve a generar claves)
- VERA informa del error en el chat

---

## 7. Notas y excepciones al sistema base

- El servidor **nunca recibe** la passphrase, la wrapping key ni la clave privada en claro. El payload enviado es exclusivamente `{encrypted_key_blob, key_iv, argon2_salt, kdf_params}`.
- Los textos de los pasos deben estar redactados para el usuario no técnico: "Generando tu par de claves" en lugar de "X25519 keypair generation". La descripción técnica es solo referencia interna de esta spec.
- El paso 2 (Argon2id con `m:65536`) puede tardar hasta ~500ms de forma intencionada por diseño de seguridad — el rodamiento girando en ese paso es el indicador visual de esa espera esperada.
- Sin top nav completo — cabecera mínima con logo.

---

## 8. Prioridad de construcción

- [ ] Alta — paso crítico e irreversible del flujo de activación.

---

*Spec REG-07 · v1.0 · Bearingworld.io · Junio 2026*
