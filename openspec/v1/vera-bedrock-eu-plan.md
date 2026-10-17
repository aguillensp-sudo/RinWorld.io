# VERA a Amazon Bedrock UE — plan (entregable 6, alternativa a Vertex; sin aplicar)

**17-oct-2026.** Alternativa a `vera-vertex-eu-migracion.md` desde que Google denegó los cupos de Sonnet
(§7 de ese documento). **No es una decisión tomada:** es un plan para decidir. Hoy `vera/index.ts` sigue
llamando a `api.anthropic.com` con `MODELO = 'claude-sonnet-5'`.

## 1 · Lo comprobado el 17-oct contra la cuenta AWS `226395401132` (perfil `nortex`, región `eu-west-1`)

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Sonnet 4.6, 5 y 5.5 existen en Irlanda y Fráncfort | `list-foundation-models` | `ACTIVE` los tres, en las dos regiones |
| Perfiles de inferencia UE | `list-inference-profiles` y `get-inference-profile` | `eu.anthropic.claude-sonnet-4-6` y `eu.anthropic.claude-sonnet-5`. Sirven desde `eu-west-1`, `eu-west-3`, `eu-central-1`, `eu-north-1`, `eu-south-1`, `eu-south-2`: todo UE |
| Formulario de uso de Anthropic | `get-use-case-for-model-access` | Enviado por el PO el 17-oct. `intendedUsers: "1"` (usuarios externos), sector «Otro» |
| **Sonnet 4.6 funciona** | `converse` con `eu.anthropic.claude-sonnet-4-6` | Respuesta real (9 tokens de entrada, 8 de salida). Cupo 6.000.000 tokens/min y 50 peticiones/min |
| **Sonnet 5 NO funciona hoy** | `converse` con `eu.anthropic.claude-sonnet-5` | `AccessDeniedException`: «not available for this account». Cupo de tokens por minuto del perfil UE: **0** |
| Sonnet 5.5 | `list-service-quotas` | Cupo de tokens por minuto del perfil UE: 0. No se ha probado la llamada |

**No comprobado:** que el perfil `eu.` mantenga el procesamiento solo en la UE a efectos contractuales (la
lista de regiones del perfil es toda europea, pero eso no es una garantía legal); que `thinking: adaptive` y
`output_config.effort` funcionen con la forma actual en Bedrock; el coste por token frente a la API directa.

## 2 · La decisión que bloquea el plan: qué modelo

El código usa **Sonnet 5 desde el 14-oct** (decisión del PO, `DECISIONES-V1.md`, «VERA en producción»).
`CLAUDE.md` §3 sigue diciendo Sonnet 4.6 «fijo por contrato» (QA-A00-06): está desfasado respecto a esa
decisión y habría que corregirlo con el PO.

- **A. Pedir Sonnet 5 en Bedrock UE** (cupo en cero y «no disponible»): hace falta una solicitud de acceso o
  de cupo a AWS (Service Quotas o AWS Support, cuenta y facturación). Mismo riesgo que con Google, aunque la
  cuenta de AWS ya es de pago y la cuenta tiene el formulario de Anthropic enviado.
- **B. Salir ya con Sonnet 4.6 en Bedrock UE**: funciona hoy, pero deshace la decisión del 14-oct y las
  pruebas de VERA se midieron contra Sonnet 5 (`vera-plan-pruebas-sonnet.md`). Habría que repetir la medición.
- **C. Seguir en `api.anthropic.com`** hasta que A tenga cupo. Es el estado actual.

Recomendación: pedir A y mientras tanto C. B solo si el PO prefiere residencia UE antes que el modelo.

## 3 · Qué cambia en el código (NO aplicado)

`supabase/functions/vera/index.ts`, apoyado en que `@anthropic-ai/bedrock-sdk` (0.35.0 en npm el 17-oct)
mantiene la misma interfaz `messages.create`:

```diff
- import Anthropic from 'npm:@anthropic-ai/sdk';
+ import { AnthropicBedrock } from 'npm:@anthropic-ai/bedrock-sdk';
- const MODELO = 'claude-sonnet-5';
+ const MODELO = 'eu.anthropic.claude-sonnet-5'; // perfil de inferencia UE; confirmar id exacto al ejecutar
- const clave = Deno.env.get('ANTHROPIC_API_KEY');
+ const accessKeyId = Deno.env.get('AWS_BEDROCK_ACCESS_KEY_ID');
+ const secretAccessKey = Deno.env.get('AWS_BEDROCK_SECRET_ACCESS_KEY');
- const anthropic = new Anthropic({ apiKey: clave });
+ const anthropic = new AnthropicBedrock({ awsAccessKey: accessKeyId, awsSecretKey: secretAccessKey, awsRegion: 'eu-west-1' });
```

Sin tocar: `PROMPT_ESTATICO`, CORS, `Entrada`, validación, el contexto dinámico y el contrato de la función.
**A verificar antes de aplicar:** (a) `thinking: { type: 'adaptive' }` y `output_config: { effort: 'medium' }`
con el SDK de Bedrock; (b) que `cache_control` se cachea (leer `usage.cache_read_input_tokens` en una
respuesta real); (c) si Sonnet 5 en Bedrock se sirve por un endpoint distinto: `list-service-quotas` muestra
cupos «bedrock-mantle endpoint» para Sonnet 5, con tokens de entrada concedidos y de salida a 0. Mirar la doc
de ese endpoint antes de elegir el SDK.

## 4 · Credenciales, con el mínimo permiso

Un usuario IAM propio (no el rol de administración) con solo `bedrock:InvokeModel` sobre el perfil y sobre el
modelo base en las regiones del perfil. **La clave la crea el PO** y va solo a los secretos de la función
(`AWS_BEDROCK_ACCESS_KEY_ID`, `AWS_BEDROCK_SECRET_ACCESS_KEY`); nunca a un fichero ni al chat.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel"],
    "Resource": [
      "arn:aws:bedrock:eu-west-1:226395401132:inference-profile/eu.anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-south-1::foundation-model/anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-south-2::foundation-model/anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-sonnet-5",
      "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-sonnet-5"
    ]
  }]
}
```

Revisar antes de crear: `bedrock:InvokeModelWithResponseStream` si algún día se hace streaming; y que la
política siga la regla de `aws-iam` (sin comodines). Las regiones salen de `get-inference-profile` del 17-oct y
pueden cambiar.

## 5 · Orden de corte (mismo criterio que `vera-vertex-eu-migracion.md` §4)

1. Resolver §2 (modelo) y tener cupo real: una llamada `converse` que responda con el modelo elegido.
2. Aplicar el diff de §3 en una rama; probarlo contra un Supabase local o de pruebas, nunca primero contra
   `troxminloxkjwihwfevs`. Repetir `app/src/lib/vera.probe.test.ts` / `vera.ensayo.test.ts`.
3. Poner los secretos, desplegar por el *job* `deploy` de CI y comprobar por contenido (`F-168`).
4. Solo entonces retirar `ANTHROPIC_API_KEY`.
5. Actualizar `FUNDACION-V1.md` (entregable 6), `ESTADO-V1.md` y `CLAUDE.md` §3/§4 con fecha y commit.

## 6 · Lo que este documento NO decide

Si se acepta Bedrock como proveedor definitivo en lugar de Vertex; el modelo (§2); si se cancela el trabajo de
Vertex (la API de cuotas queda activada y las tres solicitudes denegadas, `vera-vertex-eu-migracion.md` §7).
