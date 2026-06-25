# Bearingworld.io — Spec del App Shell
**Documento base · Todas las pantallas autenticadas heredan de este shell**
*v1.1 · Junio 2026*

---

## 1. Concepto

El App Shell es la estructura permanente de la aplicación que envuelve el contenido de cada pantalla. Se construye una sola vez y actúa como contenedor fijo. Cualquier cambio en el shell se propaga automáticamente a todas las pantallas.

**Hay dos modos de shell:**
- **Shell completo** — todas las pantallas de la plataforma menos las que se indican explícitamente como "sin shell".
- **Sin shell** — únicamente REG-00 y REG-00-WAIT. Todas las demás pantallas usan shell completo.

---

## 2. Estructura del shell completo

```
┌─────────────────────────────────────────────────────────────────┐
│  BRAND BAR (24px · Deep Steel oscuro · no interactiva)         │
├─────────────────────────────────────────────────────────────────┤
│  NAV BAR (46px · Deep Steel #1B2537 · siempre visible)         │
├───────────────────────────────────────────────┬─────────────────┤
│                                               │                 │
│   PANEL DE CONTENIDO                          │   PANEL VERA    │
│   Blanco #FFFFFF                              │   Warm Cream    │
│   ~55% del viewport                           │   #FAF8F4       │
│   (se expande cuando VERA colapsa)            │   ~33% inicial  │
│                                               │   (expandible   │
│                                               │   hasta 50%)    │
│                                               │                 │
├───────────────────────────────────────────────┴─────────────────┤
│  SIDEBAR OVERLAY (Deep Steel · oculta por defecto)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Brand Bar (capa superior)

### 3.1 Especificación

| Propiedad | Valor |
|---|---|
| Alto | 24px |
| Fondo | `#111827` (Deep Steel más oscuro que el nav) |
| Posición | Fija en la parte superior · por encima del nav bar |
| Interactividad | Ninguna — barra puramente informativa/corporativa |
| Font | Inter 400 · 10px · mayúsculas · letter-spacing 0.08em |
| Color de texto | `rgba(255,255,255,0.45)` |

### 3.2 Contenido — tres zonas

| Zona | Texto |
|---|---|
| Izquierda | `ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY` |
| Centro | `CONNECT · TRADE · SECURE` |
| Derecha | `INDUSTRIAL INTELLIGENCE NETWORK` |

---

## 4. Nav Bar (capa principal)

### 4.1 Especificación

| Propiedad | Valor |
|---|---|
| Alto | 46px |
| Fondo | Deep Steel `#1B2537` |
| Posición | Fija · inmediatamente bajo la brand bar · siempre visible |
| Z-index | Por encima del contenido y de la sidebar overlay |

### 4.2 Zona izquierda

- **Botón hamburguesa** — abre/cierra la sidebar overlay. Icono: tres líneas horizontales en blanco. Sin texto.
- **Logo** — icono SVG del rodamiento (bearing) en Brass `#B8924A` + texto `BEARINGWORLD` en Barlow Condensed 700 · 15px · blanco con `WORLD` en Brass. Espacio reservado hasta tener logotipo definitivo.
- **Separador vertical** — 1px · `rgba(255,255,255,0.15)` · 18px de alto.

### 4.3 Zona central — ítems de navegación

Orden fijo inamovible:

| Nº | Ítem | Ruta destino |
|----|---|---|
| 1 | Panel | /dashboard |
| 2 | Vendiendo | /selling |
| 3 | Comprando | /buying |
| 4 | Hilos | /threads |
| 5 | Empresas | /directory |
| 6 | Foros | /forum |
| 7 | Contacto | /contact |

**Estado activo:** subrayado azul `#2563EB` en el borde inferior del ítem · texto blanco · sin cambio de fondo.
**Estado inactivo:** texto `rgba(255,255,255,0.55)` · sin subrayado.
**Hover:** texto `rgba(255,255,255,0.9)`.
**Font:** Inter 500 · 12px · sin text-transform.

### 4.4 Zona derecha

- **Nombre de la empresa** — Inter 500 · 11px · blanco · alineado a la derecha.
- **Nombre del usuario** — Inter 400 · 11px · `rgba(255,255,255,0.45)` · bajo el nombre de empresa.
- **Botón Cerrar sesión** — fondo `rgba(255,255,255,0.07)` · borde `0.5px rgba(255,255,255,0.14)` · texto `rgba(255,255,255,0.65)` · 11px · border-radius 4px.

---

## 5. Sidebar Overlay

### 5.1 Comportamiento

| Estado | Descripción |
|---|---|
| Por defecto | Oculta. No ocupa espacio en el layout. |
| Al abrir | Se despliega sobre el contenido (no empuja el layout). Aparece un overlay oscuro `rgba(0,0,0,0.38)` sobre el resto de la pantalla. |
| Al cerrar | Clic en el overlay oscuro, en el botón ✕ de la sidebar, o en cualquier ítem de navegación. |
| Animación | Deslizamiento desde la izquierda · `transform: translateX` · 200ms ease. |

