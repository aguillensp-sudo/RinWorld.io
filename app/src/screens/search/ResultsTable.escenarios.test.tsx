import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

/**
 * ESCENARIOS DE SPEC de `messaging-and-negotiation` sobre el marcado de «línea consultada» en SRCH-01
 * (nivel unit, sin base). Salen de `openspec/specs/messaging-and-negotiation/spec.md`; cada `it`
 * empieza por el id del escenario de `openspec/v1/trazabilidad.csv`.
 *
 * El mock de Supabase imita lo único que importa aquí: `thread_items` solo devuelve las consultas
 * cuyo `inventory_line_id` esté en el `.in(...)` de la consulta, como haría la base.
 */

interface Llamada {
  tabla: string;
  metodo: string;
  args: unknown[];
}

let llamadas: Llamada[] = [];
let tablas: Record<string, unknown[]> = {};

function cadena(tabla: string): unknown {
  let ids: unknown[] | null = null;
  let columnaIn = '';
  const api: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const todas = tablas[tabla] ?? [];
          const data = ids ? todas.filter((r) => ids!.includes((r as Record<string, unknown>)[columnaIn])) : todas;
          return (res: (v: unknown) => void) => res({ data, error: null, count: data.length });
        }
        return (...args: unknown[]) => {
          llamadas.push({ tabla, metodo: prop, args });
          if (prop === 'in') {
            columnaIn = String(args[0]);
            ids = args[1] as unknown[];
          }
          return api;
        };
      },
    },
  );
  return api;
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (tabla: string) => cadena(tabla) },
}));

import { fetchResults, EMPTY_CRITERIA, type SearchResultRow } from '../../lib/search';
import { ResultsTable } from './ResultsTable';

const COMPRADOR_ORG = 'a1000000-0000-4000-8000-000000000001';
const COMPRADOR_MIEMBRO = 'a1000000-0000-4000-8000-00000000000a';
const DISTRIBUIDOR = 'b2000000-0000-4000-8000-000000000002';
const LINEA_ANTIGUA = '10000000-0000-4000-8000-0000000000aa';
const LINEA_NUEVA = '10000000-0000-4000-8000-0000000000bb';

function lineaPublicada(id: string) {
  // Misma referencia, marca y cantidad: lo único que cambia es el ID interno.
  return {
    id,
    part_number: '6205-2RS',
    brand: 'SKF',
    quantity: 850,
    location_country: 'DE',
    lead_time_days: 3,
    last_upload_at: '2026-10-10T12:00:00Z',
    org_id: DISTRIBUIDOR,
    organizations: { id: DISTRIBUIDOR, name: 'Nordwälz Lager', country: 'DE', continent: 'EU', favorite_count: 1 },
  };
}

beforeEach(() => {
  llamadas = [];
  tablas = {};
});

function pintar(rows: SearchResultRow[]) {
  render(
    <ResultsTable
      rows={rows}
      sort={null}
      selected={new Set(rows.map((r) => r.id))}
      minQuantity={null}
      now={new Date('2026-10-11T12:00:00Z')}
      onSort={vi.fn()}
      onToggleRow={vi.fn()}
      onToggleFavorite={vi.fn()}
      onConsult={vi.fn()}
      onContact={vi.fn()}
    />,
  );
  return within(screen.getAllByRole('row')[1]!).getByRole('button', { name: 'Consultar' });
}

describe('messaging-and-negotiation/inquiry-card', () => {
  /*
   * Escenario «reseteo de marcado tras reemplazo total de inventario» (inquiry-card#4)
   *   GIVEN una línea previamente marcada como consultada que es sustituida por una nueva línea
   *         (nuevo ID interno) tras un reemplazo total de inventario del distribuidor
   *   WHEN  el comprador visualiza la referencia tras el reemplazo
   *   THEN  la nueva línea aparece como no consultada
   *   AND   el botón «Consultar» está disponible de nuevo, independientemente de que part_number,
   *         brand y cantidad coincidan con la línea anterior
   *
   * Lo que el reemplazo hace en la base (DELETED a las antiguas, IDs nuevos) es SQL: aquí el
   * reemplazo se representa con los datos que la base devolvería (la antigua deja de estar
   * publicada y aparece una con otro ID). Se prueba lo que decide el cliente: el marcado se
   * calcula por ID de línea, no por referencia/marca/cantidad.
   */
  it('messaging-and-negotiation/inquiry-card#4 · tras un reemplazo total la línea nueva (otro ID, misma referencia) sale no consultada y con «Consultar» disponible', async () => {
    // Una consulta MÍA pendiente sobre la línea antigua.
    tablas['thread_items'] = [{ inventory_line_id: LINEA_ANTIGUA }];

    // Control (antes del reemplazo): la línea antigua sigue publicada y está marcada.
    tablas['inventory_lines'] = [lineaPublicada(LINEA_ANTIGUA)];
    const antes = await fetchResults({ orgId: COMPRADOR_ORG, memberId: COMPRADOR_MIEMBRO, criteria: EMPTY_CRITERIA });
    expect(antes.rows).toHaveLength(1);
    expect(antes.rows[0]!.consulted).toBe(true);

    // GIVEN el reemplazo total: la antigua deja de estar publicada y entra una con otro ID.
    tablas['inventory_lines'] = [lineaPublicada(LINEA_NUEVA)];
    llamadas = [];

    // WHEN el comprador visualiza la referencia tras el reemplazo.
    const despues = await fetchResults({ orgId: COMPRADOR_ORG, memberId: COMPRADOR_MIEMBRO, criteria: EMPTY_CRITERIA });

    // THEN la nueva línea es la misma referencia y NO está consultada.
    const nueva = despues.rows[0]!;
    expect(nueva.id).toBe(LINEA_NUEVA);
    expect([nueva.partNumber, nueva.brand, nueva.quantity]).toEqual(['6205-2RS', 'SKF', 850]);
    expect(nueva.consulted).toBe(false);
    // El marcado se consultó por ID de línea, no por referencia/marca/cantidad.
    const porId = llamadas.find((l) => l.tabla === 'thread_items' && l.metodo === 'in');
    expect(porId?.args).toEqual(['inventory_line_id', [LINEA_NUEVA]]);

    // AND el botón «Consultar» está disponible de nuevo (fila seleccionada, sin «Ya consultada»).
    const boton = pintar(despues.rows);
    expect(boton).toBeEnabled();
    expect(boton).toHaveAttribute('title', 'Enviar la consulta de esta línea');
  });
});
