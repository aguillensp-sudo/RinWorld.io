import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotAvailable } from './NotAvailable';

describe('NotAvailable', () => {
  it('dice el nombre del ítem y que todavía no está disponible', () => {
    render(<NotAvailable section="Contacto" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Contacto' })).toBeInTheDocument();
    expect(screen.getByText('Esta sección todavía no está disponible.')).toBeInTheDocument();
  });
});