### 5.2 Estructura interna

- **Cabecera:** logo (mismo que nav bar) + botón ✕ de cierre.
- **Navegación:** mismos 7 ítems que el nav bar en formato vertical con icono Tabler + texto.
- **Ítem activo:** sincronizado con el ítem activo del nav bar. Border-left 2px azul `#2563EB` · fondo `rgba(37,99,235,0.12)`.
- **Separador:** entre navegación y footer.
- **Icono de Configuración** (al pie, antes del usuario): icono `ti-settings` + texto `Configuración`. Redirige a la sección de ajustes de organización y usuarios.
- **Usuario:** avatar circular con iniciales en Brass + nombre completo + nombre de organización.

### 5.3 Iconos por ítem

| Ítem | Icono Tabler |
|---|---|
| Panel | `ti-layout-dashboard` |
| Vendiendo | `ti-tag` |
| Comprando | `ti-shopping-cart` |
| Hilos | `ti-messages` |
| Empresas | `ti-building` |
| Foros | `ti-notes` |
| Contacto | `ti-headset` |
| Configuración | `ti-settings` |

---

## 6. Panel VERA

### 6.1 Especificación

| Propiedad | Valor |
|---|---|
| Fondo | Warm Cream `#FAF8F4` |
| Anchura inicial | ~33% del viewport |
| Anchura mínima (colapsada) | 32px — franja visible con etiqueta vertical "VERA" |
| Anchura máxima (expandida) | 50% del viewport |
| Borde izquierdo | `0.5px solid rgba(184,146,74,0.18)` |
| Posición | Panel derecho · siempre visible salvo excepción de pantalla |
| Animación de colapso/expansión | `width` transition · 200ms ease |

### 6.2 Comportamiento de colapso y expansión

- **Botón de toggle** — posicionado en el borde izquierdo del panel VERA, centrado verticalmente. Fondo Warm Cream · borde brass tenue · border-radius en esquinas izquierdas.
  - Icono `ti-chevron-right` cuando VERA está visible → colapsar.
  - Icono `ti-chevron-left` cuando VERA está colapsada → expandir.
- **Cuando VERA se colapsa:** el panel de contenido se expande para ocupar el espacio liberado, dejando el mínimo de 32px visible (etiqueta vertical "VERA" clickable).
- **Cuando VERA se expande al máximo (50%):** el panel de contenido se contrae al 50% restante.

### 6.3 Estructura interna del panel VERA

- **Cabecera fija:** icono rodamiento SVG en círculo Deep Steel + nombre `VERA` en Barlow Condensed 700 · 16px + subtítulo contextual por pantalla + punto de estado verde `#16a34a`.
- **Área de chat:** scrollable verticalmente · padding 12px · gap entre mensajes 10px.
- **Burbujas usuario:** fondo Deep Steel · texto blanco · border-bottom-right-radius 3px.
- **Burbujas VERA:** fondo blanco · texto Deep Steel · borde `0.5px solid rgba(184,146,74,0.2)` · border-bottom-left-radius 3px.
- **Timestamps:** Inter 400 · 12px · Steel Mist.
- **Input de texto:** fondo blanco · borde brass tenue · border-radius 7px · font-size 14px. Al enfocar: borde Calibration Blue.
- **Botón enviar:** cuadrado 32px · Calibration Blue · icono `ti-send` blanco.

---

## 7. Pantallas pre-autenticación (sin shell)

### 7.1 Comportamiento

Las pantallas REG-00 y REG-00-WAIT **no usan el shell completo**. En su lugar:

- **Fondo:** Deep Steel `#1B2537` · con el icono SVG del rodamiento centrado en baja opacidad (`opacity: 0.06`) como textura de fondo.
- **Cabecera mínima:** barra de 46px en Deep Steel con logo (bearing SVG + texto BEARINGWORLD) a la izquierda y un separador + etiqueta de contexto. Sin ítems de navegación.
- **Tarjeta de formulario:** fondo blanco `#FFFFFF` · border-radius 8px · max-width 520px · centrada horizontal y verticalmente · con scroll interno si el contenido supera la altura disponible.
- **Panel VERA:** visible a la derecha, ocupando ~33% del viewport · mismo comportamiento de colapso que en el shell completo.
- **Sin sidebar.**

### 7.2 Layout pre-autenticación

