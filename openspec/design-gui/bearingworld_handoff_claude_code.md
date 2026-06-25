# Bearingworld.io — Handoff para Claude Code
**Fecha:** Junio 2026 · **Desde:** Claude Sonnet 4.6 (chat) → **Hacia:** Claude Code

---

## 1. Contexto del proyecto

**Bearingworld.io** es una plataforma B2B de distribución de rodamientos industriales. Se está construyendo con metodología **Spec-Driven Development (SDD)** usando **OpenSpec (Fission-AI)** sobre GitHub.

- **Repo:** `github.com/aguillensp-sudo/BearingWorld.io`
- **Documentos funcionales de origen:** `/docs/` del repo (PRD v1.1, Tech Stack & AI Costs v1.1, ADR-001, Inventario Maestro de Pantallas v1.1, Módulo 01 v1.5)
- **OpenSpec:** `openspec/specs/` (specs vigentes) · `openspec/changes/` (propuestas en curso)

---

## 2. Fase actual

Estamos en la **fase de prototipado visual HTML/CSS** de las pantallas, paralela a la fase de análisis técnico SDD. Los prototipos HTML son specs visuales de referencia para el agente de implementación React.

**Lo que se ha completado hasta ahora:**

### Sistema de diseño — APROBADO Y CERRADO
- **Tipografía:** sistema Z.ai — Montserrat 700 28px (títulos) · Montserrat 600 14px uppercase (eyebrow/módulo) · Inter 400 16px (body) · Inter 500 12px (labels) · Inter 400 13px (inputs) · IBM Plex Mono 10px uppercase (field hints)
- **Paleta:** Deep Steel Dark `#111827` (brand bar) · Deep Steel `#1B2537` (nav/sidebar) · Warm Cream `#FAF8F4` (VERA) · Cold White `#F1F3F6` (content bg) · Brass `#B8924A` · Calibration Blue `#2563EB` · Steel Mist `#6B7A99`
- **Shell:** brand bar 24px + nav bar 46px + sidebar overlay + panel contenido 67% + VERA 33%
- **VERA:** arrastrable por el borde izquierdo · colapsable a 32px · expandible hasta 50%
- **Sidebar:** overlay puro (no empuja el layout) · abre con hamburguesa · 200ms ease

### Documentos de sistema base — en "C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\openspec\design-gui\specs y html aprobados\"
| Archivo | Estado |
|---|---|
| `bearingworld_app_shell.html` | APROBADO — shell base funcional con VERA arrastrable |
| `bearingworld_app_shell_spec_3.md` | APROBADO v1.1 |
| `bearingworld_sistema_base_7.md` | APROBADO v1.2 — incluye plantilla de spec |
| `frontend-design-SKILL-completo_3.md` | APROBADO — incluye protocolo de verificación pre-entrega |

### Pantalla REG-01 — APROBADA
| Archivo | Estado |
|---|---|
| `REG-01 · FRO v1.4.html` | APROBADO — HTML definitivo (PO lo renombrará) |
| `REG-01 · FRO v1.4.html.md` | APROBADO v1.4 |

### Specs de pantalla escritas (pendientes de HTML)
Todas en `outputs/` como archivos `.md`:
- `bearingworld_spec_REG-00.md` — FSR formulario solicitud registro
- `bearingworld_spec_REG-00-WAIT.md` — pantalla de espera aprobación
- `bearingworld_spec_REG-05.md` — introducción E2EE
- `bearingworld_spec_REG-06.md` — establecer backup passphrase
- `bearingworld_spec_REG-07.md` — generación de claves
- `bearingworld_spec_REG-09.md` — bienvenida y usuarios adicionales
- `bearingworld_spec_FRU.md` — formulario usuario adicional
- `bearingworld_spec_INVT-01_REC-01_SET-SEC-01.md` — gestión invitaciones, recuperación clave, cambiar passphrase
- `bearingworld_spec_SRCH-01.md` — resultados búsqueda (prototipo v2 incompleto — falta columna Empresa)

---

## 3. Reglas del sistema de diseño (OBLIGATORIAS)

### Layout
- Shell completo: brand bar (24px `#111827`) + nav bar (46px `#1B2537`) + sidebar overlay + contenido (67%) + VERA (33%)
- Sin shell SOLO: REG-00 y REG-00-WAIT (fondo Deep Steel + tarjeta blanca + VERA)
- Sidebar: overlay puro, no empuja el layout
- VERA: arrastrable por borde izquierdo (`position:absolute; left:0; top:0; bottom:0; width:5px; cursor:col-resize`) · colapsable a 32px · expandible hasta 50%
- Shell `position:fixed; inset:0` para garantizar fullscreen

