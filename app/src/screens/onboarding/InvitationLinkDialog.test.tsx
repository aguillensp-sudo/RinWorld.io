import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationLinkDialog } from './InvitationLinkDialog';

const URL_ = 'https://app.test/#invitacion?token=' + 'cd'.repeat(32);
const NOW = new Date('2026-10-09T10:00:00Z');
const onClose = vi.fn<() => void>();

beforeEach(() => onClose.mockReset());

function mount() {
  render(<InvitationLinkDialog email="ana@sur.es" url={URL_} expiresAt="2026-10-14T10:00:00Z" onClose={onClose} now={NOW} />);
}

describe('INVT-01 · el enlace de la invitación', () => {
  it('lo enseña entero, dice que no se vuelve a mostrar y hasta cuándo vale', () => {
    mount();
    const dialogo = screen.getByRole('dialog', { name: 'Enlace de invitación' });
    expect(screen.getByRole('textbox', { name: 'Enlace de invitación' })).toHaveValue(URL_);
    expect(dialogo).toHaveTextContent('Cópialo ahora: no se vuelve a mostrar.');
    expect(dialogo).toHaveTextContent('ana@sur.es');
    expect(dialogo).toHaveTextContent(/14 oct 2026 \(dentro de 5 días\)/);
  });

  it('«Copiar enlace» lo copia y lo dice', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Después de `setup`: user-event instala su propio portapapeles y pisaría este.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mount();
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('si no hay portapapeles, lo dice y deja el campo para copiarlo a mano', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    mount();
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo copiar');
  });

  it('se cierra con el botón y con Escape', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
