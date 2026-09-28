import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login';

/**
 * Wiring de REG-00, escrito a mano el 28-sep-2026: la entrada a la Ruta 00.2 desde
 * LOGIN-01. Solo aparece si `App.tsx` pasa `onRequestAccess`.
 *
 * ⚠ Va en su propio fichero y NO en `Login.test.tsx`, que es el contrato de
 * LOGIN-01: el guardia de `--seco` (`cruzar_con_el_contrato`) cruza ese contrato
 * con la tarea de LOGIN-01, y un literal que la tarea no nombra lo ensucia
 * (rompió `test_checks` en CI, 28-sep).
 */
describe('LOGIN-01 · entrada a la Solicitud de Registro (REG-00)', () => {
  it('sin onRequestAccess no hay botón', () => {
    render(<Login onSubmit={vi.fn()} error={null} />);
    expect(screen.queryByRole('button', { name: 'Solicitud de Registro' })).toBeNull();
  });

  it('con onRequestAccess, el botón lo llama', async () => {
    const onRequestAccess = vi.fn();
    render(<Login onSubmit={vi.fn()} error={null} onRequestAccess={onRequestAccess} />);
    await userEvent.click(screen.getByRole('button', { name: 'Solicitud de Registro' }));
    expect(onRequestAccess).toHaveBeenCalledTimes(1);
  });
});
