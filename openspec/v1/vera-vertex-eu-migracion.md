# VERA a Vertex AI europeo — runbook de migración (entregable 6, sin aplicar)

**6-sep-2026.** Entregable 6 de `FUNDACION-V1.md`: "residencia europea del agente". Hoy
`vera/index.ts` habla contra `api.anthropic.com` sin `baseURL`, con
`MODELO = 'claude-sonnet-4-6'` — código de la era MVP, no de la decisión de V1.
`ESTADO-V1.md` §4 tiene como decisión viva *"VERA en producción: Sonnet 5 vía Vertex AI
europeo"*; este documento es el CÓMO, que no existía en ningún sitio del repo.

**Por qué es un documento y no un commit al `index.ts` real:** el 6-sep-2026 el PO
confirmó que el proyecto GCP con Vertex AI todavía no existe. Tocar la función que hoy
funciona sin poder probarla contra credenciales reales dejaría VERA en un estado peor que
no tocarla — la regla de esta sesión es no declarar "hecho" lo que no se ha visto correr
(mismo criterio que el entregable 2, §1 de este documento). Este runbook queda listo para
ejecutarse en cuanto exista el proyecto GCP.

**Confirmado por búsqueda web el 6-sep-2026** (no de memoria): Vertex AI ofrece hoy un
*endpoint multi-región UE* para Claude, GA desde mayo-2026, con retención cero de datos, y
Sonnet 5 está disponible ahí — la decisión de `ESTADO-V1.md` §4 es técnicamente viable.
Fuente primaria a re-confirmar en el momento de crear el proyecto:
`platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai` — **el id exacto del
modelo y el identificador de región multi-UE no se fijan en este documento de memoria**,
se leen de esa página el día que se ejecute esto, porque cambian con el catálogo de
Model Garden.

---

## 1 · Qué crear en GCP (antes de tocar código)

1. Proyecto GCP nuevo (o uno existente del PO) con facturación habilitada.
2. Habilitar la API de Vertex AI (`aiplatform.googleapis.com`).
3. En Vertex AI → Model Garden, habilitar el modelo Sonnet 5 de Anthropic — algunos
   modelos de terceros en Vertex piden una solicitud de acceso/cupo aparte del simple
   "habilitar la API"; confirmarlo en el propio Model Garden, no asumir que habilitar la
   API basta.
4. Cuenta de servicio con el rol `Vertex AI User` (`roles/aiplatform.user`), scopeada a
   ese proyecto, nada más — no `Editor` ni `Owner`.
5. Clave JSON de esa cuenta de servicio. **Primera vía, la más simple de desplegar hoy
   con Supabase Edge Functions:** guardar el JSON completo como secreto de la función.
   Workload Identity Federation evita una clave de larga duración, pero añade una pieza de
   infraestructura (proveedor OIDC) que Deno Deploy no soporta de forma nativa hoy —
   confirmarlo en el momento; si no, la clave JSON como secreto es la vía pragmática.

## 2 · Qué cambia en el código

Diff conceptual sobre `supabase/functions/vera/index.ts` (NO aplicado todavía):

```diff
- import Anthropic from 'npm:@anthropic-ai/sdk';
+ import { AnthropicVertex } from 'npm:@anthropic-ai/vertex-sdk';
```

```diff
- const MODELO = 'claude-sonnet-4-6';
+ // Confirmar el id exacto en Vertex AI Model Garden al ejecutar esto — el id de
+ // modelo en Vertex NO es el mismo string que en la API directa de Anthropic.
+ const MODELO = '<id-de-sonnet-5-en-vertex-model-garden>';
```

```diff
- const clave = Deno.env.get('ANTHROPIC_API_KEY');
- if (!clave) {
-   return json({ error: 'VERA no está configurada: falta ANTHROPIC_API_KEY...' }, 503);
- }
- const anthropic = new Anthropic({ apiKey: clave });
+ const credencialesJson = Deno.env.get('GOOGLE_VERTEX_CREDENTIALS');
+ const proyectoGcp = Deno.env.get('GOOGLE_VERTEX_PROJECT_ID');
+ if (!credencialesJson || !proyectoGcp) {
+   return json(
+     { error: 'VERA no está configurada: faltan las credenciales de Vertex AI.' },
+     503,
+   );
+ }
+ const anthropic = new AnthropicVertex({
+   projectId: proyectoGcp,
+   // Confirmar contra la doc de Claude-en-Vertex el identificador de región
+   // multi-UE vigente (no es necesariamente un "europe-west*" de zona única).
+   region: '<multi-region-ue-de-la-doc>',
+   googleAuth: /* credencial construida desde credencialesJson */,
+ });
```

**Sin tocar, a propósito:** el bloque `PROMPT_ESTATICO`, `CORS`, la interfaz `Entrada`, el
manejo de `OPTIONS`/`Authorization`, y el propio contrato de la función (no toca la base
de datos, D-09-05) — nada de eso es específico del proveedor.

**A verificar en el momento, no asumido hoy:** si `thinking: { type: 'adaptive' }` y
`output_config: { effort: 'medium' }` (los dos parámetros que usa la llamada de hoy,
`index.ts:206-211`) están disponibles con la misma forma en el SDK de Vertex — son
funciones relativamente nuevas de la API directa de Anthropic y no todos los proveedores
las exponen el mismo día. Si Vertex no las soporta todavía, la llamada se hace sin ellas
(degradación aceptable: se pierde el ajuste de presupuesto de razonamiento, no la
funcionalidad).

## 3 · Secretos nuevos de la Edge Function

