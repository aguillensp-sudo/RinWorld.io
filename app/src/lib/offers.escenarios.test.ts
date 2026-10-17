import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS DE SPEC de `messaging-and-negotiation/thread-lifecycle` (nivel unit, sin base). Salen
 * de `openspec/specs/messaging-and-negotiation/spec.md`; cada `it` empieza por el id del escenario de
 * `openspec/v1/trazabilidad.csv`.
 */

interface Llamada {
  tabla: string;
  metodo: string;
  args: unknown[];
}

let llamadas: Llamada[] = [];
let tablas: Record<string, unknown[]> = {};

function cadena(tabla: string): unknown {
  const api: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const data = tablas[tabla] ?? [];
          return (res: (v: unknown) => void) => res({ data, error: null, count: data.length });
        }
        return (...args: unknown[]) => {
          llamadas.push({ tabla, metodo: prop, args });
          return api;
        };
      },
    },
  );
  return api;
}

vi.mock('./supabase', () => ({
  supabase: { from: (tabla: string) => cadena(tabla) },
}));

import { closeThreadWithoutAgreement } from './offers';
import { fetchConsultedLineIds } from './search';

const MI_ORG = 'a1000000-0000-4000-8000-000000000001';
const LINEA = '10000000-0000-4000-8000-0000000000aa';
const HILO = '20000000-0000-4000-8000-000000000001';

beforeEach(() => {
  llamadas = [];
  tablas = {};
});

describe('messaging-and-negotiation/thread-lifecycle', () => {
  /*
   * Escenario «cierre sin acuerdo no afecta al marcado de consulta» (thread-lifecycle#6)
   *   GIVEN un hilo que transiciona manualmente a CERRADO SIN ACUERDO
   *   WHEN  se evalúa el estado de las líneas previamente consultadas en ese hilo
   *   THEN  el marcado de «línea consultada» permanece sin cambios, independiente del estado del hilo
   *
   * El cierre real y el recálculo del estado son SQL (0007). Aquí se prueba, en cliente, las dos
   * mitades que dependen de él: (1) cerrar el hilo escribe SOLO el estado del hilo, no toca ninguna
   * consulta ni línea; (2) el marcado se calcula sin mirar el estado del hilo.
   */
  it('messaging-and-negotiation/thread-lifecycle#6 · cerrar el hilo sin acuerdo solo escribe threads.state y el marcado de línea consultada no depende del estado del hilo', async () => {
    // GIVEN: una consulta mía pendiente sobre una línea del hilo.
    tablas['thread_items'] = [{ inventory_line_id: LINEA }];
    const antes = await fetchConsultedLineIds(MI_ORG, [LINEA]);
    expect(antes.has(LINEA)).toBe(true);

    // WHEN: el hilo pasa manualmente a CERRADO SIN ACUERDO.
    llamadas = [];
    await closeThreadWithoutAgreement(HILO);

    // THEN (1): la única escritura es sobre el estado del hilo; ninguna consulta ni línea se toca.
    const escrituras = llamadas.filter((l) => ['update', 'insert', 'delete', 'upsert', 'rpc'].includes(l.metodo));
    expect(escrituras).toEqual([{ tabla: 'threads', metodo: 'update', args: [{ state: 'CERRADO SIN ACUERDO' }] }]);
    expect(llamadas.some((l) => l.tabla === 'thread_items' || l.tabla === 'inventory_lines')).toBe(false);

    // THEN (2): la línea sigue marcada, y la consulta del marcado no filtra ni une por estado del hilo.
    llamadas = [];
    const despues = await fetchConsultedLineIds(MI_ORG, [LINEA]);
    expect(despues.has(LINEA)).toBe(true);
    expect(llamadas.every((l) => l.tabla === 'thread_items')).toBe(true);
    const select = llamadas.find((l) => l.metodo === 'select');
    expect(select?.args).toEqual(['inventory_line_id']);
    expect(llamadas.some((l) => l.metodo === 'eq' && /state|threads/i.test(String(l.args[0])))).toBe(false);
  });
});
