import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchResultRow } from '../../lib/search';
import { ResultsTable } from './ResultsTable';

/**
 * PARCIALES · conversational-search/results-row-actions#3, escrito desde la spec.
 *
 *   GIVEN un miembro en SRCH-01 que ya tiene un hilo con la organización de una fila
 *   WHEN  pulsa "Contactar" en esa fila
 *   THEN  se abre directamente ese hilo (MSG-02), sin pasar por la ficha de la organización
 *   AND   la acción está siempre disponible independientemente del estado de consulta de la fila
 *
 * Lo que el unit puede decir es la segunda parte: el botón de TODAS las filas, consultadas o
 * no, seleccionadas o no, está habilitado y contacta a la organización de ESA fila. Que
 * contactar con hilo abre el hilo lo cubre el e2e `search-contactar.spec.ts`.
 */

const base: SearchResultRow = {
  id: 'l-0',
  partNumber: '6205-2RS',
  brand: 'SKF',
  quantity: 850,
  leadTimeDays: 3,
  orgId: 'org-0',
  orgName: 'Empresa 0',
  country: 'DE',
  lastUploadAt: '2026-10-10T12:00:00Z',
  favoriteCount: 1,
  isFavorite: false,
  consulted: false,
};

const FILAS: SearchResultRow[] = [
  { ...base, id: 'l-1', orgId: 'org-1', orgName: 'Empresa Libre', consulted: false },
  { ...base, id: 'l-2', orgId: 'org-2', orgName: 'Empresa Consultada', consulted: true },
  { ...base, id: 'l-3', orgId: 'org-3', orgName: 'Empresa Seleccionada', consulted: false },
  { ...base, id: 'l-4', orgId: 'org-4', orgName: 'Empresa Consultada y Seleccionada', consulted: true },
];

describe('conversational-search/results-row-actions', () => {
  it('conversational-search/results-row-actions#3 · Contactar está habilitado en toda fila, consultada o no, y abre la organización de ESA fila', async () => {
    const contactar = vi.fn<(orgId: string) => void>();
    const consultar = vi.fn();
    render(
      <ResultsTable
        rows={FILAS}
        sort={null}
        selected={new Set(['l-3', 'l-4'])}
        minQuantity={null}
        now={new Date('2026-10-16T12:00:00Z')}
        onSort={vi.fn()}
        onToggleRow={vi.fn()}
        onToggleFavorite={vi.fn()}
        onConsult={consultar}
        onContact={vi.fn()}
        onContactOrganization={contactar}
      />,
    );

    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(4);

    // Contraste: «Consultar» sí depende del estado (la consultada la tiene apagada). Sin esto, el
    // aserto de abajo no distinguiría una tabla que apaga todo de una que solo deja Contactar vivo.
    const consultarDe = (f: HTMLElement) => within(f).getByRole('button', { name: 'Consultar' });
    expect(consultarDe(filas.find((f) => within(f).queryByText('Empresa Consultada'))!)).toBeDisabled();

    // THEN: en las cuatro, Contactar habilitado, y cada clic lleva SU organización
    for (const f of filas) {
      const boton = within(f).getByRole('button', { name: 'Contactar' });
      expect(boton).toBeEnabled();
    }
    for (const fila of FILAS) {
      const f = filas.find((r) => within(r).queryByText(fila.orgName))!;
      await userEvent.click(within(f).getByRole('button', { name: 'Contactar' }));
      expect(contactar).toHaveBeenLastCalledWith(fila.orgId);
    }
    expect(contactar).toHaveBeenCalledTimes(4);
    // Contactar no es una consulta: no dispara el flujo de consultar
    expect(consultar).not.toHaveBeenCalled();
  });
});
