# Revisar — Gaps de spec detectados · Junio 2026

> Generado tras creación de VND-01 y análisis de coherencia entre prototipos HTML y specs funcionales.
> Pendiente de decisión de producto antes de pasar a implementación.

---

## 🔴 CRÍTICO — Violación potencial de E2EE

~~**RESUELTO (Julio 2026, commit 1b691d5):** Adoptada Opción B (VND-01 metadata-only). VND-01 muestra solo Referencia, Organización, Estado, Fecha sin precios ni cantidades. Detalles se ven en MSG-02. Elevado a principio RNG-VND-01 en `Status_bearingworld.io a 1 de Julio de 2026.md`.~~

**Histórico:** VND-01 mostraba columnas `Precio/ud.`, `Cantidad`, `Plazo` y `Transporte` para todas las ofertas, violando la arquitectura zero-knowledge. Decisión requerida entre Opción A (E2EE puro en cliente) u Opción B (simplificación V1). → DECIDIDO: Opción B.

---

## 🟠 IMPORTANTE — Tres gaps de spec

### 1. ~~No existe `Rinworld_spec_VND-01.md`~~

~~**RESUELTO (Julio 2026, commit bc70b0e):** El spec funcional existe en `openspec/design-gui/specs y html aprobados/specs/Rinworld_spec_VND-01.md`.~~

**Histórico:** Faltaba documento funcional que describa VND-01 más allá del HTML aprobado.

### 2. `Módulo04_Mensajeria_v1.5.md` no contempla una vista cross-thread de ofertas

El spec solo habla de:
- MSG-01 — lista de hilos
- MSG-02 — vista del hilo
- MSG-03 — componente dentro de MSG-02
- MSG-04 — ficha de organización
- MSG-05 — directorio

La idea de agregar todas las ofertas de todos los hilos en un solo panel ("mis ofertas enviadas") es nueva y no está referenciada en ningún lado del funcional. El agente de backend no sabrá qué API construir.

**Acción:** Añadir sección en `Módulo04_Mensajeria_v1.5.md` — "Vista agregada de ofertas del vendedor (VND-01)" con reglas E2EE y referencia al spec de pantalla.

### 3. ~~Número de módulo incorrecto en `index.html`~~

~~**RESUELTO (Agosto 2026, TAREA 6):** `index.html` ahora muestra "Vendiendo · vista de Módulo 04" reflejando que VND-01 es una vista dentro del Módulo 04 (Mensajería / Negociación), no un módulo independiente.~~

**Histórico:** `index.html` mostraba erróneamente "Módulo 04 — Vendiendo".

---

## 🟡 ACLARACIÓN — Nomenclatura divergente MSG-04 / DIR-02

El spec funcional (`Módulo 04`, sección 8.3) llama `MSG-04` a la ficha pública de organización. El prototipo HTML la implementó como `DIR-02 · DIR v1.0.html`. Son la misma pantalla, distinto nombre.

El agente de backend podría construir dos endpoints distintos creyendo que son pantallas separadas.

**Acción:** Añadir nota en `Módulo04_Mensajeria_v1.5.md` y en `Rinworld_spec_DIR-01.md` aclarando que `DIR-02 = MSG-04`.

Idem con `MSG-05` (directorio en el spec) = `DIR-01` en el prototipo.

---

## 🔵 GAP PARALELO — "Comprando" sin equivalente a VND-01

Si VND-01 es "mis ofertas enviadas" (perspectiva vendedor), la perspectiva compradora debería tener "mis consultas enviadas + ofertas recibidas" como vista propia. Ahora mismo `Comprando` apunta a SRCH-01 (búsqueda), que es correcto como punto de entrada, pero no existe un panel equivalente para el lado comprador.

Puede ser una decisión de diseño deliberada (el comprador siempre empieza desde búsqueda), pero debería quedar explícito en el spec para que el backend no lo interprete como un olvido.

**→ DECISIÓN PENDIENTE DE PRODUCT OWNER**

---

## Tabla de acciones

| Documento | Acción | Bloqueado por |
|---|---|---|
| `Rinworld_spec_VND-01.md` | CREAR — spec completo | Decisión E2EE (Opción A o B) |
| `Módulo04_Mensajeria_v1.5.md` | AÑADIR sección VND-01 + nota MSG-04=DIR-02 | Decisión E2EE |
| `gaps-register.md` | AÑADIR GAP-005 (E2EE en VND-01) + GAP-006 (MSG-04/DIR-02) | — |
| `index.html` | CORREGIR etiqueta "Módulo 04 — Vendiendo" | — |

---

*Análisis generado por Claude Sonnet 4.6 · 29 Jun 2026*
