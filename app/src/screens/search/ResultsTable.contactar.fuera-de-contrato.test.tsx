import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchResultRow } from '../../lib/search';
import { ResultsTable } from './ResultsTable';

/**
 * `Contactar` de fila lleva a la ficha de la empresa (D3). **Ninguna tarea del corpus lo
 * pide**: va en fichero aparte, como el cableado VERA de SearchResults, para que el
 * contrato de `ResultsTable.test.tsx` siga siendo el que midió al Coder.
 */

const fila: SearchResultRow = {
  id: '10000000-0000-4000-8000-000000000001',
  partNumber: '6205-2RS',
  brand: 'SKF',
  quantity: 850,
  leadTimeDays: 3,
  orgId: 'b2000000-0000-4000-8000-000000000002',
  orgName: 'Nordwälz Lager',
  country: 'DE',
  lastUploadAt: '2026-08-10T12:00:00Z',
  favoriteCount: 1,
  isFavorite: false,
  consulted: false,
};

function pintar(onOpenOrganization?: (orgId: string) => void) {
  render(
    <ResultsTable
      rows={[fila]}
      sort={null}
      selected={new Set()}
      minQuantity={null}
      now={new Date('2026-08-11T12:00:00Z')}
      onSort={vi.fn()}
      onToggleRow={vi.fn()}
      onToggleFavorite={vi.fn()}
      onConsult={vi.fn()}
      onContact={vi.fn()}
      onOpenOrganization={onOpenOrganization}
    />,
  );
  return within(screen.getAllByRole('row')[1]!).getByRole('button', { name: 'Contactar' });
}

describe('ResultsTable · Contactar → ficha de la empresa', () => {
  it('con onOpenOrganization está habilitado y abre la ficha de esa organización', async () => {
    const abrir = vi.fn<(orgId: string) => void>();
    const boton = pintar(abrir);
    expect(boton).toBeEnabled();
    await userEvent.click(boton);
    expect(abrir).toHaveBeenCalledWith(fila.orgId);
  });

  it('sin onOpenOrganization sigue apagado y con su motivo', () => {
    const boton = pintar();
    expect(boton).toBeDisabled();
    expect(boton.getAttribute('title') ?? '').not.toHaveLength(0);
  });
});
