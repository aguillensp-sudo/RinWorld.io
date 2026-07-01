# Revisar — Gaps de spec detectados · Junio 2026

> Generado tras creación de VND-01 y análisis de coherencia entre prototipos HTML y specs funcionales.
> Pendiente de decisión de producto antes de pasar a implementación.

---

## 🔴 CRÍTICO — Violación potencial de E2EE

**Problema:** VND-01 muestra columnas `Precio/ud.`, `Cantidad`, `Plazo` y `Transporte` para todas las ofertas de todos los hilos. Según `Módulo 04 v1.5`, sección 3.3, esos campos son **contenido E2EE**, no metadata:

> *"Cifras de una tarjeta de oferta (unit_price, quantity, currency, condiciones) → NO — cifrado E2EE"*
> RNG-MSG-01 (CRÍTICA): *"El servidor nunca almacena ni procesa en texto plano el contenido de ningún elemento del hilo"*

Si el backend implementa un endpoint que sirve esos datos como un listado, **viola la arquitectura zero-knowledge** — el diferenciador central del producto.

**Decisión requerida — dos opciones:**

- **Opción A (E2EE puro):** VND-01 se renderiza completamente en cliente — el cliente pide todos los ciphertext de ofertas enviadas, los descifra localmente con su clave privada, y construye la tabla. El servidor nunca ve los datos en claro. Implica algo más de complejidad en frontend.
- **Opción B (simplificación V1):** VND-01 solo muestra metadata — Referencia, Organización, Estado, Fecha — sin precios ni cantidades. Para ver el detalle hay que entrar en MSG-02. Mucho más simple de implementar.

**→ DECISIÓN PENDIENTE DE PRODUCT OWNER**

---

## 🟠 IMPORTANTE — Tres gaps de spec

### 1. No existe `Rinworld_spec_VND-01.md`

Hay HTML aprobado (`VND-01 · VND v1.0.html`) pero ningún documento funcional que describa esta pantalla. El agente de implementación implementará lo que ve en el HTML sin entender las reglas E2EE. Hay que crear el spec **después de tomar la decisión E2EE**.

### 2. `Módulo04_Mensajeria_v1.5.md` no contempla una vista cross-thread de ofertas

El spec solo habla de:
- MSG-01 — lista de hilos
- MSG-02 — vista del hilo
- MSG-03 — componente dentro de MSG-02
- MSG-04 — ficha de organización
- MSG-05 — directorio

La idea de agregar todas las ofertas de todos los hilos en un solo panel ("mis ofertas enviadas") es nueva y no está referenciada en ningún lado del funcional. El agente de backend no sabrá qué API construir.

**Acción:** Añadir sección en `Módulo04_Mensajeria_v1.5.md` — "Vista agregada de ofertas del vendedor (VND-01)" con reglas E2EE y referencia al spec de pantalla.

### 3. Número de módulo incorrecto en `index.html`

`index.html` muestra "Módulo 04 — Vendiendo" pero Módulo 04 ya es Mensajería en todos los specs funcionales. VND-01 no es un módulo nuevo — es una vista dentro del Módulo 04 (Mensajería / Negociación).

**Acción:** Cambiar la etiqueta del index de "Módulo 04 — Vendiendo" a simplemente "Vendiendo" o "Vendiendo · vista de Módulo 04".

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
