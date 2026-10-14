import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_CRITERIA, activeChips, withoutChip, type SearchCriteria } from '../../lib/search';

/**
 * Fuera del contrato de SRCH-01 (`F-251`, `F-229`): la spec escribe el chip como «Zona / País» con el
 * ejemplo «Europa · España» y la construcción solo había hecho la mitad de la zona. El país filtra por
 * `location_country` (dónde está el stock), la zona por el continente de la organización.
 */

const { FilterChips } = await import('./FilterChips');

function pintar(c: SearchCriteria) {
  const onChange = vi.fn<(next: SearchCriteria) => void>();
  render(<FilterChips criteria={c} onChange={onChange} />);
  return onChange;
}

async function abrir() {
  await userEvent.click(screen.getByRole('button', { name: /filtro/i }));
  await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Zona');
}

describe('SRCH-01 · el chip de zona admite país (F-229)', () => {
  it('zona y país a la vez: un solo chip «Europa · España»', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Valor'), 'Europa');
    await userEvent.selectOptions(screen.getByLabelText('País'), 'España');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zone: 'EU', country: 'ES' }));
    expect(activeChips({ ...EMPTY_CRITERIA, zone: 'EU', country: 'ES' })).toEqual([
      { key: 'zone', label: 'Zona', value: 'Europa · España' },
    ]);
  });

  it('solo país, sin zona: se añade, y el chip dice «País», no «Zona»', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('País'), 'Alemania');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zone: null, country: 'DE' }));
    expect(activeChips({ ...EMPTY_CRITERIA, country: 'DE' })).toEqual([
      { key: 'zone', label: 'País', value: 'Alemania' },
    ]);
  });

  it('solo zona sigue funcionando como antes, y el país no es obligatorio', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Valor'), 'Europa');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zone: 'EU', country: '' }));
  });

  it('sin zona ni país no añade nada', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('quitar el chip se lleva zona y país, y cambiar de campo borra el país elegido', async () => {
    expect(withoutChip({ ...EMPTY_CRITERIA, zone: 'EU', country: 'ES' }, 'zone')).toEqual(EMPTY_CRITERIA);

    const onChange = pintar(EMPTY_CRITERIA);
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('País'), 'Francia');
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Marca');
    await userEvent.type(screen.getByLabelText('Valor'), 'SKF');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ brand: 'SKF', country: '' }));
  });
});
