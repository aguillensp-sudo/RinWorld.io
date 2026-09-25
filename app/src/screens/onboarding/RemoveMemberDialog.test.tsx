import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TeamMember } from '../../lib/invitations';
import { RemoveMemberDialog } from './RemoveMemberDialog';

/**
 * CONTRATO DE ACEPTACIÓN · INVT-01 · la confirmación (`RemoveMemberDialog`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no lo ve. Es PRESENTACIONAL: no elimina nada, solo pide confirmación y avisa.
 */

const LUIS: TeamMember = { id: 'luis', fullName: 'Luis Pérez Molina', email: 'l.perez@aceroindustrial.com', role: 'EDITOR', state: 'ACTIVE' };

function mount(over: Partial<React.ComponentProps<typeof RemoveMemberDialog>> = {}) {
  const props = { member: LUIS, busy: false, error: null, onConfirm: vi.fn(), onCancel: vi.fn(), ...over };
  render(<RemoveMemberDialog {...props} />);
  return props;
}

describe('INVT-01 · RemoveMemberDialog', () => {
  it('es un diálogo modal con nombre «Eliminar usuario»', () => {
    mount();
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar usuario' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
  });

  it('dice de quién se trata y que la acción es irreversible', () => {
    mount();
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar usuario' });
    expect(within(dialogo).getByText('Luis Pérez Molina')).toBeInTheDocument();
    expect(within(dialogo).getByText('l.perez@aceroindustrial.com')).toBeInTheDocument();
    expect(within(dialogo).getByText('Esta acción es irreversible. El usuario perderá acceso inmediatamente.')).toBeInTheDocument();
  });

  it('«Eliminar» confirma y «Cancelar» cancela, cada uno una sola vez', async () => {
    const user = userEvent.setup();
    const props = mount();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape cancela', async () => {
    const props = mount();
    await userEvent.setup().keyboard('{Escape}');
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('sin error no hay alerta; con error, la alerta lleva el motivo y el diálogo sigue en pantalla', () => {
    const { rerender } = render(
      <RemoveMemberDialog member={LUIS} busy={false} error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <RemoveMemberDialog member={LUIS} busy={false} error="Ese usuario ya no tiene acceso." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ese usuario ya no tiene acceso.');
    expect(screen.getByRole('dialog', { name: 'Eliminar usuario' })).toBeInTheDocument();
  });

  it('con la eliminación en vuelo los dos botones están deshabilitados: no se puede confirmar dos veces', () => {
    mount({ busy: true });
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
