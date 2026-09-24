import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WatcherDraft } from '../../lib/watchers';
import { WatcherEditForm } from './WatcherEditForm';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-03 · formulario `Editar watcher` (spec §4).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Es
 * TOTALMENTE CONTROLADO: el borrador vive en el padre.
 */

const DRAFT: WatcherDraft = { partNumber: '6308-ZZ', minQuantity: '100', brand: '', country: '', emailChannel: false };

function montar(over: Partial<{ draft: WatcherDraft; busy: boolean; error: string | null }> = {}) {
  const h = { onChange: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() };
  render(
    <WatcherEditForm partNumber="6308-ZZ" draft={over.draft ?? DRAFT} busy={over.busy ?? false} error={over.error ?? null} {...h} />,
  );
  return h;
}

describe('WatcherEditForm · campos (spec §4)', () => {
  it('es un form con nombre y pinta los cinco campos con su etiqueta', () => {
    montar();
    expect(screen.getByRole('form', { name: 'Editar watcher 6308-ZZ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Referencia')).toHaveValue('6308-ZZ');
    expect(screen.getByLabelText('Cantidad mínima')).toHaveValue(100);
    expect(screen.getByLabelText('Marca')).toHaveValue('');
    expect(screen.getByLabelText('País')).toHaveValue('');
    expect(screen.getByLabelText('Canal email')).not.toBeChecked();
  });

  it('placeholders y field hints literales', () => {
    montar();
    expect(screen.getByLabelText('Referencia')).toHaveAttribute('placeholder', 'Ej: 6308-ZZ');
    expect(screen.getByLabelText('Cantidad mínima')).toHaveAttribute('placeholder', 'Ej: 100');
    expect(screen.getByLabelText('Marca')).toHaveAttribute('placeholder', 'Cualquier marca');
    expect(screen.getByText('Código exacto del rodamiento')).toBeInTheDocument();
    expect(screen.getByText('Unidades mínimas para que se dispare')).toBeInTheDocument();
    expect(screen.getByText('Opcional — deja vacío para cualquier fabricante')).toBeInTheDocument();
    expect(screen.getByText('Opcional — deja vacío para cualquier origen')).toBeInTheDocument();
    expect(screen.getByText('Recibirás también una notificación por email')).toBeInTheDocument();
  });

  it('País es un select con «Cualquier país» y códigos ISO reales', () => {
    montar();
    const sel = screen.getByLabelText('País');
    expect(sel.tagName).toBe('SELECT');
    const opts = Array.from((sel as HTMLSelectElement).options);
    expect(opts[0]).toHaveTextContent('Cualquier país');
    expect(opts[0]).toHaveValue('');
    expect(opts.find((o) => o.value === 'ES')).toHaveTextContent('España');
    expect(opts.find((o) => o.value === 'DE')).toHaveTextContent('Alemania');
    expect(opts.length).toBeGreaterThan(200);
  });

  it('con un país en el borrador, el select lo tiene seleccionado', () => {
    montar({ draft: { ...DRAFT, country: 'ES' } });
    expect(screen.getByLabelText('País')).toHaveValue('ES');
  });
});

describe('WatcherEditForm · controlado', () => {
  it('cada cambio llama a onChange con el borrador entero actualizado', () => {
    const h = montar();
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: '6308-2RS' } });
    expect(h.onChange).toHaveBeenLastCalledWith({ ...DRAFT, partNumber: '6308-2RS' });
    fireEvent.change(screen.getByLabelText('Cantidad mínima'), { target: { value: '250' } });
    expect(h.onChange).toHaveBeenLastCalledWith({ ...DRAFT, minQuantity: '250' });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'SKF' } });
    expect(h.onChange).toHaveBeenLastCalledWith({ ...DRAFT, brand: 'SKF' });
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'DE' } });
    expect(h.onChange).toHaveBeenLastCalledWith({ ...DRAFT, country: 'DE' });
    fireEvent.click(screen.getByLabelText('Canal email'));
    expect(h.onChange).toHaveBeenLastCalledWith({ ...DRAFT, emailChannel: true });
  });
});

describe('WatcherEditForm · guardar y cancelar', () => {
  it('Guardar cambios está habilitado con un borrador válido y llama a onSave', async () => {
    const h = montar();
    const b = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(b).toBeEnabled();
    await userEvent.click(b);
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['referencia de un carácter', { partNumber: 'A' }],
    ['referencia vacía', { partNumber: '' }],
    ['cantidad cero', { minQuantity: '0' }],
    ['cantidad decimal', { minQuantity: '1.5' }],
    ['cantidad vacía', { minQuantity: '' }],
  ])('Guardar cambios queda deshabilitado con %s', (_n, parche) => {
    montar({ draft: { ...DRAFT, ...parche } });
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('marca y país vacíos NO invalidan: son opcionales', () => {
    montar({ draft: { ...DRAFT, brand: '', country: '' } });
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('Cancelar llama a onCancel y no guarda', async () => {
    const h = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onSave).not.toHaveBeenCalled();
  });

  it('con busy, guardar queda deshabilitado', () => {
    montar({ busy: true });
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('un error se pinta en un role=alert dentro del formulario', () => {
    montar({ error: 'El watcher 6308-ZZ no existe.' });
    expect(screen.getByRole('alert')).toHaveTextContent('El watcher 6308-ZZ no existe.');
  });
});
