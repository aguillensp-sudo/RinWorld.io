import { runTool, type ToolContext } from './vera-tools';

/**
 * El bucle de VERA · lado cliente (D-09-05).
 *
 * La Edge Function solo guarda la clave y reenvía la vuelta del modelo. Todo lo
 * que decide qué se ejecuta y con qué permisos ocurre aquí, con la sesión del
 * usuario — ver la cabecera de `vera-tools.ts`.
 */

/**
 * Tope de vueltas. Un bucle agéntico sin tope es una factura sin tope y una
 * pantalla colgada: si el modelo se empeña en pedir herramienta, se corta y se
 * devuelve lo que haya.
 */
export const MAX_STEPS = 4;

/**
 * La memoria de la conversación (`F-101`, decisión del PO del 14-oct-2026, `DECISIONES-V1.md`).
 *
 * Al modelo le llega el TEXTO de los últimos `HISTORY_WINDOW` intercambios —la pregunta y la
 * respuesta final—, nunca sus `tool_use`/`tool_result`: un resultado de hace tres preguntas es un
 * dato caducado, y reenviarlo sería invitarle a contestar con él en vez de volver a consultar
 * (`realtime-platform-state-layer`). Lo que queda fuera de la ventana se le dice, para que no lo dé
 * por sabido. El panel sigue enseñando la conversación entera: el límite es solo lo que ve el modelo.
 *
 * 20 es un parámetro y no una medida: se ajusta con lo que se mida contra Sonnet.
 */
export const HISTORY_WINDOW = 20;

/**
 * La memoria vive solo en memoria de la sesión y caduca a las 24 h del inicio de sesión
 * (`session-context-layer`). Al cerrar sesión o recargar se pierde sola: no se guarda en ningún sitio.
 */
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

/** Una pregunta del usuario y lo que VERA contestó. Solo se guardan las que tuvieron respuesta. */
export interface Exchange {
  question: string;
  answer: string;
}

/** ¿Ha pasado el plazo de 24 h desde que empezó la sesión? Sin dato de inicio, no caduca. */
export function historyExpired(sessionStartedAt: number | null, now: number): boolean {
  return sessionStartedAt !== null && now - sessionStartedAt >= HISTORY_TTL_MS;
}

/** Los mensajes que ve el modelo de la conversación previa, y cuántos intercambios se han quedado fuera. */
export function historyMessages(history: readonly Exchange[]): { messages: unknown[]; omitted: number } {
  const ventana = history.slice(-HISTORY_WINDOW);
  return {
    messages: ventana.flatMap((x) => [
      { role: 'user', content: x.question },
      { role: 'assistant', content: x.answer },
    ]),
    omitted: history.length - ventana.length,
  };
}

export interface ProxyToolUse {
  id: string;
  name: string;
  input: unknown;
}

/** Lo que la función devuelve de `usage` (`index.ts`): sin esto no se sabe ni qué cuesta ni si la caché funciona. */
export interface ProxyUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ProxyTurn {
  stopReason: string;
  text: string;
  toolUses: ProxyToolUse[];
  /** Los bloques `content` crudos, para reenviarlos sin tocarlos. */
  raw: unknown;
  /** El `usage` de esta vuelta, si la función lo trae (`F-256`: hasta el 14-oct se tiraba aquí). */
  usage?: ProxyUsage;
}

export interface ProxyRequest {
  messages: unknown[];
  /** Intercambios anteriores que no caben en la ventana: el bloque dinámico se lo dice al modelo. */
  omittedExchanges?: number;
}

/** El cliente LLM, inyectable: `CLAUDE.md` §5 obliga a mockearlo en unidad. */
export type ProxyCall = (body: ProxyRequest) => Promise<ProxyTurn>;

export interface VeraAnswer {
  text: string;
  steps: number;
  toolsUsed: string[];
}

