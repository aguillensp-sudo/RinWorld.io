import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvitationRow, TeamMember } from '../../lib/invitations';
import { InvitationTables } from './InvitationTables';

/**
 * CONTRATO DE ACEPTACIÓN · INVT-01 · las dos tablas (`InvitationTables`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no lo ve. Es PRESENTACIONAL: sin red y sin estado; todo llega por props y toda
 * acción sale por un callback.
 */

const SENT = new Date(2026, 5, 24, 11, 42).toISOString();

const ANA: TeamMember = { id: 'ana', fullName: 'Ana García Ruiz', email: 'ana.garcia@aceroindustrial.com', role: 'ADMIN', state: 'ACTIVE' };
const LUIS: TeamMember = { id: 'luis', fullName: 'Luis Pérez Molina', email: 'l.perez@aceroindustrial.com', role: 'EDITOR', state: 'ACTIVE' };
const SUSPENDIDO: TeamMember = { id: 'ines', fullName: 'Inés Vega', email: 'ines.vega@aceroindustrial.com', role: 'EDITOR', state: 'SUSPENDED' };

const PENDIENTE: InvitationRow = { id: 'inv-1', email: 'carlos.m@aceroindustrial.com', status: 'Pendiente', sentAt: SENT, daysLeft: 5 };
const ACEPTADA: InvitationRow = { id: 'inv-2', email: 'l.perez@aceroindustrial.com', status: 'Aceptada', sentAt: SENT, daysLeft: null };
const EXPIRADA: InvitationRow = { id: 'inv-3', email: 'm.sanchez@aceroindustrial.com', status: 'Expirada', sentAt: SENT, daysLeft: null };

function mount(over: Partial<React.ComponentProps<typeof InvitationTables>> = {}) {
  const props = {
    invitations: [PENDIENTE, ACEPTADA, EXPIRADA],
    team: [ANA, LUIS],
    selfId: 'ana',
    busy: false,
    onResend: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  };
  render(<InvitationTables {...props} />);
  return props;
}

describe('INVT-01 · InvitationTables · invitaciones', () => {
  it('un título y una tabla «Invitaciones enviadas»', () => {
    mount();
    expect(screen.getByRole('heading', { level: 2, name: 'Invitaciones enviadas' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Invitaciones enviadas' })).toBeInTheDocument();
  });

  it('pinta cada estado con su etiqueta, y la fecha y los días con su formato', () => {
    mount();
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    const pendiente = within(tabla).getByRole('row', { name: /carlos\.m@aceroindustrial\.com/ });
    expect(within(pendiente).getByText('Pendiente')).toBeInTheDocument();
    expect(within(pendiente).getByText('24 jun 2026 · 11:42')).toBeInTheDocument();
    expect(within(pendiente).getByText('5 días')).toBeInTheDocument();

    const aceptada = within(tabla).getByRole('row', { name: /l\.perez@aceroindustrial\.com/ });
    expect(within(aceptada).getByText('Aceptada')).toBeInTheDocument();

    const expirada = within(tabla).getByRole('row', { name: /m\.sanchez@aceroindustrial\.com/ });
    expect(within(expirada).getByText('Expirada')).toBeInTheDocument();
  });

  it('las celdas sin valor son un guion: «Expira en» de una aceptada y «Acciones» de una pendiente', () => {
    mount();
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    const aceptada = within(tabla).getByRole('row', { name: /l\.perez@aceroindustrial\.com/ });
    expect(within(aceptada).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(within(aceptada).queryByRole('button')).toBeNull();
    const pendiente = within(tabla).getByRole('row', { name: /carlos\.m@aceroindustrial\.com/ });
    expect(within(pendiente).queryByRole('button')).toBeNull();
  });

  it('«Reenviar» solo en la expirada, con el email en el nombre, y dispara onResend con su id', async () => {
    const props = mount();
    const boton = screen.getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' });
    await userEvent.setup().click(boton);
    expect(props.onResend).toHaveBeenCalledTimes(1);
    expect(props.onResend).toHaveBeenCalledWith('inv-3');
    expect(screen.getAllByRole('button', { name: /^Reenviar / })).toHaveLength(1);
  });

  it('sin invitaciones lo dice dentro de la tabla', () => {
    mount({ invitations: [] });
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    expect(within(tabla).getByText('Todavía no has enviado ninguna invitación.')).toBeInTheDocument();
  });

  it('con una petición en vuelo, «Reenviar» está deshabilitado', () => {
    mount({ busy: true });
    expect(screen.getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' })).toBeDisabled();
  });
});

describe('INVT-01 · InvitationTables · usuarios', () => {
  it('un título y una tabla «Usuarios activos»', () => {
    mount();
    expect(screen.getByRole('heading', { level: 2, name: 'Usuarios activos' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Usuarios activos' })).toBeInTheDocument();
  });

  it('nombre, email, rol y estado de cada usuario', () => {
    mount({ team: [ANA, LUIS, SUSPENDIDO] });
    const tabla = screen.getByRole('table', { name: 'Usuarios activos' });
    const ana = within(tabla).getByRole('row', { name: /Ana García Ruiz/ });
    expect(within(ana).getByText('ana.garcia@aceroindustrial.com')).toBeInTheDocument();
    expect(within(ana).getByText('Admin')).toBeInTheDocument();
    expect(within(ana).getByText('Activo')).toBeInTheDocument();
    const ines = within(tabla).getByRole('row', { name: /Inés Vega/ });
    expect(within(ines).getByText('Editor')).toBeInTheDocument();
    expect(within(ines).getByText('Suspendido')).toBeInTheDocument();
  });

  it('«Eliminar» con el nombre en el accesible, en cada Editor, y dispara onRemove con el MIEMBRO entero', async () => {
    const props = mount({ team: [ANA, LUIS, SUSPENDIDO] });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' }));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
    expect(props.onRemove).toHaveBeenCalledWith(LUIS);
    expect(screen.getByRole('button', { name: 'Eliminar Inés Vega' })).toBeInTheDocument();
  });

  it('el propio administrador no lleva botón: un guion con el motivo', () => {
    mount();
    const ana = within(screen.getByRole('table', { name: 'Usuarios activos' })).getByRole('row', { name: /Ana García Ruiz/ });
    expect(within(ana).queryByRole('button')).toBeNull();
    expect(within(ana).getByTitle('No se puede eliminar al propio administrador')).toHaveTextContent('—');
  });

  it('otro ADMIN que no soy yo tampoco se elimina: guion y el motivo de que solo se eliminan Editores', () => {
    const otro: TeamMember = { ...ANA, id: 'otro', fullName: 'Otra Admin', email: 'otra@aceroindustrial.com' };
    mount({ team: [ANA, otro, LUIS] });
    const fila = within(screen.getByRole('table', { name: 'Usuarios activos' })).getByRole('row', { name: /Otra Admin/ });
    expect(within(fila).queryByRole('button')).toBeNull();
    expect(within(fila).getByTitle('Solo se pueden eliminar usuarios con rol Editor')).toHaveTextContent('—');
  });

  it('con una petición en vuelo, «Eliminar» está deshabilitado', () => {
    mount({ busy: true });
    expect(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' })).toBeDisabled();
  });
});
