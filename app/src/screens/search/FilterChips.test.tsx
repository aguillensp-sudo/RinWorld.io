import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_CRITERIA, type SearchCriteria } from '../../lib/search';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-01 · chips de filtro.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * El componente es **totalmente controlado**: no guarda criterios, los recibe y
 * emite los nuevos enteros. Los chips son una función de los criterios
 * (`activeChips`), no una lista con vida propia — si tuvieran estado habría dos
 * verdades sobre qué se está filtrando, y el día 9 VERA escribe sobre una de las
 * dos (`Plan §3`, día 9: "cableado VERA↔chips").
 */

const { FilterChips } = await import('./FilterChips');

function criteria(over: Partial<SearchCriteria> = {}): SearchCriteria {
  return { ...EMPTY_CRITERIA, ...over };
}

function pintar(c: SearchCriteria) {
  const onChange = vi.fn<(next: SearchCriteria) => void>();
  render(<FilterChips criteria={c} onChange={onChange} />);
  return onChange;
}

// -----------------------------------------------------------------------------

describe('SRCH-01 · chips activos', () => {
  it('pinta un chip por filtro, con su etiqueta y su valor', () => {
    pintar(criteria({ partNumber: '6205-2RS', minQuantity: 500, zone: 'EU' }));
    expect(screen.getByText('Ref')).toBeInTheDocument();
    expect(screen.getByText('6205-2RS')).toBeInTheDocument();
    expect(screen.getByText('500 u')).toBeInTheDocument();
    expect(screen.getByText('Europa')).toBeInTheDocument();
  });

  it('sin filtros no hay chips, solo el de añadir', () => {
    pintar(EMPTY_CRITERIA);
    expect(screen.getByRole('button', { name: /Filtro/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Quitar filtro/ })).not.toBeInTheDocument();
  });

  it('zona y país son un solo chip', () => {
    pintar(criteria({ zone: 'EU', country: 'ES' }));
    expect(screen.getByText('Europa · España')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Quitar filtro/ })).toHaveLength(1);
  });
});

describe('SRCH-01 · quitar un chip', () => {
  it('emite los criterios sin ese filtro', async () => {
    const onChange = pintar(criteria({ partNumber: '6205-2RS', brand: 'SKF' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Marca' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ brand: '', partNumber: '6205-2RS' }));
  });

  it('quitar el de zona limpia zona y país a la vez', async () => {
    const onChange = pintar(criteria({ zone: 'EU', country: 'ES' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Zona' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zone: null, country: '' }));
  });

  it('no muta los criterios que recibe', async () => {
    const c = criteria({ brand: 'SKF' });
    const onChange = pintar(c);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Marca' }));
    expect(c.brand).toBe('SKF');
    expect(onChange.mock.calls[0]![0]).not.toBe(c);
  });
});

describe('SRCH-01 · añadir un filtro a mano', () => {
  it('el formulario está oculto hasta pulsar + Filtro', async () => {
    pintar(EMPTY_CRITERIA);
    expect(screen.queryByLabelText('Campo')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    expect(screen.getByLabelText('Campo')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  });

  it('ofrece los cinco campos de la tabla de chips de la spec §3', async () => {
    pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    const opciones = Array.from(screen.getByLabelText<HTMLSelectElement>('Campo').options).map((o) => o.text);
    expect(opciones).toEqual(['Ref', 'Marca', 'Qty mín', 'Zona', 'Lead time máx']);
  });

  it('añade un filtro de texto', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Marca');
    await userEvent.type(screen.getByLabelText('Valor'), 'SKF');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ brand: 'SKF' }));
  });

  it('la cantidad mínima llega como número, no como cadena', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Qty mín');
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minQuantity: 500 }));
  });

  it('la zona se elige de una lista, no se teclea', async () => {
    // Los siete continentes son el CHECK de `organizations_continent_chk`. Un
    // campo libre aquí deja escribir "Europa occidental" y el filtro no corta
    // nada — un chip que no filtra es peor que no tener chip.
    const onChange = pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Zona');
    await userEvent.selectOptions(screen.getByLabelText('Valor'), 'Europa');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zone: 'EU' }));
  });

  it('un valor vacío no añade nada', async () => {
    const onChange = pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Marca');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('no usa window.prompt', async () => {
    // El mock lo hace (`addFilterChip`). En React es un diálogo que no se puede
    // probar, no se puede estilar y bloquea el hilo.
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('SKF');
    pintar(EMPTY_CRITERIA);
    await userEvent.click(screen.getByRole('button', { name: /Filtro/ }));
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });
});
