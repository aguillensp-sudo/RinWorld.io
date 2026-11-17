import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagCombobox } from './TagCombobox';
import { TAB_TEXTS, type ThreadReference, type ThreadReferenceOption } from '../../lib/negotiation-rows';

/**
 * «Sobre:» como campo en el que se escribe (PO, 17-nov-2026). Escrito por Claude Code; es
 * montaje a mano, no del arnés.
 */

const REFS: ThreadReferenceOption[] = [
  { partNumber: '6205-2RS', brand: 'NSK', label: '6205-2RS · NSK' },
  { partNumber: '6205-2RS', brand: 'ZKL', label: '6205-2RS · ZKL' },
  { partNumber: '6206-ZZ', brand: 'FAG', label: '6206-ZZ · FAG' },
];

function montar(value: ThreadReference | null | undefined = undefined) {
  const onChange = vi.fn();
  render(<TagCombobox references={REFS} value={value} onChange={onChange} />);
  return { onChange, campo: screen.getByRole('combobox', { name: TAB_TEXTS.tagLabel }) };
}

const opciones = () =>
  within(screen.getByRole('listbox', { name: TAB_TEXTS.tagOptionsLabel }))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('«Sobre:»', () => {
  it('es un campo de texto (combobox) con la etiqueta elegida escrita; vacío si no hay elegida', () => {
    const { campo } = montar({ partNumber: '6206-ZZ', brand: 'FAG' });
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toHaveValue('6206-ZZ · FAG');
  });

  it('sin elegir, vacío con su texto de ayuda', () => {
    const { campo } = montar();
    expect(campo).toHaveValue('');
    expect(campo).toHaveAttribute('placeholder', TAB_TEXTS.tagPlaceholder);
  });

  it('sin lista hasta que se entra en el campo', () => {
    montar();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('al entrar, debajo: «Conversación general» y todas las referencias en el orden que llegan', async () => {
    const user = userEvent.setup();
    const { campo } = montar();
    await user.click(campo);
    expect(opciones()).toEqual([TAB_TEXTS.generalConversation, '6205-2RS · NSK', '6205-2RS · ZKL', '6206-ZZ · FAG']);
  });

  it('al escribir, solo las que coinciden, sin mayúsculas ni separadores', async () => {
    const user = userEvent.setup();
    const { campo } = montar();
    await user.type(campo, '6205 2rs');
    expect(opciones()).toEqual(['6205-2RS · NSK', '6205-2RS · ZKL']);
  });

  it('elegir una avisa con su referencia y marca, y cierra la lista', async () => {
    const user = userEvent.setup();
    const { campo, onChange } = montar();
    await user.type(campo, '6206');
    await user.click(screen.getByRole('option', { name: '6206-ZZ · FAG' }));
    expect(onChange).toHaveBeenCalledWith({ partNumber: '6206-ZZ', brand: 'FAG' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('«Conversación general» avisa con `null`', async () => {
    const user = userEvent.setup();
    const { campo, onChange } = montar();
    await user.click(campo);
    await user.click(screen.getByRole('option', { name: TAB_TEXTS.generalConversation }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('con el teclado: flechas y Enter', async () => {
    const user = userEvent.setup();
    const { campo, onChange } = montar();
    await user.type(campo, '6205');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith({ partNumber: '6205-2RS', brand: 'ZKL' });
  });

  it('escribir no cambia la etiqueta: al salir sin elegir, vuelve lo que había', async () => {
    const user = userEvent.setup();
    const { campo, onChange } = montar({ partNumber: '6206-ZZ', brand: 'FAG' });
    await user.clear(campo);
    await user.type(campo, '6205');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(campo).toHaveValue('6206-ZZ · FAG');
  });
});
