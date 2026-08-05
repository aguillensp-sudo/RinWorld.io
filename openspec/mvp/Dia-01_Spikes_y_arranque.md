# Día 1 · Spikes y arranque · MVP Bearingworld.io

**Fecha:** miércoles 5 de agosto de 2026
**Ejecuta:** Claude Code · **Supervisa:** Álvaro
**Plan maestro:** `openspec/mvp/Plan_MVP_Bearingworld_v1.0.md`

> **Actualización · 5-ago-2026 (SP-1).** El **Coder** del arnés es **DeepSeek-V4-Flash**
> (`deepseek-v4-flash`, DeepSeek oficial, `DEEPSEEK_API_KEY`), no GLM-5.2/DeepInfra. Cambio por
> coste, validado en SP-1. Donde el documento diga GLM/DeepInfra, léase DeepSeek. Ver
> `findings-register.md` F-001.

> **Hoy no se construye producto.** Hoy se responden tres preguntas que ahora mismo son suposiciones y que, si se responden mal el día 12, hunden el plan. El único entregable de código es el documento de sistema de diseño, que es prerrequisito de todo lo demás.

---

## 0. Prerrequisitos de Álvaro — antes de arrancar

Sin esto, el día 1 se bloquea. Son unos 20 minutos.

| # | Acción | Necesario para |
|---|---|---|
| P1 | Crear proyecto **Supabase** (región europea, plan Free basta para el MVP). Guardar URL del proyecto, `anon key` y `service_role key`. | SP-3 |
| P2 | Crear/usar cuenta **DeepSeek oficial** y generar API key (`DEEPSEEK_API_KEY`) con acceso a `deepseek-v4-flash`. Cargar saldo mínimo. | SP-1 |
| P3 | Confirmar que las claves rotadas (Anthropic, LangSmith) están como variables de entorno de usuario, **no en ficheros del repo**. | SP-1, trazado |

Verificación rápida en PowerShell:

```powershell
$env:ANTHROPIC_API_KEY.Substring(0,12)
$env:LANGSMITH_API_KEY.Substring(0,12)
$env:DEEPSEEK_API_KEY.Substring(0,8)
$env:SUPABASE_URL
```

Los cuatro deben devolver valor. Ninguna de estas claves se escribe en ningún fichero del repositorio en ningún momento del proyecto.

---

## 1. Decisión de estructura — se toma al empezar

**El MVP vive en este mismo repositorio**, en un directorio `app/` nuevo, sobre la rama `mvp/bootstrap`.

Motivo: el arnés necesita leer las specs de `openspec/` y escribir código en la misma pasada. Separar specs y código en dos repos obliga a sincronizarlos manualmente en cada tarea del Coder, que es fricción pura y una fuente de desalineación silenciosa. Monorepo.

Los HTML del prototipo siguen en `openspec/design-gui/` sin tocarse, sirviendo GitHub Pages desde la raíz como hasta ahora. No se mueve ni se renombra nada.

```
BearingWorld.io/
├── openspec/            ← specs (fuente de verdad, sin cambios)
│   └── mvp/             ← plan, métricas, registros
├── app/                 ← NUEVO: la aplicación React
├── harness/             ← NUEVO: el grafo LangGraph (a partir del día 4)
└── index.html, docs/…   ← sin cambios
```

---

## 2. Bloque 1 · 09:00-10:00 — Extracción del sistema de diseño

**Es prerrequisito de SP-1:** GLM no puede producir un componente coherente sin las reglas de diseño, y hoy esas reglas viven atrapadas dentro de un string de Python en un script que además está roto.

Crear `openspec/architecture/design-system.md` con el contenido de las constantes `DESIGN_RULES` y `VERIFICATION_PROTOCOL` de `openspec/design-gui/generator/generate_screen.py`, reestructurado como documento:

1. **Tokens** — paleta, tipografía, espaciado, radios (valores exactos, tal cual)
2. **Layout del shell** — brand bar 24px, nav 72px, sidebar overlay, contenido 67% / VERA 33%
3. **Componentes** — inputs, labels, botones, chips, tags, radios, checkboxes, hints
4. **Reglas de comportamiento** — VERA arrastrable/colapsable, placeholders nunca en `value`, grid proporcional
5. **Protocolo de verificación** — los 7 puntos de comprobación previa a entrega

