import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadSearch } from './ThreadSearch';
import { TAB_TEXTS, type ThreadReferenceOption } from '../../lib/negotiation-rows';

/**
 * CONTRATO DE ACEPTACIÓN · `ThreadSearch` (`amend-msg-hilos-pestanas-y-etiqueta`, spec
 * `thread-reference-search`). Escrito por Claude Code antes de la corrida; el Coder no lo ve.
 */

const REFS: ThreadReferenceOption[] = [
  { partNumber: '6205-2RS', brand: 'SKF', label: '6205-2RS · SKF' },
  { partNumber: '6205-2RS', brand: 'FAG', label: '6205-2RS · FAG' },
  { partNumber: '6205-ZZ', brand: 'SKF', label: '6205-ZZ · SKF' },
  { partNumber: '6206-ZZ', brand: 'SKF', label: '6206-ZZ · SKF' },
];

function montar(references = REFS) {
  const onPick = vi.fn();
  render(<ThreadSearch references={references} onPick={onPick} />);
  return { onPick, campo: screen.getByRole('searchbox', { name: TAB_TEXTS.searchPlaceholder }) };
}

describe('el campo', () => {
  it('un `searchbox` cuyo nombre y placeholder son el texto de ayuda de la spec, dentro de un `search`', () => {
    const { campo } = montar();
    expect(campo).toHaveAttribute('placeholder', TAB_TEXTS.searchPlaceholder);
    expect(screen.getByRole('search')).toContainElement(campo);
  });

  it('vacío, no enseña lista ni aviso', () => {
    montar();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
  });
});

describe('las coincidencias', () => {
  it('se despliegan mientras se escribe, parciales, cada una con su marca', async () => {
    const user = userEvent.setup();
    const { campo } = montar();
    await user.type(campo, '6205');
    expect(screen.getByRole('listbox', { name: TAB_TEXTS.searchResultsLabel })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '6205-2RS · SKF',
      '6205-2RS · FAG',
      '6205-ZZ · SKF',
    ]);
  });

  it('elegir una avisa con su referencia y marca, sin botón Buscar, y cierra la lista', async () => {
    const user = userEvent.setup();
    const { campo, onPick } = montar();
    await user.type(campo, '6205 2rs');
    await user.click(screen.getByRole('option', { name: '6205-2RS · FAG' }));
    expect(onPick).toHaveBeenCalledWith({ partNumber: '6205-2RS', brand: 'FAG' });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('button', { name: /buscar/i })).toBeNull();
  });

  it('sin coincidencias, el aviso de la spec con lo escrito, y ninguna opción', async () => {
    const user = userEvent.setup();
    const { campo } = montar();
    await user.type(campo, 'NU214');
    expect(screen.getByText(TAB_TEXTS.noMatches('NU214'))).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});
