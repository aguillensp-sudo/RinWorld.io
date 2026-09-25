import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvitationRow, TeamMember } from '../../lib/invitations';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · INVT-01 · pantalla (`Invitations`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no lo ve.
 *
 * Se mockean **solo** las seis funciones de `lib/invitations` que tocan red
 * (`fetchTeam`, `fetchInvitations`, `emailHasAccount`, `inviteMember`,
 * `resendInvitation`, `removeMember`). El resto del módulo —`seatsUsed`,
 * `capacityDots`, `isValidEmail`, `LIMIT_NOTICE`…— sigue siendo el de verdad:
 * mockearlo convertiría esto en una comprobación de los mocks, no de la pantalla.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe
 * `app/e2e/invitations.spec.ts`: que la lista salga de la base y no del ejemplo, y
 * que un ADMIN llegue de verdad a la pantalla desde `Configuración`. Lo que
 * escribe (invitar, reenviar, eliminar) lo mide el banco de esquema (`0037`), no
 * un test de navegador contra producción (F-188).
 */

const fetchTeam = vi.fn<(orgId: string) => Promise<TeamMember[]>>();
const fetchInvitations = vi.fn<() => Promise<InvitationRow[]>>();
const emailHasAccount = vi.fn<(email: string) => Promise<boolean>>();
const inviteMember = vi.fn<(email: string) => Promise<void>>();
const resendInvitation = vi.fn<(id: string) => Promise<void>>();
const removeMember = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../lib/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/invitations')>()),
  fetchTeam: (orgId: string) => fetchTeam(orgId),
  fetchInvitations: () => fetchInvitations(),
  emailHasAccount: (email: string) => emailHasAccount(email),
  inviteMember: (email: string) => inviteMember(email),
  resendInvitation: (id: string) => resendInvitation(id),
  removeMember: (id: string) => removeMember(id),
}));

const { Invitations } = await import('./Invitations');

const profile: MemberProfile = {
  id: 'ana',
  email: 'ana.garcia@aceroindustrial.com',
  fullName: 'Ana García Ruiz',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-1',
  orgName: 'Acero Industrial',
  orgCountry: 'ES',
};

const ANA: TeamMember = { id: 'ana', fullName: 'Ana García Ruiz', email: 'ana.garcia@aceroindustrial.com', role: 'ADMIN', state: 'ACTIVE' };
const LUIS: TeamMember = { id: 'luis', fullName: 'Luis Pérez Molina', email: 'l.perez@aceroindustrial.com', role: 'EDITOR', state: 'ACTIVE' };

const SENT = new Date(2026, 5, 24, 11, 42).toISOString();
const PENDIENTE: InvitationRow = { id: 'inv-1', email: 'carlos.m@aceroindustrial.com', status: 'Pendiente', sentAt: SENT, daysLeft: 5 };
const ACEPTADA: InvitationRow = { id: 'inv-2', email: 'l.perez@aceroindustrial.com', status: 'Aceptada', sentAt: SENT, daysLeft: null };
const EXPIRADA: InvitationRow = { id: 'inv-3', email: 'm.sanchez@aceroindustrial.com', status: 'Expirada', sentAt: SENT, daysLeft: null };

const TEAM = [ANA, LUIS];
const INVS = [PENDIENTE, ACEPTADA, EXPIRADA];

const REGISTRADA =
  'Invitación registrada. El envío del correo de invitación llega con el flujo de registro por invitación.';

async function mountLoaded(over: Partial<{ profile: MemberProfile }> = {}) {
  const view = render(<Invitations profile={over.profile ?? profile} />);
  await screen.findByRole('heading', { level: 1, name: 'Gestión de invitaciones' });
  return view;
}

const campo = () => screen.getByRole('textbox', { name: 'Email del nuevo usuario' });
const enviar = () => screen.getByRole('button', { name: 'Enviar invitación' });

beforeEach(() => {
  for (const m of [fetchTeam, fetchInvitations, emailHasAccount, inviteMember, resendInvitation, removeMember]) m.mockReset();
  fetchTeam.mockResolvedValue(TEAM);
  fetchInvitations.mockResolvedValue(INVS);
  emailHasAccount.mockResolvedValue(false);
  inviteMember.mockResolvedValue(undefined);
  resendInvitation.mockResolvedValue(undefined);
  removeMember.mockResolvedValue(undefined);
});

