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

export interface ProxyToolUse {
  id: string;
  name: string;
  input: unknown;
}

export interface ProxyTurn {
  stopReason: string;
  text: string;
  toolUses: ProxyToolUse[];
  /** Los bloques `content` crudos, para reenviarlos sin tocarlos. */
  raw: unknown;
}

export interface ProxyRequest {
  messages: unknown[];
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
 */
export async function ask(
  question: string,
  ctx: ToolContext,
  call: ProxyCall,
): Promise<VeraAnswer> {
  const messages: unknown[] = [{ role: 'user', content: question }];
  const toolsUsed: string[] = [];
  let steps = 0;
  let text = '';

  while (steps < MAX_STEPS) {
    // Copia, no referencia: quien llama no debe ver mutar por debajo lo que ya
    // le mandamos, ni poder mutarnos el historial.
    const turn = await call({ messages: [...messages] });
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
 * El token se pasa desde fuera en vez de leerse aquí de `supabase`: así este
 * módulo no arrastra el cliente de base de datos —que no necesita— y los tests
 * del bucle corren sin mockearlo.
 */
export function createProxyCall(
  accessToken: string,
  contexto: { orgName: string; fullName: string | null },
): ProxyCall {
  return async ({ messages }) => {
    const r = await fetch(proxyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, contexto }),
    });

    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(cuerpo.error ?? `El proxy de VERA respondió ${r.status}.`);
    }

    const datos = (await r.json()) as { stop_reason?: string; content?: Bloque[] };
    const bloques = datos.content ?? [];

    return {
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
