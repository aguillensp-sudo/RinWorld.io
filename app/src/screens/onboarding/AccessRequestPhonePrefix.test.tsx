import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Petición del PO en la C5 de REG-00 (29-sep-2026), escrita a mano por Claude
 * Code: al elegir el país, el teléfono muestra `+<prefijo> ` y se puede editar.
 * Va aparte del contrato del Coder (`AccessRequest.test.tsx`), igual que las
 * pruebas del botón del login (`LoginRequestAccess.test.tsx`).
 */

vi.mock('../../lib/access-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/access-request')>()),
  submitAccessRequest: vi.fn(),
}));

const { AccessRequest } = await import('./AccessRequest');

vi.setConfig({ testTimeout: 20_000 });

const pais = () => screen.getByRole('combobox', { name: 'País de la organización' });
const telefono = () => screen.getByRole('textbox', { name: 'Teléfono de contacto' });

function mount() {
  render(<AccessRequest onSubmitted={vi.fn()} onHaveInvitation={vi.fn()} />);
}

describe('REG-00 · prefijo del país en el teléfono', () => {
  it('al elegir España, el teléfono vacío pasa a "+34 "', async () => {
    mount();
    await userEvent.selectOptions(pais(), 'ES');
    expect(telefono()).toHaveValue('+34 ');
  });

  it('el prefijo se puede editar', async () => {
    mount();
    await userEvent.selectOptions(pais(), 'ES');
    await userEvent.type(telefono(), '963 456 789');
    expect(telefono()).toHaveValue('+34 963 456 789');
    await userEvent.clear(telefono());
    await userEvent.type(telefono(), '0034 963 456 789');
    expect(telefono()).toHaveValue('0034 963 456 789');
  });

  it('cambiar de país cambia el prefijo y conserva el número', async () => {
    mount();
    await userEvent.selectOptions(pais(), 'ES');
    await userEvent.type(telefono(), '963 456 789');
    await userEvent.selectOptions(pais(), 'PT');
    expect(telefono()).toHaveValue('+351 963 456 789');
  });

  it('con solo el prefijo, Enviar solicitud sigue deshabilitado', async () => {
    mount();
    await userEvent.type(screen.getByRole('textbox', { name: 'Email del solicitante' }), 'john@bearings.com');
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre y apellidos' }), 'John Reece');
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de la organización' }), 'Bearings');
    await userEvent.selectOptions(pais(), 'US');
    await userEvent.type(screen.getByRole('textbox', { name: 'Sitio web' }), 'https://www.bearings.com');
    expect(telefono()).toHaveValue('+1 ');
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();
    await userEvent.type(telefono(), '555 010 0100');
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
  });
});
