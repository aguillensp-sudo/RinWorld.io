import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · REG-09 · Bienvenida (`Welcome`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no
 * lo ve. Se mockea **solo** `fetchSeatsUsed` de `lib/onboarding`; el resto del módulo
 * (`welcomeView`, `firstName`, los textos del límite…) sigue siendo el de verdad,
 * porque mockearlo convertiría esto en una comprobación de los mocks.
 *
 * Los textos son los del HTML aprobado, que manda sobre la spec (`F-170`): el botón es
 * `Ir al panel` y no `No, ir al panel`, y el contador cuenta al ADMIN (con un usuario
 * añadido, `2 de 5`).
 */

const fetchSeatsUsed = vi.fn<() => Promise<number>>();

vi.mock('../../lib/onboarding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/onboarding')>()),
  fetchSeatsUsed: () => fetchSeatsUsed(),
}));

const { Welcome } = await import('./Welcome');

const profile: MemberProfile = {
  id: 'juan',
  email: 'juan.martinez@rodamientosdelsur.es',
  fullName: 'Juan Martínez',
  role: 'ADMIN',
  state: 'KEY_ACTIVE',
  orgId: 'org-1',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

const onAddUser = vi.fn<() => void>();
const onGoToPanel = vi.fn<() => Promise<void>>();

async function mount(seats: number, over: Partial<MemberProfile> = {}) {
  fetchSeatsUsed.mockResolvedValue(seats);
  const view = render(<Welcome profile={{ ...profile, ...over }} onAddUser={onAddUser} onGoToPanel={onGoToPanel} />);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

const añadir = () => screen.queryByRole('button', { name: 'Sí, añadir un usuario ahora' });
const alPanel = () => screen.getByRole('button', { name: 'Ir al panel' });

beforeEach(() => {
  fetchSeatsUsed.mockReset();
  onAddUser.mockReset();
  onGoToPanel.mockReset();
  onGoToPanel.mockResolvedValue(undefined);
});

describe('REG-09 · Welcome · carga', () => {
  it('mientras llegan las plazas dice «Cargando…» en una región de estado y no pinta el título', () => {
    fetchSeatsUsed.mockReturnValue(new Promise(() => {}));
    render(<Welcome profile={profile} onAddUser={onAddUser} onGoToPanel={onGoToPanel} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('un fallo de carga se dice en una alerta con el motivo; no se pintan botones', async () => {
    fetchSeatsUsed.mockRejectedValue(new Error('Solo el administrador de la organización puede consultar sus plazas.'));
    render(<Welcome profile={profile} onAddUser={onAddUser} onGoToPanel={onGoToPanel} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador de la organización puede consultar sus plazas.');
    expect(screen.queryByRole('button', { name: 'Ir al panel' })).toBeNull();
  });

  it('pide las plazas una sola vez', async () => {
    await mount(1);
    expect(fetchSeatsUsed).toHaveBeenCalledTimes(1);
  });
});

describe('REG-09 · Welcome · solo el ADMIN (1 plaza)', () => {
  it('título con el primer nombre, subtítulo con la organización y sin contador', async () => {
    await mount(1);
    expect(screen.getByRole('heading', { level: 1, name: '¡Bienvenido a Bearingworld.io, Juan!' })).toBeInTheDocument();
    expect(
      screen.getByText(/Tu organización/, { selector: 'p' }),
    ).toHaveTextContent(
      'Tu organización Rodamientos del Sur SL ya está activa. Antes de ir al panel, ¿quieres registrar más usuarios de tu equipo?',
    );
    expect(screen.queryByTestId('user-counter')).toBeNull();
  });

  it('la organización va destacada (strong) dentro del subtítulo', async () => {
    await mount(1);
    expect(screen.getByText('Rodamientos del Sur SL', { selector: 'strong' })).toBeInTheDocument();
  });

  it('sin nombre completo saluda con lo que hay antes de la arroba del email', async () => {
    await mount(1, { fullName: null });
    expect(screen.getByRole('heading', { level: 1, name: '¡Bienvenido a Bearingworld.io, juan.martinez!' })).toBeInTheDocument();
  });

  it('pregunta «¿Deseas añadir usuarios ahora?» y ofrece los dos botones', async () => {
    await mount(1);
    expect(screen.getByText('¿Deseas añadir usuarios ahora?')).toBeInTheDocument();
    expect(añadir()).toBeEnabled();
    expect(alPanel()).toBeEnabled();
  });

  it('lleva la nota sobre Configuración → Gestión de usuarios', async () => {
    await mount(1);
    expect(
      screen.getByText(/Podrás invitar más usuarios desde/, { selector: 'p, div, span' }),
    ).toHaveTextContent('Podrás invitar más usuarios desde Configuración → Gestión de usuarios en cualquier momento.');
  });

  it('muestra los cuatro pasos del registro, todos completados', async () => {
    await mount(1);
    const pasos = screen.getByRole('list', { name: 'Pasos del registro' });
    const items = within(pasos).getAllByRole('listitem');
    expect(items.map((i) => i.textContent?.replace('✓', '').trim())).toEqual([
      'Solicitud',
      'Organización',
      'Seguridad',
      'Activación',
    ]);
  });
});

describe('REG-09 · Welcome · con usuarios ya añadidos', () => {
  it('con 2 plazas: «¿Quieres añadir otro usuario?», contador 2 de 5 y sigue el botón de añadir', async () => {
    await mount(2);
    expect(screen.getByRole('heading', { level: 1, name: '¿Quieres añadir otro usuario?' })).toBeInTheDocument();
    expect(screen.getByTestId('user-counter')).toHaveTextContent('2 de 5 usuarios registrados');
    expect(screen.getByText('¿Deseas añadir otro usuario?')).toBeInTheDocument();
    expect(añadir()).toBeInTheDocument();
  });

  it('con 4 plazas todavía cabe uno más', async () => {
    await mount(4);
    expect(screen.getByTestId('user-counter')).toHaveTextContent('4 de 5 usuarios registrados');
    expect(añadir()).toBeInTheDocument();
  });
});

describe('REG-09 · Welcome · límite alcanzado', () => {
  it('con 5: «¡Equipo al completo!», el motivo OBLIGATORIO y solo el botón de ir al panel', async () => {
    await mount(5);
    expect(screen.getByRole('heading', { level: 1, name: '¡Equipo al completo!' })).toBeInTheDocument();
    expect(screen.getByText('Has alcanzado el límite de 5 usuarios por organización.')).toBeInTheDocument();
    expect(screen.getByTestId('user-counter')).toHaveTextContent('5 de 5 usuarios registrados');
    expect(añadir()).toBeNull();
    expect(alPanel()).toBeEnabled();
  });
});

describe('REG-09 · Welcome · acciones', () => {
  it('«Sí, añadir un usuario ahora» avisa al wiring y no activa la cuenta', async () => {
    await mount(1);
    await userEvent.click(añadir()!);
    expect(onAddUser).toHaveBeenCalledTimes(1);
    expect(onGoToPanel).not.toHaveBeenCalled();
  });

  it('«Ir al panel» llama a onGoToPanel una vez', async () => {
    await mount(1);
    await userEvent.click(alPanel());
    expect(onGoToPanel).toHaveBeenCalledTimes(1);
    expect(onAddUser).not.toHaveBeenCalled();
  });

  it('mientras la activación está en vuelo los dos botones están deshabilitados (no se activa dos veces)', async () => {
    let resolver: () => void = () => {};
    onGoToPanel.mockReturnValue(new Promise<void>((resolve) => (resolver = resolve)));
    await mount(2);
    await userEvent.click(alPanel());
    expect(alPanel()).toBeDisabled();
    expect(añadir()).toBeDisabled();
    resolver();
    await waitFor(() => expect(alPanel()).toBeEnabled());
  });

  it('si la activación falla se dice en una alerta con el motivo y se puede reintentar', async () => {
    onGoToPanel.mockRejectedValueOnce(new Error('Tu cuenta no está pendiente de activación.'));
    await mount(1);
    await userEvent.click(alPanel());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta no está pendiente de activación.');
    expect(alPanel()).toBeEnabled();
    await userEvent.click(alPanel());
    expect(onGoToPanel).toHaveBeenCalledTimes(2);
  });
});