export function proxyUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/functions/v1/vera`;
}

/**
 * Una vuelta completa de conversación: preguntar, ejecutar lo que pida y volver
 * a preguntar con los resultados, hasta que conteste o se acabe el tope.
 *
 * `call` se inyecta: en producción es `createProxyCall`, en los tests es un
 * doble. Aquí no se importa nada de red a propósito.
 *
 * `history` son los intercambios anteriores de esta sesión (`F-101`); se recortan a la ventana aquí,
 * y no en quien llama, para que ningún camino pueda mandar la conversación entera.
 */
export async function ask(
  question: string,
  ctx: ToolContext,
  call: ProxyCall,
  history: readonly Exchange[] = [],
): Promise<VeraAnswer> {
  const previo = historyMessages(history);
  const messages: unknown[] = [...previo.messages, { role: 'user', content: question }];
  const toolsUsed: string[] = [];
  let steps = 0;
  let text = '';

  while (steps < MAX_STEPS) {
    // Copia, no referencia: quien llama no debe ver mutar por debajo lo que ya
    // le mandamos, ni poder mutarnos el historial.
    const turn = await call({
      messages: [...messages],
      ...(previo.omitted > 0 ? { omittedExchanges: previo.omitted } : {}),
    });
    steps += 1;
    text = turn.text;

    if (turn.stopReason !== 'tool_use' || turn.toolUses.length === 0) break;

    messages.push({ role: 'assistant', content: turn.raw });

    /*
     * En serie, y no en paralelo, a pesar de que la API admite varias llamadas
     * por turno: estas herramientas tienen EFECTOS DE INTERFAZ —navegar, escribir
     * criterios—, y en paralelo la pantalla en la que acabas dependería del orden
     * en que resuelvan. Con una o dos herramientas por turno no se gana latencia
     * apreciable y se pierde que el resultado sea reproducible.
     */
    const resultados: unknown[] = [];
    for (const uso of turn.toolUses) {
      const r = await runTool(uso.name, uso.input, ctx);
      toolsUsed.push(uso.name);
      resultados.push({
        type: 'tool_result',
        tool_use_id: uso.id,
        content: r.content,
        // El fallo viaja marcado. Un `tool_result` vacío es indistinguible de
        // "no hay resultados", y sobre eso VERA respondería con aplomo.
        is_error: r.isError,
      });
    }
    messages.push({ role: 'user', content: resultados });
  }

  return { text, steps, toolsUsed };
}

// -----------------------------------------------------------------------------
// El cliente real
// -----------------------------------------------------------------------------

interface BloqueTexto {
  type: 'text';
  text: string;
}
interface BloqueHerramienta {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
type Bloque = BloqueTexto | BloqueHerramienta | { type: string };

/**
 * El `ProxyCall` de producción.
 *
 * `getToken` se inyecta en vez de leer aquí de `supabase`: así este módulo no
 * arrastra el cliente de base de datos —que no necesita— y los tests del bucle
 * corren sin mockearlo.
 *
 * Y es un **getter**, no un token: se pide en cada llamada porque el de acceso
 * caduca y se renueva solo. Con uno congelado al montar, una sesión de demo
 * larga empezaría a devolver 401 a mitad, y el síntoma sería *"VERA ha dejado de
 * funcionar"* sin nada que lo explique en pantalla.
 */
export function createProxyCall(
  getToken: () => Promise<string | null>,
  /**
   * `pantalla` y `hiloAbierto` entran con F-090.
   *
   * Sin ellos, *"¿qué precio me han ofrecido?"* preguntado dentro de un hilo es
   * ambigua de verdad, y el modelo la resolvía como búsqueda de catálogo: se
   * llevaba al usuario a Comprando sin haber dicho que el contenido del hilo va
   * cifrado y no puede leerlo (D-09-02). El sitio desde el que se pregunta es
   * el dato que faltaba, y va al bloque DINÁMICO del system prompt — el
   * estático no puede cambiar entre peticiones o se pierde la caché
   * (`CLAUDE.md` §5).
   */
  /*
   * `filtros` entra con `F-101`: los filtros puestos en Comprando cuando se escribió la pregunta. El
   * usuario puede quitar un chip a mano entre una pregunta y otra, y entonces la pantalla y lo que el
   * modelo recuerda de la conversación dicen cosas distintas: manda la pantalla.
   */
  contexto: {
    orgName: string;
    fullName: string | null;
    pantalla?: string;
    hiloAbierto?: boolean;
    filtros?: string;
    /** El rol del usuario (`F-258`): sin él, VERA no sabía que un EDITOR no puede cambiar la visibilidad. */
    rol?: 'ADMIN' | 'EDITOR';
  },
): ProxyCall {
  return async ({ messages, omittedExchanges }) => {
    const accessToken = await getToken();
    if (!accessToken) {
      throw new Error('Tu sesión ha caducado. Vuelve a entrar para seguir hablando con VERA.');
    }

    const r = await fetch(proxyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages,
        contexto: omittedExchanges ? { ...contexto, intercambiosOmitidos: omittedExchanges } : contexto,
      }),
    });

    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(cuerpo.error ?? `El proxy de VERA respondió ${r.status}.`);
    }

    const datos = (await r.json()) as { stop_reason?: string; content?: Bloque[]; usage?: ProxyUsage };
    const bloques = datos.content ?? [];

    return {
      ...(datos.usage ? { usage: datos.usage } : {}),
      stopReason: datos.stop_reason ?? 'end_turn',
      text: bloques
        .filter((b): b is BloqueTexto => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim(),
      toolUses: bloques
        .filter((b): b is BloqueHerramienta => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: b.input })),
      raw: bloques,
    };
  };
}
