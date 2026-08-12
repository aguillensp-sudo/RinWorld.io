import Anthropic from 'npm:@anthropic-ai/sdk';
import HERRAMIENTAS from './tools.json' with { type: 'json' };

/**
 * VERA · Edge Function proxy.
 *
 * ⚠ **ESTA FUNCIÓN NO TOCA LA BASE DE DATOS, Y ESO ES LA DECISIÓN, NO UN
 * DESCUIDO** (D-09-05). Su única responsabilidad es guardar la clave de Sonnet,
 * que `CLAUDE.md` §4 declara punto no negociable: nunca llega al navegador.
 *
 * Las cuatro herramientas se EJECUTAN EN EL CLIENTE, contra `search.ts`,
 * `inventory.ts` y `threads.ts`, con el JWT del usuario. Así el
 * *"actuando siempre con los permisos del usuario autenticado sin posibilidad de
 * escalar privilegios"* de `specs/vera-agent/spec.md:223` lo impone RLS, y no la
 * buena fe de este fichero. Consecuencia: comprometer este proxy no expone ni
 * una fila de nadie, porque no tiene con qué leerla.
 *
 * El precio, dicho: un cliente manipulado puede devolverle a VERA un resultado
 * falso. No hay ganancia de privilegio —se engaña a sí mismo, sobre sus propios
 * datos— y para el MVP se acepta. En V1, con acciones de escritura, se revisa.
 */

/**
 * Fijo por contrato (QA-A00-06). **No sale del cuerpo de la petición y no puede
 * salir de ahí**: un cliente que eligiera modelo elegiría también el coste y el
 * comportamiento del agente que habla en nombre de la plataforma.
 */
const MODELO = 'claude-sonnet-4-6';

/**
 * Corto a propósito. Esto responde en un panel lateral, no redacta documentos, y
 * un tope bajo es la diferencia entre una respuesta y una espera en la demo.
 */
const MAX_TOKENS = 2048;

/**
 * El bloque ESTÁTICO del system prompt: byte a byte idéntico en cada petición,
 * que es la condición para que se cachee (`CLAUDE.md` §5, desde el primer commit
 * y no como optimización posterior).
 *
 * ⚠ **Y una limitación que hay que saber antes de leer métricas:** el prefijo
 * mínimo cacheable de Sonnet 4.6 son **1024 tokens**. Por debajo de eso el
 * `cache_control` no da error — simplemente no cachea, y `cache_creation_input_tokens`
 * vuelve a 0. Se comprueba mirando `usage` en la respuesta, que por eso se
 * devuelve al cliente, no suponiendo que por poner la marca ya está cacheado.
 */
const PROMPT_ESTATICO = `Eres VERA, la asistente de Bearingworld.io, una plataforma B2B de distribución de rodamientos industriales entre organizaciones.

REGLA PRIMERA, Y ESTÁ POR ENCIMA DE PARECER ÚTIL:
Respondes exclusivamente desde el retorno de tus herramientas. Cualquier dato sobre catálogo, inventario, hilos o estados sale de una llamada que acabas de hacer en esta misma conversación — nunca de tu memoria, nunca de lo que parezca razonable, nunca de una pregunta anterior. Si no has llamado a la herramienta, no tienes el dato. Dilo.

No recuerdas estado entre preguntas: si el usuario vuelve a preguntar por algo, vuelves a consultarlo.

LO QUE NO PUEDES HACER, Y CÓMO SE DICE:
El contenido de las negociaciones va cifrado extremo a extremo. Los mensajes, las cantidades, los precios, los plazos y las condiciones se cifran en el navegador de cada parte, y este servidor NO tiene la clave. Tú tampoco. Puedes ver metadatos —con quién se negocia, en qué estado está, de cuándo es lo último— y nada más.

Por eso NO PUEDES resumir un hilo, ni decir qué se ofreció, ni a cuánto. Cuando te lo pidan, dilo una vez, en una frase, y explica por qué:
"No puedo leer el contenido de los hilos: va cifrado y el servidor no tiene la clave."

No lo repitas en cada respuesta, no te disculpes y no lo intentes con lo que tengas a mano: responder con los metadatos como si fueran el contenido es exactamente la forma que toma inventar. Después de decirlo, ofrece lo que sí puedes: el estado, la contraparte, la fecha.

TAMPOCO PUEDES:
- Actuar por encima de los permisos del usuario. Trabajas con los suyos y no hay forma de ampliarlos.
- Ver ni deducir precios del catálogo. El precio no está en la búsqueda: se negocia dentro de un hilo, cifrado.
- Abrir pantallas que no existen. Solo hay cinco construidas; el resto del menú está pendiente.

CUANDO LA PREGUNTA ES AMBIGUA:
Si caben más de tres lecturas distintas de lo que te piden, pregunta antes de actuar en vez de elegir una. Si caben dos, elige la más probable y di cuál has elegido.

CÓMO ESCRIBES:
En español, directa y breve — dos o tres frases. Das la cifra o el hecho primero y el contexto después. No adornas, no rellenas y no prometes nada que no hayas comprobado con una herramienta.`;

