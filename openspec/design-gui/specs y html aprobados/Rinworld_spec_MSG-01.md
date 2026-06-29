# Spec de Pantalla — `MSG-01` · Lista de Hilos

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | MSG-01 |
| Nombre | Lista de Hilos |
| Módulo | 04 — Mensajería E2EE, Consultas y Negociación |
| Referencia funcional | Inventario Maestro v1.1 § 5.1 · Módulo 04 v1.5 § 4.1 · spec messaging-and-negotiation: single-thread-model, e2ee-content-encryption |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Hilos**
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde el menú principal

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 04 · Mensajería E2EE
```

### Título de la pantalla
```
Hilos
```

### Subtítulo
```
Tus conversaciones con otros distribuidores. Todo el contenido está cifrado de extremo a extremo.
```

---

### Componentes presentes

**Aviso E2EE (bloque brass permanente — si passphrase no activa en la sesión):**

> **Contenido cifrado** — Introduce tu frase de seguridad para ver el contenido de los hilos.
> [Botón primario: `Introducir frase de seguridad`]

Este aviso sustituye al contenido de los hilos mientras la passphrase no esté activa. Los metadatos (nombre de la organización, timestamp, estado) sí son visibles siempre.

**Barra de acciones (encima de la lista)**

- Input de búsqueda: `Buscar por nombre de organización...` — filtra la lista al pulsar Enter
- Botón primario: `Nuevo contacto` → abre DIR-01 (Directorio de Organizaciones) para iniciar un hilo

**Lista de hilos**

Una fila por hilo, ordenada por fecha del último elemento descendente (el hilo con actividad más reciente aparece primero). Máximo 25 hilos activos iniciados en el mismo día natural.

Cada fila muestra:

| Elemento | Descripción |
|---|---|
| Nombre de la organización contraparte | Inter 500 · 14px · ink |
| Badge de país | IBM Plex Mono · 11px · código ISO 2 letras |
| Vista previa del último elemento | Texto truncado de **metadatos únicamente** — nunca contenido descifrado. Ej: `Tarjeta de consulta · 6205-2RS` o `Mensaje libre` o `Tarjeta de oferta · 22316-E`. Si passphrase no activa: `• • • • • •` |
| Badge de estado del hilo | Ver tabla de estados más abajo |
| Indicador de no leídos | Punto azul + recuento si hay elementos no leídos |
| Timestamp del último elemento | Relativo · IBM Plex Mono · 11px · Steel Mist |

**Estados del hilo — badges de color:**

| Estado | Color | Descripción |
|---|---|---|
| ABIERTO | Steel Mist (gris) | Hilo con conversación activa sin consulta ni oferta pendiente |
| CON CONSULTA PENDIENTE | Azul `#2563EB` | Hay al menos una tarjeta de consulta sin respuesta |
| CON OFERTA PENDIENTE | Naranja `#d97706` | Hay al menos una tarjeta de oferta sin aceptar ni rechazar |
| ACUERDO ALCANZADO | Verde `#16a34a` | Se ha marcado explícitamente que se alcanzó un acuerdo |
| CERRADO SIN ACUERDO | Steel Mist con tachado | Se cerró sin acuerdo — solo lectura |

**Paginación:** 30 hilos por página. Server-side.

---

### Datos de ejemplo

```
Passphrase: activa en la sesión

Hilos (5):
  NSK Europe Ltd          · DE · Tarjeta de oferta · 6205-2RS           · CON OFERTA PENDIENTE [naranja] · hace 2h   · ● 1
  Schaeffler Iberia SL    · ES · Tarjeta de consulta · NU2210-E-TVP2    · CON CONSULTA PENDIENTE [azul]  · hace 5h
  SKF Nordic AB           · SE · Mensaje libre                           · ABIERTO [gris]                 · hace 1d
  Timken Europe GmbH      · DE · Tarjeta de oferta · 22316-E            · ACUERDO ALCANZADO [verde]       · hace 3d
  NTN-SNR Roulements      · FR · Mensaje libre                           · CERRADO SIN ACUERDO [tachado]  · hace 7d
```

---

## 4. Formulario

No aplica. MSG-01 es una pantalla de navegación.

---

## 5. Panel VERA

**Estado:** Activa — modo mensajería.

**Subtítulo del panel:** `Agente de mensajería`

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Tienes 2 hilos con actividad reciente. NSK Europe Ltd te ha enviado una oferta para el 6205-2RS y Schaeffler Iberia tiene una consulta pendiente de respuesta. ¿Quieres que te lleve a alguno?
>
> **Usuario dice:**
> Abre el hilo con NSK
>
> **VERA responde:**
> Abriendo el hilo con NSK Europe Ltd.
> [Redirige a MSG-02 con ese hilo]

**Nota:** VERA comunica solo metadatos (organización, referencia, tipo de elemento) — nunca contenido cifrado (cantidades, precios, texto de mensajes).

---

## 6. Estados especiales

**Passphrase no activa en la sesión:**
- Vista previa de todos los hilos muestra `• • • • • •`
- Bloque brass con botón `Introducir frase de seguridad`
- Los badges de estado, timestamps y nombres de organización sí son visibles

**Sin hilos (primer acceso o sin conversaciones):**
- Mensaje centrado: `Todavía no tienes ninguna conversación. Usa el Directorio para contactar con otras organizaciones.`
- Botón primario: `Ir al Directorio`

**Límite diario de 25 hilos nuevos alcanzado:**
- Al pulsar `Nuevo contacto`: aviso inline: `Tu organización ha alcanzado el límite de 25 hilos nuevos por día. Los hilos existentes siguen disponibles sin restricción.`

---

## 7. Notas y excepciones al sistema base

- La vista previa del último elemento **nunca muestra contenido descifrado** — solo metadatos (tipo de elemento, referencia si la hay). Esto es obligatorio por diseño E2EE.
- El estado del hilo se calcula exclusivamente a partir de metadatos del tipo de elemento y estado de tarjeta — **nunca requiere descifrado**.
- Entre dos organizaciones existe **exactamente un hilo único** — nunca dos hilos con la misma contraparte.
- El botón `Nuevo contacto` no crea el hilo directamente — lleva al directorio para que el usuario elija la organización, y el hilo se crea (o reutiliza) al pulsar `Contactar` en DIR-01 o DIR-02.

---

## 8. Prioridad de construcción

- [x] **Alta** — pantalla de entrada a la funcionalidad diferencial de la plataforma.

---

*Spec MSG-01 · v1.0 · Bearingworld.io · Junio 2026*
