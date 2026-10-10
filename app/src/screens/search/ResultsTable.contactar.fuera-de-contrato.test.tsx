import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchResultRow } from '../../lib/search';
import { ResultsTable } from './ResultsTable';

/**
 * `Contactar` de fila contacta a la empresa (hilo o primer mensaje, `App.contactFromSearch`). **Ninguna tarea del corpus lo
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

function pintar(onContactOrganization?: (orgId: string) => void) {
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
      onContactOrganization={onContactOrganization}
    />,
  );
  return within(screen.getAllByRole('row')[1]!).getByRole('button', { name: 'Contactar' });
}

describe('ResultsTable · Contactar → hilo con la empresa', () => {
  it('con onContactOrganization está habilitado y contacta a esa organización', async () => {
    const abrir = vi.fn<(orgId: string) => void>();
    const boton = pintar(abrir);
    expect(boton).toBeEnabled();
    await userEvent.click(boton);
    expect(abrir).toHaveBeenCalledWith(fila.orgId);
  });

  it('sin onContactOrganization sigue apagado y con su motivo', () => {
    const boton = pintar();
    expect(boton).toBeDisabled();
    expect(boton.getAttribute('title') ?? '').not.toHaveLength(0);
  });
});