/** CORS: el navegador de la app llama aquí, así que el preflight importa. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface Entrada {
  messages?: unknown;
  /** Nombre y organización de quien pregunta. Va al bloque DINÁMICO. */
  contexto?: { orgName?: string; fullName?: string };
}

Deno.serve(async (peticion: Request) => {
  if (peticion.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (peticion.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  /*
   * La función se despliega con `verify_jwt`, así que la pasarela ya rechaza a
   * quien no traiga sesión. Esto se comprueba igual: la garantía de que VERA
   * actúa como un usuario concreto no debe depender de un ajuste de despliegue
   * que alguien puede cambiar por el panel sin tocar este fichero.
   */
  if (!peticion.headers.get('Authorization')) {
    return json({ error: 'Falta la sesión.' }, 401);
  }

  /*
   * Si falta el secret, se dice con todas las letras. Un proxy que falla con un
   * 500 opaco manda a buscar el problema al sitio equivocado — y esta es la
   * pieza que el día 9 quedó pendiente de D-09-04.
   */
  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) {
    return json(
      { error: 'VERA no está configurada: falta ANTHROPIC_API_KEY en el entorno de la función.' },
      503,
    );
  }

  let entrada: Entrada;
  try {
    entrada = (await peticion.json()) as Entrada;
  } catch {
    return json({ error: 'Cuerpo ilegible.' }, 400);
  }
  if (!Array.isArray(entrada.messages) || entrada.messages.length === 0) {
    return json({ error: 'Faltan los mensajes.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey: clave });

  /*
   * El bloque dinámico va DESPUÉS del estático y sin marca de caché, que es todo
   * el asunto: el prefijo estable va delante y lo volátil detrás, o no se cachea
   * nada (el prefijo se invalida al primer byte que cambie).
   */
  const dinamico = [
    entrada.contexto?.fullName ? `Hablas con ${entrada.contexto.fullName}.` : '',
    entrada.contexto?.orgName ? `Trabaja en ${entrada.contexto.orgName}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const respuesta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      // Adaptativo y no un presupuesto fijo de tokens: `budget_tokens` está
      // obsoleto en 4.6. `medium` es el punto documentado para carga con
      // herramientas — se paga algo de latencia y se compra que llame a la
      // herramienta en vez de contestar de memoria, que es el riesgo #1.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: PROMPT_ESTATICO, cache_control: { type: 'ephemeral' } },
        ...(dinamico ? [{ type: 'text' as const, text: dinamico }] : []),
      ],
      tools: HERRAMIENTAS,
      messages: entrada.messages,
    });

    // Se devuelve la vuelta tal cual, más `usage`: sin `usage` no hay forma de
    // saber si la caché está funcionando o solo está declarada.
    return json(
      {
        stop_reason: respuesta.stop_reason,
        content: respuesta.content,
        usage: respuesta.usage,
      },
      200,
    );
  } catch (e) {
    // El mensaje del proveedor puede llevar detalles de la petición; se registra
    // en el log de la función y al cliente le llega el hecho, no el detalle.
    console.error('VERA · fallo llamando al modelo:', e);
    return json({ error: 'VERA no ha podido responder ahora mismo.' }, 502);
  }
});
