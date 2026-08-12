import type { ToolContext } from './vera-tools';

/**
 * El bucle de VERA · lado cliente (D-09-05).
 *
 * ESQUELETO. Ver `vera-tools.ts`.
 */

/** Tope de vueltas del bucle. Un bucle sin tope es una factura sin tope. */
export const MAX_STEPS = 4;

export interface ProxyToolUse {
  id: string;
  name: string;
  input: unknown;
}

export interface ProxyTurn {
  /** `end_turn` | `tool_use` | … tal cual lo devuelve la API. */
  stopReason: string;
  text: string;
  toolUses: ProxyToolUse[];
  /** El bloque `assistant` crudo, para reenviarlo sin tocarlo. */
  raw: unknown;
}

export interface ProxyRequest {
  messages: unknown[];
}

/** El cliente LLM, inyectable: `CLAUDE.md` §5 obliga a mockearlo en unidad. */
export type ProxyCall = (body: ProxyRequest) => Promise<ProxyTurn>;

export interface VeraAnswer {
  text: string;
  /** Cuántas vueltas dio el bucle. */
  steps: number;
  /** Los nombres de las herramientas que se ejecutaron, en orden. */
  toolsUsed: string[];
}

export function proxyUrl(): string {
  throw new Error('sin implementar');
}

export async function ask(
  _question: string,
  _ctx: ToolContext,
  _call: ProxyCall,
): Promise<VeraAnswer> {
  throw new Error('sin implementar');
}
