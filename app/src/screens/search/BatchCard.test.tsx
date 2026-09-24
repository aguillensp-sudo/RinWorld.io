import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BatchResult } from '../../lib/batch';
import type { SearchResultRow } from '../../lib/search';
import { BatchCard } from './BatchCard';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-02 · tarjeta (`BatchCard`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. PRESENTACIONAL:
 * la tabla de resultados ya existe (`ResultsTable`, SRCH-01) y la tarjeta la
 * reutiliza, no la reescribe: «tabla de resultados idéntica a SRCH-01».
 */

const NOW = new Date('2026-09-24T12:00:00Z');

function fila(over: Partial<SearchResultRow>): SearchResultRow {
  return {
    id: 'l1',
    partNumber: '6205-2RS',
    brand: 'NSK',
    quantity: 1200,
    leadTimeDays: 5,
    orgId: 'o1',
    orgName: 'Schaeffler Iberia SL',
    country: 'ES',
    lastUploadAt: '2026-09-23T12:00:00Z',
    favoriteCount: 3,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

const CON_STOCK: BatchResult = {
  reference: '6205-2RS',
  page: {
    rows: [
      fila({ id: 'a', partNumber: '6205-2RS', quantity: 1200, orgId: 'o1', orgName: 'Schaeffler Iberia SL', brand: 'NSK', country: 'DE' }),
      fila({ id: 'b', partNumber: '6205-2RS/C3', quantity: 300, orgId: 'o2', orgName: 'Nordwälz Lager', brand: 'FAG', country: 'ES' }),
    ],
    total: 2,
    capped: false,
  },
  error: null,
};
const SIN_RESULTADOS: BatchResult = { reference: '6308-ZZ', page: { rows: [], total: 0, capped: false }, error: null };
const FALLIDA: BatchResult = { reference: '7210-BECBP', page: null, error: 'boom' };

function montar(result: BatchResult, over: Partial<Parameters<typeof BatchCard>[0]> = {}) {
  const h = {
    onToggle: vi.fn(),
    onSort: vi.fn(),
    onToggleRow: vi.fn(),
    onToggleFavorite: vi.fn(),
    onConsult: vi.fn(),
    onContact: vi.fn(),
  };
  render(<BatchCard result={result} expanded={false} sort={null} selected={new Set()} now={NOW} {...h} {...over} />);
  return h;
}

describe('BatchCard · cabecera', () => {
  it('es un article con nombre, con la referencia y el resumen de la cabecera', () => {
    montar(CON_STOCK);
    const card = screen.getByRole('article', { name: 'Referencia 6205-2RS' });
    expect(within(card).getByText('6205-2RS')).toBeInTheDocument();
    expect(within(card).getByText('Distribuidores: 2 · Máx: 1200 u (NSK, DE)')).toBeInTheDocument();
  });

  it('el botón de expandir lleva aria-expanded y su nombre cambia con el estado', async () => {
    const h = montar(CON_STOCK);
    const b = screen.getByRole('button', { name: 'Expandir 6205-2RS' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(b);
    expect(h.onToggle).toHaveBeenCalledTimes(1);
  });

  it('expandida: el botón dice Contraer y aria-expanded es true', () => {
    montar(CON_STOCK, { expanded: true });
    expect(screen.getByRole('button', { name: 'Contraer 6205-2RS' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('BatchCard · la tabla', () => {
  it('colapsada NO pinta la tabla', () => {
    montar(CON_STOCK);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('expandida pinta la tabla de SRCH-01 con una fila por línea', () => {
    montar(CON_STOCK, { expanded: true });
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: /Cantidad/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar 6205-2RS' })).toBeInTheDocument();
  });

  it('el orden sigue a `sort`: por cantidad ascendente sale primero la de 300', () => {
    montar(CON_STOCK, { expanded: true, sort: { column: 'quantity', direction: 'asc' } });
    const primera = screen.getAllByRole('row')[1]!;
    expect(within(primera).getByText('Nordwälz Lager')).toBeInTheDocument();
  });

  it('pulsar una cabecera ordenable llama a onSort con su columna', async () => {
    const h = montar(CON_STOCK, { expanded: true });
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Cantidad/ })).getByRole('button'));
    expect(h.onSort).toHaveBeenCalledWith('quantity');
  });

  it('marcar una fila llama a onToggleRow con el id de la línea, y `selected` la deja marcada', async () => {
    const h = montar(CON_STOCK, { expanded: true, selected: new Set(['b']) });
    expect(screen.getByRole('checkbox', { name: 'Seleccionar 6205-2RS/C3' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar 6205-2RS' }));
    expect(h.onToggleRow).toHaveBeenCalledWith('a');
  });

  it('el favorito llama a onToggleFavorite con la organización', async () => {
    const h = montar(CON_STOCK, { expanded: true });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar favorito de Schaeffler Iberia SL' }));
    expect(h.onToggleFavorite).toHaveBeenCalledWith('o1');
  });
});

describe('BatchCard · sin resultados y fallida', () => {
  it('sin resultados: «Sin resultados», sin tabla aunque esté expandida, y un Crear watcher inline DESHABILITADO con el motivo', () => {
    montar(SIN_RESULTADOS, { expanded: true });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const b = screen.getByRole('button', { name: 'Crear watcher — 6308-ZZ' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('title', 'La creación de watchers necesita la confirmación de VERA, que todavía no está conectada.');
  });

  it('una consulta fallida se pinta en un role=alert DENTRO de la tarjeta, sin tabla, y NO ofrece crear watcher', () => {
    montar(FALLIDA, { expanded: true });
    const card = screen.getByRole('article', { name: 'Referencia 7210-BECBP' });
    expect(within(card).getByRole('alert')).toHaveTextContent('boom');
    expect(within(card).getByText('No se pudo consultar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear watcher/ })).not.toBeInTheDocument();
  });

  it('con resultados NO hay botón de crear watcher', () => {
    montar(CON_STOCK, { expanded: true });
    expect(screen.queryByRole('button', { name: /Crear watcher/ })).not.toBeInTheDocument();
  });
});
