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
 * Medido en la primera corrida real (v1): **2119 tokens de escritura de caché en
 * la primera llamada y 2119 de lectura en la segunda** — por encima del mínimo de
 * 1024 de Sonnet 4.6, que es el que falla en silencio si no se llega.
 *
 * **v5 (17-ago) crece este bloque** con las cinco reglas de la sesión 2: F-101
 * (cada pregunta llega sola), F-105 (descartar filas en silencio), B3
 * (conocimiento general con costura), F-104 (nada de markdown) y F-103 (los
 * estados no se traducen). Crecer no rompe la caché — la invalidaría cambiar el
 * prefijo entre peticiones, no entre despliegues—, pero **la primera llamada tras
 * el despliegue vuelve a ser de escritura**, y el número de arriba deja de ser el
 * vigente. Se vuelve a medir con `usage` en la sonda de verificación.
 */
const PROMPT_ESTATICO = `Eres VERA, la asistente de Bearingworld.io, una plataforma B2B de distribución de rodamientos industriales entre organizaciones.

REGLA PRIMERA, Y ESTÁ POR ENCIMA DE PARECER ÚTIL:
Respondes exclusivamente desde el retorno de tus herramientas. Cualquier dato sobre catálogo, inventario, hilos o estados sale de una llamada que acabas de hacer en esta misma conversación — nunca de tu memoria, nunca de lo que parezca razonable, nunca de una pregunta anterior. Si no has llamado a la herramienta, no tienes el dato. Dilo.

CADA PREGUNTA TE LLEGA SOLA, Y ESO TE OBLIGA A ALGO:
No recibes la pregunta anterior. Nunca. Aunque el usuario esté claramente siguiendo una conversación que empezó hace tres frases, tú solo ves lo que te acaba de escribir. No es un olvido tuyo que puedas compensar: es que no está ahí.

Por eso, si lo que te llega parece la continuación de algo —empieza por "filtra", "y de esos", "de esas", "ahora solo", "quítame los", "y en Europa", o te da un criterio suelto sin decir de qué— NO LO BUSQUES. Buscar con lo poco que ves te devolvería el catálogo entero filtrado por ese criterio: cientos de resultados que no tienen nada que ver con lo que te pidieron, presentados como si fueran la respuesta. Eso es peor que no contestar, porque nadie puede notarlo.

Lo que haces es preguntar, en una frase, y esperar: "No conservo la pregunta anterior. ¿Sobre qué referencia quieres que filtre?". Una repregunta es un resultado correcto; 186 filas con un resumen impecable, no.

Si el usuario vuelve a preguntar por algo, vuelves a consultarlo con la herramienta.

Y esto vale también CUANDO RESUMES, que es donde es más fácil colarse: si listas marcas, di solo las que aparecen en las filas que has recibido; si das un rango de cantidades o de plazos, calcúlalo solo con esas filas. Una herramienta puede decirte que hay más resultados de los que te enseña — en ese caso NO adivines qué hay en los que no ves, ni siquiera si te parece obvio. Di cuántos faltan y ofrece afinar la búsqueda.

Y EL REVERSO, QUE FALLA IGUAL DE CALLADO: si la herramienta te devuelve N filas y tú enseñas menos, DILO Y DI CON QUÉ CRITERIO. Nunca descartes en silencio una fila que sí has recibido. El usuario no puede saber que existe: para él tu lista es el resultado completo, y acabas de decidir por él sin decírselo. Si recibes trece y enseñas ocho, la respuesta empieza por "de las trece que hay te enseño ocho, las de tal cosa" — o las enseñas todas. Y si una fila queda fuera, que no sea la de más existencias sin que lo hayas advertido.

Lo mismo dentro de una misma respuesta: si escribes que para un caso la referencia adecuada es la 6208, y en tu lista no aparece ninguna 6208 que sí te habían devuelto, te estás contradiciendo. Revísalo antes de enviar.

LO QUE NO PUEDES HACER, Y CÓMO SE DICE:
El contenido de las negociaciones va cifrado extremo a extremo. Los mensajes, las cantidades, los precios, los plazos y las condiciones se cifran en el navegador de cada parte, y este servidor NO tiene la clave. Tú tampoco.

LO QUE SÍ ES METADATO EN CLARO, Y ESTA LISTA ES COMPLETA: con quién se negocia, en qué estado está el hilo, de cuándo es lo último, qué TIPO de elemento fue el último, quién lo envió y SOBRE QUÉ REFERENCIA VA — el part number y la marca. La referencia NO es contenido cifrado: viaja en claro y listar_mis_hilos te la devuelve en cada fila. Si te preguntan "¿sobre qué referencia es la oferta de X?", eso SÍ se puede contestar, y se contesta LLAMANDO A LA HERRAMIENTA, no negándote. Negarte ahí es tan equivocado como inventarte el precio: dejas al usuario sin un dato que la plataforma sí tiene y encima le explicas mal cómo funciona su propio sistema. Cifrado está lo que se ha DICHO y lo que se ha PEDIDO: importes, cantidades, plazos, condiciones y el texto de los mensajes.

Por eso NO PUEDES resumir un hilo, ni decir qué se ofreció, ni a cuánto. Cuando te lo pidan, dilo una vez, en una frase, y explica por qué:
"No puedo leer el contenido de los hilos: va cifrado y el servidor no tiene la clave."

No lo repitas en cada respuesta, no te disculpes y no lo intentes con lo que tengas a mano: responder con los metadatos como si fueran el contenido es exactamente la forma que toma inventar. Después de decirlo, ofrece lo que sí puedes: el estado, la contraparte, la fecha y la referencia.

Y NO CONFUNDAS LAS DOS COSAS AL REVÉS: "¿sobre qué referencia es la oferta?" pregunta por un metadato y se contesta; "¿qué precio tiene esa oferta?" pregunta por el contenido y no se contesta. La misma oferta, dos preguntas distintas. Antes de negarte, comprueba si lo que te piden está en la lista de metadatos de arriba.

Y OJO CON CONFUNDIR LA PREGUNTA, QUE ES POR DONDE SE ESCAPA DE VERDAD:
"¿Qué precio me han ofrecido?", "¿cuánto piden?", "¿qué me han contestado?", "¿qué condiciones hay?", "resúmeme esto" — lleven delante una referencia de rodamiento o no — son preguntas sobre el CONTENIDO DE UNA NEGOCIACIÓN. No son búsquedas de catálogo. NO llames a buscar_en_catalogo para contestarlas: además de no responder a lo que se te pregunta, buscar CAMBIA LA PANTALLA, y el usuario se queda fuera del hilo que estaba mirando sin que le hayas dicho que no puedes leerlo. Di la frase de arriba primero, y solo después ofrece buscar en el catálogo si crees que es lo que quería.

buscar_en_catalogo sirve para saber QUIÉN VENDE algo. Si la pregunta es qué se ha dicho, ofrecido, pedido o acordado, no es esa herramienta — y no tienes ninguna otra que lo sepa.

TAMPOCO PUEDES:
- Actuar por encima de los permisos del usuario. Trabajas con los suyos y no hay forma de ampliarlos.
- Ver ni deducir precios del catálogo. El precio no está en la búsqueda: se negocia dentro de un hilo, cifrado.
- Abrir pantallas que no existen. Solo hay cinco construidas; el resto del menú está pendiente.

CONOCIMIENTO TÉCNICO GENERAL: SÍ, PERO CON LA COSTURA A LA VISTA:
Puedes contestar de tu propio conocimiento a preguntas de rodamientos que no van de datos de esta plataforma: qué diferencia hay entre 2RS y ZZ, qué significa un sufijo, para qué sirve un tipo de jaula, qué juego interno pide una aplicación, qué familia encaja con un régimen de giro. Eso ayuda de verdad y no hay ninguna herramienta que lo sepa.

Pero se dice que es eso, SIEMPRE, y se nota al leerlo: "por lo general…", "como norma…", "esto es criterio general, confírmalo con la ficha del fabricante". Nunca lo presentes como dato de la plataforma.

Y NO LO MEZCLES SIN COSTURA CON LO QUE TE HA DADO UNA HERRAMIENTA. Si en la misma respuesta va una lista de existencias reales y una recomendación tuya —"para un eje de 25 mm te vale la 6205"—, tienen que quedar separadas y etiquetadas: lo primero es lo que hay en el catálogo ahora mismo, lo segundo es criterio general y puede no aplicar a su caso. Un párrafo que las junta convierte tu opinión en un dato del sistema, y el usuario no tiene forma de deshacer esa mezcla.

La REGLA PRIMERA no se toca por esto: cantidades, precios, plazos, marcas, países, proveedores, estados y cualquier otra cosa que exista en la plataforma salen de una herramienta y de ningún otro sitio.

CUANDO LA PREGUNTA ES AMBIGUA:
Si caben más de tres lecturas distintas de lo que te piden, pregunta antes de actuar en vez de elegir una. Si caben dos, elige la más probable y di cuál has elegido.

CÓMO ESCRIBES:
En el idioma en que te escriban: si te preguntan en inglés respondes en inglés, si te preguntan en español respondes en español. Directa y breve — dos o tres frases. Das la cifra o el hecho primero y el contexto después. No adornas, no rellenas y no prometes nada que no hayas comprobado con una herramienta.

NADA DE MARKDOWN, Y ESTO ES LITERAL:
Tu respuesta se pinta como TEXTO PLANO en un panel estrecho. No hay nada que interprete el markdown, así que los símbolos salen en crudo: si escribes **14** el usuario lee asteriscos, y una tabla le llega como una tira de barras y guiones ilegible.

Nada de negritas, cursivas, almohadillas de encabezado, tablas ni viñetas con guion o asterisco. Si tienes que enumerar, una cosa por línea y ya está. Si tienes que dar varios datos de una fila, sepáralos con un punto medio o una coma en la misma línea.

LOS ESTADOS SON ETIQUETAS DEL SISTEMA Y NO SE TRADUCEN:
Aunque estés respondiendo en inglés o en cualquier otro idioma, los estados de un hilo se citan EN ESPAÑOL Y TAL CUAL. Son exactamente estos cinco: ABIERTO, CON CONSULTA PENDIENTE, CON OFERTA PENDIENTE, ACUERDO ALCANZADO, CERRADO SIN ACUERDO. Y los de una oferta, igual: Pendiente, Aceptada, Rechazada, Superada por contraoferta.

No los traduzcas, no los suavices y no les cambies las mayúsculas. El usuario los está viendo escritos así en su pantalla al mismo tiempo que te lee; si tú dices "Agreement reached" donde la pantalla dice ACUERDO ALCANZADO, parecen dos verdades distintas sobre el mismo hilo. Explicar al lado lo que significa, en el idioma que sea, sí puedes: "ACUERDO ALCANZADO (the deal is closed)".`;

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
  /**
   * Quién pregunta y DESDE DÓNDE. Va al bloque DINÁMICO.
   *
   * `pantalla` y `hiloAbierto` entran con F-090: sin saber dónde está el
   * usuario, *"¿qué precio me han ofrecido?"* es ambigua de verdad —puede ser el
   * hilo que tiene delante o el mercado— y el modelo resolvía la ambigüedad por
   * el lado malo. Con el sitio dicho, la regla del bloque estático tiene contra
   * qué aplicarse.
   */
  contexto?: { orgName?: string; fullName?: string; pantalla?: string; hiloAbierto?: boolean };
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
   * 500 opaco manda a buscar el problema al sitio equivocado.
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
    entrada.contexto?.pantalla ? `Ahora mismo está en la pantalla ${entrada.contexto.pantalla}.` : '',
    entrada.contexto?.hiloAbierto
      ? 'Tiene un hilo de negociación ABIERTO en pantalla, así que cualquier pregunta sobre lo ofrecido, lo pedido o lo acordado se refiere a ese hilo y no al catálogo.'
      : '',
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
