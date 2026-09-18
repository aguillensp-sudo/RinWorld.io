import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

function Controlled({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      placeholder="Buscar..."
      inputLabel="Buscar"
      submitLabel="Buscar"
    />
  );
}

describe('SearchField', () => {
  it('la "x" no existe con el campo vacío', () => {
    render(<Controlled onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
  });

  it('en cuanto se escribe un carácter aparece la "x", y borra el campo sin disparar la búsqueda', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Controlled onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Buscar...'), 'A');
    const limpiar = await screen.findByRole('button', { name: 'Borrar búsqueda' });

    await user.click(limpiar);

    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter y la lupa disparan onSubmit; teclear por sí solo no', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Controlled onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Buscar...'), 'Acme');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