describe('INVT-01 · Invitations · acceso y carga', () => {
  it('un EDITOR no ve la pantalla: solo el aviso, y no se pide nada a la red', () => {
    render(<Invitations profile={{ ...profile, role: 'EDITOR' }} />);
    expect(screen.getByText('Esta pantalla es solo para administradores.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(fetchTeam).not.toHaveBeenCalled();
    expect(fetchInvitations).not.toHaveBeenCalled();
  });

  it('mientras llegan los datos dice «Cargando invitaciones…» en una región de estado', () => {
    fetchTeam.mockReturnValue(new Promise(() => {}));
    render(<Invitations profile={profile} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando invitaciones…');
  });

  it('pide los usuarios de SU organización y las invitaciones', async () => {
    await mountLoaded();
    expect(fetchTeam).toHaveBeenCalledWith('org-1');
    expect(fetchInvitations).toHaveBeenCalledTimes(1);
  });

  it('un fallo de carga se dice en una alerta con el motivo; no se pinta ninguna tabla', async () => {
    fetchTeam.mockRejectedValue(new Error('Fallo de red'));
    render(<Invitations profile={profile} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo de red');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('INVT-01 · Invitations · la cabecera y la capacidad', () => {
  it('eyebrow, título y subtítulo', async () => {
    await mountLoaded();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
    expect(screen.getByText(/Cada nuevo usuario se incorporará con rol/)).toBeInTheDocument();
    expect(screen.getByText(/Límite: 5 usuarios por organización\./)).toBeInTheDocument();
  });

  it('el ejemplo del diseño: 2 usuarios y 1 pendiente = «2/5», con el detalle', async () => {
    await mountLoaded();
    expect(screen.getByTestId('capacity-count')).toHaveTextContent('2/5');
    expect(screen.getByTestId('capacity-detail')).toHaveTextContent('· 1 invitación pendiente · 2 plazas libres');
  });

  it('cinco puntos, con su nombre: usuario, pendiente y libre, en ese orden', async () => {
    await mountLoaded();
    const puntos = within(screen.getByTestId('capacity-dots')).getAllByTitle(/.+/);
    expect(puntos.map((p) => p.getAttribute('title'))).toEqual([
      'Usuario activo',
      'Usuario activo',
      'Invitación pendiente',
      'Plaza libre',
      'Plaza libre',
    ]);
  });

  it('con plazas libres no sale el aviso de límite y el formulario está habilitado', async () => {
    await mountLoaded();
    expect(screen.queryByText(/ha alcanzado el límite de 5 usuarios/)).toBeNull();
    expect(campo()).toBeEnabled();
  });

  it('con 5 entre usuarios y pendientes sale el aviso de límite y el formulario se deshabilita', async () => {
    fetchTeam.mockResolvedValue([ANA, LUIS, { ...LUIS, id: 'u3' }, { ...LUIS, id: 'u4' }]);
    await mountLoaded();
    expect(
      screen.getByText(
        'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes. Para añadir uno nuevo, elimina un usuario o espera a que caduque una invitación.',
      ),
    ).toBeInTheDocument();
    expect(campo()).toBeDisabled();
    expect(enviar()).toBeDisabled();
  });
});

describe('INVT-01 · Invitations · las dos tablas', () => {
  it('«Invitaciones enviadas»: email, estado, fecha, expira en y acciones', async () => {
    await mountLoaded();
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    for (const cabecera of ['Email', 'Estado', 'Fecha de envío', 'Expira en', 'Acciones']) {
      expect(within(tabla).getByRole('columnheader', { name: cabecera })).toBeInTheDocument();
    }
    const fila = within(tabla).getByRole('row', { name: /carlos\.m@aceroindustrial\.com/ });
    expect(within(fila).getByText('Pendiente')).toBeInTheDocument();
    expect(within(fila).getByText('24 jun 2026 · 11:42')).toBeInTheDocument();
    expect(within(fila).getByText('5 días')).toBeInTheDocument();
  });

  it('solo la fila EXPIRADA lleva «Reenviar»; la pendiente y la aceptada no', async () => {
    await mountLoaded();
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    expect(within(tabla).getAllByRole('button')).toHaveLength(1);
    expect(within(tabla).getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' })).toBeInTheDocument();
  });

  it('sin invitaciones lo dice, dentro de la propia tabla', async () => {
    fetchInvitations.mockResolvedValue([]);
    await mountLoaded();
    const tabla = screen.getByRole('table', { name: 'Invitaciones enviadas' });
    expect(within(tabla).getByText('Todavía no has enviado ninguna invitación.')).toBeInTheDocument();
  });

  it('«Usuarios activos»: nombre, email, rol, estado y acciones', async () => {
    await mountLoaded();
    const tabla = screen.getByRole('table', { name: 'Usuarios activos' });
    for (const cabecera of ['Nombre', 'Email', 'Rol', 'Estado', 'Acciones']) {
      expect(within(tabla).getByRole('columnheader', { name: cabecera })).toBeInTheDocument();
    }
    const luis = within(tabla).getByRole('row', { name: /Luis Pérez Molina/ });
    expect(within(luis).getByText('Editor')).toBeInTheDocument();
    expect(within(luis).getByText('Activo')).toBeInTheDocument();
    const ana = within(tabla).getByRole('row', { name: /Ana García Ruiz/ });
    expect(within(ana).getByText('Admin')).toBeInTheDocument();
  });

  it('el propio administrador NO lleva «Eliminar»: un guion con su motivo', async () => {
    await mountLoaded();
    const ana = within(screen.getByRole('table', { name: 'Usuarios activos' })).getByRole('row', { name: /Ana García Ruiz/ });
    expect(within(ana).queryByRole('button')).toBeNull();
    expect(within(ana).getByTitle('No se puede eliminar al propio administrador')).toHaveTextContent('—');
  });
});

describe('INVT-01 · Invitations · invitar', () => {
  it('el botón «Enviar invitación» está deshabilitado con el campo vacío y con un email sin forma de email', async () => {
    await mountLoaded();
    expect(enviar()).toBeDisabled();
    await userEvent.setup().type(campo(), 'no-es-un-email');
    expect(enviar()).toBeDisabled();
    expect(emailHasAccount).not.toHaveBeenCalled();
  });

  it('con un email válido pregunta si ya tiene cuenta y, si no, habilita el envío', async () => {
    await mountLoaded();
    await userEvent.setup().type(campo(), 'nuevo@empresa.test');
    await waitFor(() => expect(emailHasAccount).toHaveBeenCalledWith('nuevo@empresa.test'));
    await waitFor(() => expect(enviar()).toBeEnabled());
  });

  it('si el email ya tiene cuenta, lo dice en una alerta y bloquea el envío', async () => {
    emailHasAccount.mockResolvedValue(true);
    await mountLoaded();
    await userEvent.setup().type(campo(), 'l.perez@aceroindustrial.com');
    expect(await screen.findByText('Este email ya tiene cuenta en Bearingworld.io.')).toBeInTheDocument();
    expect(enviar()).toBeDisabled();
  });

  it('enviar invita, dice que se ha REGISTRADO (sin afirmar ningún correo), vacía el campo y recarga las listas', async () => {
    const user = userEvent.setup();
    await mountLoaded();
    await user.type(campo(), 'nuevo@empresa.test');
    await waitFor(() => expect(enviar()).toBeEnabled());
    await user.click(enviar());

    expect(inviteMember).toHaveBeenCalledTimes(1);
    expect(inviteMember).toHaveBeenCalledWith('nuevo@empresa.test');
    expect(await screen.findByText(REGISTRADA)).toBeInTheDocument();
    expect(campo()).toHaveValue('');
    await waitFor(() => expect(fetchInvitations).toHaveBeenCalledTimes(2));
    expect(fetchTeam).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toMatch(/recibirá un email/);
  });

  it('si el servidor lo rechaza, dice el motivo en una alerta y NO vacía el campo', async () => {
    inviteMember.mockRejectedValue(new Error('Ya hay una invitación pendiente para este email.'));
    const user = userEvent.setup();
    await mountLoaded();
    await user.type(campo(), 'carlos.m@aceroindustrial.com');
    await waitFor(() => expect(enviar()).toBeEnabled());
    await user.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una invitación pendiente para este email.');
    expect(campo()).toHaveValue('carlos.m@aceroindustrial.com');
  });
});

describe('INVT-01 · Invitations · reenviar', () => {
  it('«Reenviar» renueva la invitación expirada, lo confirma y recarga', async () => {
    const user = userEvent.setup();
    await mountLoaded();
    await user.click(screen.getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' }));
    expect(resendInvitation).toHaveBeenCalledTimes(1);
    expect(resendInvitation).toHaveBeenCalledWith('inv-3');
    expect(await screen.findByText('Invitación reenviada.')).toBeInTheDocument();
    await waitFor(() => expect(fetchInvitations).toHaveBeenCalledTimes(2));
  });

  it('si el servidor lo rechaza (límite lleno, por ejemplo) dice el motivo en una alerta', async () => {
    resendInvitation.mockRejectedValue(new Error('Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes.'));
    await mountLoaded();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('alcanzado el límite de 5 usuarios');
  });
});

describe('INVT-01 · Invitations · eliminar un usuario', () => {
  it('«Eliminar» abre la confirmación con el texto de irreversibilidad, y no borra nada todavía', async () => {
    await mountLoaded();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar usuario' });
    expect(within(dialogo).getByText('Esta acción es irreversible. El usuario perderá acceso inmediatamente.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Luis Pérez Molina')).toBeInTheDocument();
    expect(within(dialogo).getByText('l.perez@aceroindustrial.com')).toBeInTheDocument();
    expect(removeMember).not.toHaveBeenCalled();
  });

  it('«Cancelar» cierra la confirmación sin eliminar', async () => {
    const user = userEvent.setup();
    await mountLoaded();
    await user.click(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Eliminar usuario' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(removeMember).not.toHaveBeenCalled();
  });

  it('confirmar elimina a ESE usuario, cierra la confirmación y recarga las listas', async () => {
    const user = userEvent.setup();
    await mountLoaded();
    await user.click(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Eliminar usuario' })).getByRole('button', { name: 'Eliminar' }));
    expect(removeMember).toHaveBeenCalledTimes(1);
    expect(removeMember).toHaveBeenCalledWith('luis');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(fetchTeam).toHaveBeenCalledTimes(2));
  });

  it('si el servidor lo rechaza, la confirmación SIGUE abierta y dice el motivo', async () => {
    removeMember.mockRejectedValue(new Error('Ese usuario ya no tiene acceso.'));
    const user = userEvent.setup();
    await mountLoaded();
    await user.click(screen.getByRole('button', { name: 'Eliminar Luis Pérez Molina' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar usuario' });
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Ese usuario ya no tiene acceso.');
    expect(screen.getByRole('dialog', { name: 'Eliminar usuario' })).toBeInTheDocument();
  });
});
