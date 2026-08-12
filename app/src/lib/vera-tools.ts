import type { MemberProfile } from './session';
import type { SearchCriteria } from './search';

/**
 * Las cuatro herramientas de VERA · lado cliente (D-09-01).
 *
 * ESQUELETO. El contrato de aceptación se escribe contra esto y tiene que salir
 * en ROJO TOTAL antes de implementar nada (F-058).
 */

export const TOOL_NAMES = [
  'buscar_en_catalogo',
  'consultar_mi_inventario',
  'listar_mis_hilos',
  'navegar',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Las cinco pantallas que existen de los ocho ítems de `NAV_ITEMS`. */
export const SCREENS = ['Panel', 'Vendiendo', 'Comprando', 'Hilos', 'Inventario'] as const;
export type Screen = (typeof SCREENS)[number];

export interface ToolContext {
  profile: MemberProfile;
  navigate: (screen: Screen) => void;
  setCriteria: (criteria: SearchCriteria) => void;
}

export interface ToolResult {
  /** Lo que se le devuelve al modelo. */
  content: string;
  /** El `is_error` de la API: un fallo se dice, no se calla. */
  isError: boolean;
}

export const FORBIDDEN_THREAD_FIELDS = [
  'content_ciphertext',
  'contentCiphertext',
  'wrapped_cek',
  'ephemeral_pubkey',
] as const;

export function leaksCiphertext(_payload: unknown): boolean {
  throw new Error('sin implementar');
}

export function criteriaFromInput(_input: unknown): SearchCriteria {
  throw new Error('sin implementar');
}

export async function runTool(
  _name: string,
  _input: unknown,
  _ctx: ToolContext,
): Promise<ToolResult> {
  throw new Error('sin implementar');
}