```
┌─────────────────────────────────────────────────────────────────┐
│  CABECERA MÍNIMA (46px · Deep Steel)                           │
├─────────────────────────────────────────────────────┬───────────┤
│                                                     │           │
│   FONDO DEEP STEEL                                  │  VERA     │
│   con rodamiento SVG watermark (opacity 0.06)       │  ~33%     │
│                                                     │           │
│      ┌──────────────────────────────┐               │           │
│      │  TARJETA FORMULARIO         │               │           │
│      │  Blanco · max-width 520px   │               │           │
│      │  border-radius 8px          │               │           │
│      └──────────────────────────────┘               │           │
│                                                     │           │
└─────────────────────────────────────────────────────┴───────────┘
```

---

## 8. Sistema tipográfico global

| Elemento | Fuente | Peso | Tamaño |
|---|---|---|---|
| Títulos de pantalla | Montserrat | 700 | 28px | letter-spacing 0.5px |
| Subtítulos / módulos | Montserrat | 600 | 14px | uppercase · letter-spacing 1.5px |
| Texto UI / cuerpo | Inter | 400 | 16px | — |
| Labels de campo | Inter | 500 | 14px | — |
| Referencias y códigos | IBM Plex Mono | 400 / 500 | 14–15px |
| Subtítulos de sección | Inter | 500 | 13px |
| Texto secundario / meta | Inter | 400 | 12–13px |
| Timestamps | Inter | 400 | 12px |
| Brand bar | Inter | 400 | 10px · uppercase · letter-spacing 0.08em |

---

## 9. Paleta de colores global

| Nombre | Hex | Uso |
|---|---|---|
| Deep Steel Dark | `#111827` | Brand bar |
| Deep Steel | `#1B2537` | Nav bar · sidebar · burbujas usuario VERA · avatar |
| Blanco | `#FFFFFF` | Fondo panel contenido · tarjeta formulario · burbujas VERA |
| Warm Cream | `#FAF8F4` | Fondo panel VERA |
| Cold White | `#F1F3F6` | Chips · fondo tabla cabecera |
| Calibration Blue | `#2563EB` | Acción primaria · botones · links · ítem activo nav |
| Brass | `#B8924A` | Logo · favoritos · avatar · acentos de confianza |
| Steel Mist | `#6B7A99` | Texto secundario · placeholders · bordes · labels inactivos |
| Verde éxito | `#16a34a` | Punto de estado VERA · qty disponible · confirmaciones |
| Naranja aviso | `#d97706` | Datos obsoletos (antigüedad > 7 días) |

---

## 10. Sistema de botones global

| Tipo | Estilo | Cuándo |
|---|---|---|
| Primario | Fondo `#2563EB` · texto blanco · border-radius 4px · 15px | Todas las acciones |
| Primario deshabilitado | Mismo azul · opacidad 35% · cursor `not-allowed` | Campo requerido vacío / condición no cumplida |
| Google SSO | Fondo blanco · borde 1px `#dadce0` · texto `#1B2537` · icono Google a color | Única excepción · solo en pantallas de autenticación |

**No existen botones secundarios.**

---

## 11. Anchura máxima de formularios — RESTRICCIÓN CRÍTICA

Los formularios dentro del panel de contenido tienen un **max-width estricto de 520px**, centrados horizontalmente dentro del panel. 

**Esto aplica a:**
- Todos los inputs, textareas y campos de formulario
- El contenedor del formulario en pantallas pre-autenticación

**Razón:** Los campos no deben estirase al 100% del panel de contenido. Esto genera una experiencia visual pobre — inputs demasiado anchos reducen la legibilidad y rompen la proporción visual del diseño.

**Implementación CSS:**
```css
.bwform-wrap,
.bwgrid,
input, textarea, select {
  max-width: 520px;
}
```

Este límite se respeta incluso si el viewport es más ancho.

---

## 13. Componentes reutilizables definidos en el shell

| Componente | Descripción |
|---|---|
| Chip de filtro | Pill · fondo Cold White · borde 0.5px · Inter 500 · 12px. Variante discontinua para "Añadir filtro". |
| Tag input | Campo con tags añadibles/eliminables. Tags: Calibration Blue tenue · border-radius 100px. |
| Badge de marca | `display:inline-flex` · fondo `rgba(27,37,55,0.07)` · border-radius 4px · Inter 500 · 11px. |
| Badge de país | IBM Plex Mono · fondo `rgba(27,37,55,0.06)` · border-radius 3px · 11px. Muestra código ISO 2 letras. |
| Bloque informativo brass | Border-left 3px Brass · fondo `rgba(184,146,74,0.07)` · icono Tabler + texto Steel Mist. Para avisos no críticos. |
| Separador de sección | Línea 0.5px + etiqueta centrada · Inter 500 · 13px · Steel Mist. |
| Indicador de estado (rodamiento) | SVG del rodamiento girando en Brass. Usado en estados de procesamiento (REG-07, REG-00-WAIT). |
| Highlights VERA | Mini-tarjeta azul tenue con referencia monoespaciada + detalle + cantidad. Usado en SRCH-01. |

---

*App Shell Spec · v1.1 · Bearingworld.io · Junio 2026*