Sustituyen a `ANTHROPIC_API_KEY` (que se retira de `supabase secrets` una vez migrado, no
antes — no dejar VERA sin proveedor a mitad de corte):

| Secreto | Contenido |
|---|---|
| `GOOGLE_VERTEX_PROJECT_ID` | El proyecto GCP del paso 1 |
| `GOOGLE_VERTEX_CREDENTIALS` | El JSON completo de la cuenta de servicio del paso 4 |

Mismo mecanismo de siempre para ponerlos (`Dia-09_decisiones_vera.md`): el MCP de
Supabase despliega la función pero no gestiona secretos — via CLI con el token de
`SUPABASE_ACCESS_TOKEN` (el mismo que ya existe desde el entregable 2) o a mano en el
dashboard.

## 4 · Orden de corte, para no dejar VERA caída

1. Crear la infraestructura GCP (§1) con la app todavía hablando con
   `api.anthropic.com` — cero riesgo, nada del lado de producción cambia todavía.
2. Aplicar el diff de código (§2) en una rama, probarlo con el proxy apuntando a un
   proyecto Supabase de prueba (o local) con las credenciales de Vertex reales — nunca
   contra `troxminloxkjwihwfevs` en el primer intento.
3. Confirmar con `usage`/`stop_reason` de una respuesta real que el modelo contesta, y
   repetir la sonda de verificación que ya existe (`app/src/lib/vera.probe.test.ts` /
   `vera.ensayo.test.ts`) contra el endpoint nuevo.
4. Desplegar a `troxminloxkjwihwfevs` por el *job* `deploy` de CI (entregable 2) o a
   mano, y solo entonces retirar `ANTHROPIC_API_KEY` de los secretos de la función.
5. Actualizar `FUNDACION-V1.md` fila del entregable 6 y `ESTADO-V1.md` §4 con la fecha y
   el commit real — citando `index.ts:línea`, no este documento, como fuente de verdad
   una vez aplicado.

## 5 · Lo que este documento NO decide

- Si Workload Identity Federation es viable desde Deno Deploy (Edge Functions de
  Supabase) o si la clave de servicio JSON como secreto es la vía definitiva, no solo la
  de arranque.

**8-sep-2026: los otros dos se confirmaron contra `platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai` real, no de memoria** — id de modelo `claude-sonnet-5` (sin sufijo `@fecha`, es el actual GA) y región multi-UE `region: "eu"` (endpoint `aiplatform.eu.rep.googleapis.com`, distinto del regional `europe-west*`).

## 6 · Infraestructura GCP creada hoy (8-sep-2026), y dónde quedó cada paso del §1

| Paso del §1 | Estado | Detalle |
|---|---|---|
| 1. Proyecto GCP con facturación | ✅ | `bearingworld-vera-eu` (número `828676704243`), cuenta `a.guillen.sp@gmail.com`. Facturación `014A85-69538E-B501FA` vinculada, `billingEnabled: true` |
| 2. API de Vertex AI habilitada | ✅ | `aiplatform.googleapis.com`, confirmado con `gcloud services list --enabled` |
| 3. Modelo Sonnet 5 de Anthropic en Model Garden | 🟡 **distinto de lo previsto** — ver §7 | No hizo falta ningún clic de habilitación: una llamada real a `rawPredict` llegó hasta la comprobación de cupo sin que Vertex se quejara de acceso al modelo. El bloqueo real es de cupo, no de Model Garden |
| 4. Cuenta de servicio, rol mínimo | ✅ | `vera-vertex@bearingworld-vera-eu.iam.gserviceaccount.com`, `roles/aiplatform.user` únicamente — confirmado con `gcloud projects add-iam-policy-binding`, sin `Editor`/`Owner` |
| 5. Clave JSON de la cuenta de servicio | ⬜ **sin generar, a propósito** | Mismo criterio que los tokens de Vercel/Supabase (`ESTADO-V1.md` §4, 8-sep): la genera y la sube a los secretos de Supabase el PO desde su terminal, no queda nunca en el chat |

## 7 · Bloqueo nuevo, no previsto en el §1 original: cupo en cero

Probado con una llamada real (`rawPredict`, `region=eu`, modelo `claude-sonnet-5`) usando el
token de la propia cuenta del PO — no asumido, ejecutado:

```
429 RESOURCE_EXHAUSTED
Quota exceeded for aiplatform.googleapis.com/eu_multi_region_online_prediction_requests_per_base_model
with base model: anthropic-claude-sonnet
```

Repetido tras un par de minutos (por si era propagación de la facturación recién vinculada):
mismo error exacto, palabra por palabra. **No es el "algunos modelos piden solicitud de
acceso aparte" que preveía el §1 punto 3** — la llamada pasó la comprobación de acceso al
modelo sin queja; lo que está en cero es el cupo de peticiones para `anthropic-claude-sonnet`
en el endpoint multi-región `eu`, que en un proyecto recién creado empieza así por defecto.

**Pendiente del PO, no automatizable desde aquí:** pedir el aumento de cupo en
`https://console.cloud.google.com/iam-admin/quotas?project=bearingworld-vera-eu`, filtrando
por `anthropic-claude-sonnet` o por el nombre del métrico de arriba. Es un formulario con
justificación de negocio que revisa Google — no hay equivalente por `gcloud` para este tipo
de cupo de modelo de terceros, y el tiempo de aprobación no está confirmado en la
documentación pública consultada hoy.

**No se toca `vera/index.ts` todavía**, ni con este bloqueo resuelto: el §4 (orden de corte)
exige probar el diff contra una llamada real que SÍ responda antes de tocar producción, y
hoy esa llamada sigue en `429`.