### Formularios
- El bloque de formulario llena su panel del 67% (max-width 900px, padding 48px)
- Los campos se ensanchan para aprovechar el ancho — NO columna estrecha centrada
- Longitud máxima de campos: con atributo `maxlength`, no con width visual
- Grid proporcional: campos cortos en pares (CP+Dirección 2.5fr/1fr) · campos largos en span 2
- Todos los datos de ejemplo van en `placeholder`, NUNCA en `value`

### Componentes de formulario (del CSS de referencia)
```css
/* Labels */
.field-label { font-size:12px; font-weight:500; letter-spacing:0.01em; }

/* Inputs */
.field-input { padding:10px 12px; border:1px solid; border-radius:3px; font-size:13px; }
.field-input:focus { border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
.field-input::placeholder { color:#9BA4B0; }

/* Field hints */
.field-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; color:#6B7A99; }

/* Sensitive tag */
.sensitive-tag { font-family:'IBM Plex Mono',monospace; font-size:9px; background:rgba(220,38,38,0.06); color:#dc2626; padding:2px 5px; border-radius:2px; text-transform:uppercase; }

/* Tags input */
.tag { background:rgba(184,146,74,0.08); border:1px solid rgba(184,146,74,0.28); font-family:'IBM Plex Mono',monospace; font-size:12px; border-radius:2px; }

/* Radio option — con descripción secundaria en mono */
.radio-option { border:1px solid; border-radius:3px; padding:12px 14px; }
.radio-option.checked { border-color:#2563EB; background:rgba(37,99,235,0.08); }
.radio-option-desc { font-family:'IBM Plex Mono',monospace; font-size:11px; }

/* Checkbox field */
.checkbox-field { border:1px solid; border-radius:3px; padding:14px; background:#FAF8F4; }
.checkbox-field.checked { border-color:#2563EB; background:rgba(37,99,235,0.08); }

/* Role notice / brass block */
.role-notice { border-left:3px solid #B8924A; background:rgba(184,146,74,0.08); border-radius:0 3px 3px 0; }

/* Or divider */
.or-divider { font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; }

/* Buttons */
.btn-primary { background:#2563EB; border-radius:3px; font-size:14px; font-weight:600; letter-spacing:0.02em; }
.btn-primary:disabled { background:rgba(37,99,235,0.32); cursor:not-allowed; }
.btn-google { background:white; border:1px solid #dadce0; }

/* Section divider */
.section-divider { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; }

/* PW strength */
.pw-bar { height:3px; border-radius:1px; } /* warm=#B8924A · hot=#16a34a */
```

### VERA
- Header: bearing SVG (brass) + nombre "VERA" (Montserrat 700 15px) + subtítulo contextual (IBM Plex Mono 10px uppercase) + punto verde `#16a34a`
- Burbujas VERA: fondo blanco · `border-left:2px solid #B8924A`
- Burbujas usuario: fondo `#1B2537` · texto `#dde2ea`
- Sugerencias clickables bajo el input
- Resize handle: `position:absolute; left:0; top:0; bottom:0; width:5px; cursor:col-resize`

---

## 4. Protocolo de verificación pre-entrega (del SKILL.md)

Antes de entregar cualquier HTML, verificar en este orden:

1. **Shell completo** — CSS+HTML+JS copiados íntegros del shell base. Verificar que brand bar + nav + contenido + VERA llenan el 100% del viewport.
2. **VERA arrastrable** — el resize handle (`position:absolute; left:0`) funciona. El toggle funciona. Shell usa `position:fixed; inset:0`.
3. **Proporciones** — contenido 67% (`flex:1`) + VERA 33% (`width:33%; flex-shrink:0`). Sin grises sobrantes.
4. **Placeholders** — datos de ejemplo en `placeholder`, nunca en `value`. Solo excepción: campos pre-rellenos desde FSR (Ruta 00.2, indicado en el spec).
5. **Grid proporcional** — campos largos (≥100 chars) en span 2. Pares cortos con proporciones 2.5fr/1fr o similares.
6. **Textos literales** — copiar exactamente los textos del spec aprobado. Cero paráfrasis.
7. **Orden de campos** — seguir el número de fila de la tabla del spec sin reordenar.

