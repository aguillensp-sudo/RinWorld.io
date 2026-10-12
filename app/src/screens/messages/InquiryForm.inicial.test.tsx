import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InquiryForm } from './InquiryForm';

/**
 * El formulario de consulta puede arrancar con valores (VERA los rellena, MSG-03 §5, F-249). Escrito a mano:
 * es un cambio sobre el artefacto del Coder y su contrato (`InquiryForm.test.tsx`) no se toca para otra cosa.
 */
function pinta(over: Partial<React.ComponentProps<typeof InquiryForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <InquiryForm
      reference="6205-2RS"
      brand="SKF"
      country="Alemania"
      duplicate={false}
      busy={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={() => {}}
      {...over}
    />,
  );
  return onSubmit;
}

describe('InquiryForm · valores iniciales', () => {
  it('arranca con la cantidad y las notas que se le dan, y el botón ya está habilitado', () => {
    pinta({ initialQuantity: '300', initialNotes: 'Entrega urgente' });
    expect(screen.getByLabelText(/Cantidad solicitada/i)).toHaveValue(300);
    expect(screen.getByLabelText('Notas adicionales')).toHaveValue('Entrega urgente');
    expect(screen.getByRole('button', { name: 'Enviar consulta' })).toBeEnabled();
  });

  it('lo preparado se envía tal cual, y se puede cambiar antes', async () => {
    const onSubmit = pinta({ initialQuantity: '300' });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(onSubmit).toHaveBeenCalledWith({ quantity: 300, notes: null });

    const cantidad = screen.getByLabelText(/Cantidad solicitada/i);
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '120');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ quantity: 120, notes: null });
  });

  it('un valor inicial no válido se señala igual que si lo hubiera escrito el usuario', () => {
    pinta({ initialQuantity: '0' });
    expect(screen.getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
    expect(screen.getByText('La cantidad tiene que ser un entero positivo.')).toBeInTheDocument();
  });

  it('sin valores iniciales arranca vacío, como antes', () => {
    pinta();
    expect(screen.getByLabelText(/Cantidad solicitada/i)).toHaveValue(null);
    expect(screen.getByLabelText('Notas adicionales')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
  });
});