Corregir al pasarlo: el script dice `nav bar (46px …)` en un sitio y el Status dice 72px. **Manda el Status y el HTML aprobado.** Verificar el valor real en `Rinworld_app_shell.html` antes de escribirlo.

Añadir al final una sección **"Traducción a React"** vacía, con un encabezado por cada apartado. Se irá rellenando durante el MVP con las convenciones que se establezcan (nombres de tokens, estructura de componentes, dónde vive el CSS). Ese documento es lo que el Coder leerá en cada tarea a partir del día 4.

**Entregable:** `openspec/architecture/design-system.md` commiteado y pusheado.

---

## 3. Bloque 2 · 10:00-13:00 — SP-1 · ¿Sirve DeepSeek-V4-Flash?

El spike más largo y el más consecuente: toda la economía del stack v1.2 depende de que GLM sea utilizable como Coder.

### Montaje

Script Python mínimo — **sin LangGraph todavía**, una llamada directa a DeepInfra. Hoy se mide al modelo, no al grafo.

**Entrada que se le entrega:**

- `openspec/design-gui/specs y html aprobados/INV-01 · INV v1.0.html` (el HTML aprobado)
- `openspec/design-gui/specs y html aprobados/specs/Rinworld_spec_INV-01.md` (la spec)
- `openspec/architecture/design-system.md` (lo del bloque 1)
- Instrucción: producir `InventoryTable.tsx` — React 18 + TypeScript, sin dependencias más allá de React, estilos en CSS Modules, datos por props tipadas

**Salida esperada:** un único fichero `.tsx` que compile y renderice.

### Rúbrica de evaluación — 5 criterios, se necesitan 3 para aprobar

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | **Compila** sin errores de TypeScript | `tsc --noEmit` |
| C2 | **Renderiza reconocible** frente al HTML aprobado | Comparación visual lado a lado |
| C3 | **Usa los tokens** del design system, no valores inventados | Búsqueda de literales de color fuera de los tokens |
| C4 | **React idiomático** — sin `dangerouslySetInnerHTML`, sin manipular el DOM a mano, props tipadas | Lectura del código |
| C5 | **Lo mantendrías** o lo reescribirías desde cero | Juicio de Álvaro, y es el criterio que más pesa |

### Medición — obligatoria, es el objetivo 4

Registrar en `openspec/mvp/harness-metrics.csv` (crear hoy):

```csv
fecha,tarea,pantalla,modelo,tokens_in,tokens_out,coste_usd,intentos,minutos,resultado
2026-08-05,SP-1,INV-01,deepseek-v4-flash,,,,,,
```

Si falla a la primera, reintentar hasta 3 veces pasándole el error como feedback, y **registrar cada intento como fila propia**. La distribución de intentos hasta verde es una de las tres métricas que importan.

### Desenlaces

- **≥3 criterios** → GLM entra al camino crítico como estaba planeado.
- **<3 criterios** → GLM pasa a pista paralela de experimentación, Claude Code construye el MVP. Los objetivos 2 y 4 se cumplen igual: un fallo medido también es un dato, y evita construir V1 sobre un supuesto falso.
- **En cualquier caso** → el resultado se escribe en `findings-register.md`, clasificado como `MODEL`.

---

## 4. Bloque 3 · 14:00-15:30 — SP-3 · ¿Propaga Realtime?

Se hace antes que SP-2 porque es el pilar de "dos usuarios interactuando": si falla, cambia el plan entero, y conviene saberlo con margen de tarde.

### Montaje

1. En el proyecto Supabase, tabla mínima:

```sql
create table spike_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  sender text not null,
  body text not null,
  created_at timestamptz default now()
);
alter publication supabase_realtime add table spike_messages;
```

2. Página HTML suelta con el cliente JS de Supabase, suscrita a `postgres_changes` sobre esa tabla, filtrando por `thread_id`.

3. Abrirla en **dos contextos de navegador distintos** (uno normal, uno de incógnito).

### Criterio de éxito

- Insertar desde la pestaña A → aparece en la B **sin refrescar**
- Latencia percibida **< 1 segundo**
- Sobrevive a 20 inserciones seguidas sin perder ninguna
- La suscripción se reconecta sola tras cortar y restaurar la red

### Si falla

Es el spike menos probable que falle y el más grave si lo hace. Plan B: *polling* cada 2 segundos. Funciona para una demo, pero degrada el momento "aparece solo" y hay que registrarlo como `INFRA` en findings porque condiciona V1.