---

## 5. Orden de trabajo — próximas pantallas

### Siguiente inmediato: REG-00  → REG-00-WAIT  → REG-05 → REG-06 → REG-07 → REG-09
El flujo post REG-01 es:
```
REG-01 (aprobada) → REG-00  → REG-00-WAIT  → REG-05 → REG-06 → REG-07 → REG-09
```

Todas usan **shell completo** menos REG-00 y REG-01 Sus specs ya están escritas en outputs/.

### Pendiente de corrección antes de avanzar: SRCH-01
El prototipo HTML v2 de SRCH-01 tiene un error conocido: **falta la columna "Empresa"** en la tabla de resultados. Debe corregirse antes de darlo por aprobado.

### Orden completo de pantallas (Inventario Maestro v1.1)
```
Módulo 01 — Onboarding:
  REG-00, REG-00-WAIT (sin shell) · REG-01 ✓ · REG-05 · REG-06 · REG-07 · REG-09 · FRU · INVT-01 · REC-01 · SET-SEC-01

Módulo 02 — Inventario:
  INV-01 · INV-02 · INV-03 · INV-04 · INV-05 · INV-07

Módulo 03 — Búsqueda:
  SRCH-01 (spec ✓, HTML incompleto) · SRCH-02

Módulo 04 — Mensajería:
  MSG-01 · MSG-02 · MSG-03 · MSG-04

Módulo 05 — Directorio:
  DIR-01 · DIR-02

Módulo 06 — Foros:
  FORO-01 · FORO-02 · FORO-03

Módulo 07 — Admin/Settings:
  SET-01 · SET-SEC-01 (spec ✓) · SET-USERS-01
```

---

## 6. Nine capabilities SDD (estado)

| # | Capability | Tipo spec | Estado |
|---|---|---|---|
| 1 | e2ee-key-management | FULL | spec en openspec/specs/ |
| 2 | organization-onboarding | Lite | spec en openspec/specs/ |
| 3 | inventory-management | Lite | pendiente |
| 4 | conversational-search | Lite | pendiente |
| 5 | messaging-and-negotiation | FULL | pendiente |
| 6 | vera-agent | Lite | pendiente |
| 7 | billing-subscription | Lite | pendiente |
| 8 | organization-directory | Lite | pendiente |
| 9 | community-forum | Lite | pendiente |

---

## 7. Archivos de referencia clave

Todos estos archivos deben estar en el repo o en el directorio de trabajo:

| Archivo | Descripción |
|---|---|
| `bearingworld_app_shell.html` | Shell HTML base aprobado — heredar para todas las pantallas |
| `bearingworld_app_shell_spec_3.md` | Spec del shell v1.1 |
| `bearingworld_sistema_base_7.md` | Sistema base + plantilla de spec v1.2 |
| `frontend-design-SKILL-completo_3.md` | SKILL.md de frontend con protocolo de verificación |
| `REG-01 · FRO v1.4.html` | HTML aprobado de REG-01 — referencia de componentes |
| `REG-01 · FRO v1.4.html.md` | Spec aprobada v1.4 de REG-01 |
| Specs de pantallas pendientes | Ver sección 2 |

---

## 8. Decisiones de diseño tomadas y cerradas

Estas decisiones están cerradas — no reabrir salvo petición explícita del PO:

- Tipografía: sistema Z.ai (Montserrat + Inter + IBM Plex Mono) — NO Barlow Condensed
- Shell `position:fixed; inset:0` — es la única forma que garantiza fullscreen en todos los navegadores
- Sidebar: overlay puro, nunca empuja el layout
- VERA: 33% fijo, arrastrable, no hay porcentaje alternativo
- Formularios: Forma 1 (llena el panel del 67%) — NO tarjeta estrecha centrada
- Datos de ejemplo: siempre `placeholder`, nunca `value`
- Campo NIF/CIF: `sensitive-tag` rojo + icono candado en el label
- Google SSO: antes del `— o —`, que está antes de los campos de contraseña
- Role-notice brass: aparece en Sección 2 del FRO, antes del Google SSO
- Radio options: siempre con descripción secundaria en IBM Plex Mono
- T&C: como `checkbox-field` con estado visual (no un checkbox simple) — bloquea el submit

---

*Handoff document v1.0 · Bearingworld.io · Junio 2026*
*Preparado por Claude Sonnet 4.6 para Claude Code*