---

## 5. Bloque 4 · 15:30-17:00 — SP-2 · ¿Cifra el navegador?

### Montaje

Página HTML suelta, sin framework:

1. Generar dos pares de claves (comprador y vendedor) con `crypto.subtle.generateKey`
2. Derivar secreto compartido por ECDH
3. Cifrar un objeto de oferta realista con AES-256-GCM:
   ```json
   {"precio_ud": 4.20, "cantidad": 1250, "moneda": "EUR", "plazo_dias": 14, "transporte": "DAP"}
   ```
4. Mostrar en pantalla, en tres columnas: **claro** · **cifrado (lo que iría a Postgres)** · **descifrado por la otra parte**

Esa vista de tres columnas es el prototipo del panel de vista-servidor del día 11. No se tira.

### Aviso técnico — probablemente el hallazgo del día

`ADR-001` exige **X25519**. El soporte nativo de X25519 en WebCrypto es reciente y desigual entre navegadores. Comprobarlo **primero**:

```js
await crypto.subtle.generateKey({name:"X25519"}, true, ["deriveKey"])
```

- **Si funciona** → adelante, alineado con ADR-001.
- **Si no** → usar **ECDH P-256** para el MVP (soporte universal) y registrarlo como `SPEC-GAP` en findings. Esto es evidencia directa para **GAP-001** (selección del adaptador Signal Protocol), que lleva abierto desde junio: si X25519 no está disponible nativamente, la balanza se inclina hacia `libsodium.js` en V1. Sería la primera vez que el MVP paga una deuda de spec — exactamente el objetivo 3.

**Nunca**, ni en el spike ni después: passphrase, backup, recuperación o rotación de claves. Las claves viven en memoria de sesión y se pierden al recargar. Es correcto para el MVP y hay que dejarlo escrito para que nadie lo confunda con una implementación de ADR-001.

---

## 6. Bloque 5 · 17:00-18:00 — Cierre y puerta de decisión

### Crear los tres registros del proyecto

**`openspec/mvp/findings-register.md`** — con las entradas de hoy:

| ID | Fecha | Origen | Síntoma | Clasificación | Capability | Acción en V1 | Estado |
|---|---|---|---|---|---|---|---|

Clasificaciones: `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`

**`openspec/mvp/harness-metrics.csv`** — con las filas de SP-1.

**`openspec/mvp/harness-backlog.md`** — vacío hoy, se llena a partir del día 4.

### Puerta de decisión — se escribe explícitamente

| Spike | Resultado | Consecuencia |
|---|---|---|
| SP-1 Coder (DeepSeek-V4-Flash) | ☑ **pasa** (5/5) ☐ falla | **camino crítico** |
| SP-2 WebCrypto | ☑ **X25519** ☐ P-256 ☐ falla | **ADR-001 alineado** (informa GAP-001, F-008) |
| SP-3 Realtime | ☑ **pasa** ☐ falla | **tiempo real** |

> Cerrada el 5-ago. **Los tres pasan.** SP-1 nota: el spike se corrió con DeepSeek-V4-Flash, no
> GLM (ver F-001). SP-2 mejor que lo esperado: X25519 nativo disponible, no hizo falta caer a
> P-256 (F-008). Detalle completo en `findings-register.md`.

**Si los tres pasan:** el plan de 15 días sigue tal cual. Día 2 arranca con esquema Supabase y scaffold React.

**Si SP-1 falla:** replanificar el día 2 por la mañana. El calendario aguanta —Claude Code absorbe el trabajo de GLM— pero los objetivos 1 y 4 cambian de forma: pasan de medir un arnés en producción a medir por qué no lo fue.

**Si falla SP-3:** parar y replanificar antes de escribir nada más.

### Commit final del día

```
chore(mvp): dia 1 -- design system extraido, tres spikes y registros de proyecto
```

---

## 7. Qué NO se hace hoy

- No se escribe LangGraph. El grafo es del día 4.
- No se crea el esquema real de datos. Solo la tabla del spike, que se tira.
- No se convierte ninguna pantalla a React para producción. `InventoryTable.tsx` de SP-1 es material de evaluación, no código del MVP.
- No se siembra el catálogo. Es del día 3.
- No se toca ningún HTML aprobado ni ninguna spec de `openspec/specs/`.

---

*Día 1 · MVP Bearingworld.io · preparado el 4 de agosto de 2026*
