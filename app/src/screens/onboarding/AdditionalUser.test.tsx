import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · FRU · Registro de usuario adicional (`AdditionalUser`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no
 * lo ve. Se mockean **solo** las dos funciones de red: `emailHasAccount` (de
 * `lib/invitations`) y `registerAdditionalMember` (de `lib/onboarding`). La validación
 * (`isValidName`, `isValidPassword`, `canRegister`, los textos de ayuda…) es la de
 * verdad.
 *
 * Los textos son los del HTML aprobado, que manda sobre la spec (`F-170`): la
 * comprobación del email dice `Email disponible.` / `Este email ya está registrado en
 * la plataforma.`, y el éxito ofrece `Añadir otro usuario` e `Ir al panel`.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/onboarding.spec.ts`:
 * que la comprobación del email consulte de verdad la base, y que un ADMIN llegue a
 * la pantalla. Lo que ESCRIBE (crear la cuenta) lo mide la Edge Function y el banco
 * de esquema (`0038`), no un navegador contra producción (F-188).
 */

const emailHasAccount = vi.fn<(email: string) => Promise<boolean>>();
const registerAdditionalMember = vi.fn<(input: { fullName: string; email: string; password: string }) => Promise<void>>();

vi.mock('../../lib/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/invitations')>()),
  emailHasAccount: (email: string) => emailHasAccount(email),
}));
vi.mock('../../lib/onboarding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/onboarding')>()),
  registerAdditionalMember: (input: { fullName: string; email: string; password: string }) =>
    registerAdditionalMember(input),
}));

const { AdditionalUser } = await import('./AdditionalUser');

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

const onGoToPanel = vi.fn<() => Promise<void>>();

const NOMBRE = 'María López García';
const EMAIL = 'maria.lopez@rodamientosdelsur.es';
const PASS = 'Abcdefghi1!';

const nombre = () => screen.getByRole('textbox', { name: 'Nombre completo' });
const email = () => screen.getByRole('textbox', { name: 'Email' });
const pass = () => screen.getByLabelText('Contraseña', { exact: true });
const repite = () => screen.getByLabelText('Repetir contraseña', { exact: true });
const terminos = () => screen.getByRole('checkbox', { name: /Acepto los Términos y Condiciones/ });
const registrar = () => screen.getByRole('button', { name: 'Registrar usuario' });

function mount() {
  return render(<AdditionalUser profile={profile} onGoToPanel={onGoToPanel} />);
}

async function rellenar(over: Partial<{ nombre: string; email: string; pass: string; repite: string; tc: boolean }> = {}) {
  await userEvent.type(nombre(), over.nombre ?? NOMBRE);
  await userEvent.type(email(), over.email ?? EMAIL);
  await userEvent.type(pass(), over.pass ?? PASS);
  await userEvent.type(repite(), over.repite ?? PASS);
  if (over.tc ?? true) await userEvent.click(terminos());
}

beforeEach(() => {
  emailHasAccount.mockReset();
  registerAdditionalMember.mockReset();
  onGoToPanel.mockReset();
  emailHasAccount.mockResolvedValue(false);
  registerAdditionalMember.mockResolvedValue(undefined);
  onGoToPanel.mockResolvedValue(undefined);
});

describe('FRU · AdditionalUser · lo que se ve al entrar', () => {
  it('eyebrow, título y subtítulo con la organización destacada', () => {
    mount();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Registro de usuario adicional' })).toBeInTheDocument();
    expect(
      screen.getByText(/Completa los datos del nuevo miembro/, { selector: 'p' }),
    ).toHaveTextContent(
      'Completa los datos del nuevo miembro. Tendrá acceso inmediato a la cuenta de Rodamientos del Sur SL.',
    );
    expect(screen.getByText('Rodamientos del Sur SL', { selector: 'strong' })).toBeInTheDocument();
  });

  it('avisa de que el rol es Editor y no se elige (no hay selector de rol)', () => {
    mount();
    expect(screen.getByText(/Se registrará con rol/)).toHaveTextContent('Se registrará con rol Editor — asignado automáticamente');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('el formulario no lleva NINGÚN campo de organización', () => {
    mount();
    expect(screen.queryByLabelText(/organizaci[oó]n|empresa|NIF|pa[ií]s/i)).toBeNull();
  });

  it('los cinco campos y el botón: deshabilitado hasta que todo sea válido', () => {
    mount();
    expect(nombre()).toBeInTheDocument();
    expect(email()).toBeInTheDocument();
    expect(pass()).toHaveAttribute('type', 'password');
    expect(repite()).toHaveAttribute('type', 'password');
    expect(terminos()).not.toBeChecked();
    expect(registrar()).toBeDisabled();
  });

  it('la ayuda de la contraseña está siempre a la vista', () => {
    mount();
    expect(screen.getByText('Mínimo 10 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.')).toBeInTheDocument();
  });

  it('los enlaces de Términos y Condiciones no navegan a ninguna parte (no hay página)', () => {
    mount();
    const enlace = screen.getByText('Términos y Condiciones');
    expect(enlace.closest('a')?.getAttribute('href') ?? '#').toMatch(/^#?$/);
  });
});

describe('FRU · AdditionalUser · validación en línea', () => {
  it('un nombre de un solo carácter enseña «Introduce al menos 2 caracteres.»; con dos, desaparece', async () => {
    mount();
    expect(screen.queryByText('Introduce al menos 2 caracteres.')).toBeNull();
    await userEvent.type(nombre(), 'M');
    expect(screen.getByText('Introduce al menos 2 caracteres.')).toBeInTheDocument();
    await userEvent.type(nombre(), 'a');
    expect(screen.queryByText('Introduce al menos 2 caracteres.')).toBeNull();
  });

  it('un email mal formado enseña «Introduce un email válido.» y NO consulta a la base', async () => {
    mount();
    await userEvent.type(email(), 'esto no');
    expect(screen.getByText('Introduce un email válido.')).toBeInTheDocument();
    expect(emailHasAccount).not.toHaveBeenCalled();
  });

  it('una contraseña floja enseña «La contraseña no cumple los requisitos mínimos.»', async () => {
    mount();
    await userEvent.type(pass(), 'abc');
    expect(screen.getByText('La contraseña no cumple los requisitos mínimos.')).toBeInTheDocument();
    await userEvent.clear(pass());
    await userEvent.type(pass(), PASS);
    expect(screen.queryByText('La contraseña no cumple los requisitos mínimos.')).toBeNull();
  });

  it('«Las contraseñas no coinciden.» solo mientras difieren', async () => {
    mount();
    await userEvent.type(pass(), PASS);
    await userEvent.type(repite(), 'Otra1234567!');
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    await userEvent.clear(repite());
    await userEvent.type(repite(), PASS);
    expect(screen.queryByText('Las contraseñas no coinciden.')).toBeNull();
  });
});

describe('FRU · AdditionalUser · comprobación del email en tiempo real', () => {
  it('un email válido se consulta, dice «Verificando disponibilidad…» mientras espera y «Email disponible.» al volver', async () => {
    let resolver: (v: boolean) => void = () => {};
    emailHasAccount.mockReturnValue(new Promise<boolean>((resolve) => (resolver = resolve)));
    mount();
    await userEvent.type(email(), EMAIL);
    expect(emailHasAccount).toHaveBeenLastCalledWith(EMAIL);
    expect(screen.getByText('Verificando disponibilidad…')).toBeInTheDocument();
    resolver(false);
    expect(await screen.findByText('Email disponible.')).toBeInTheDocument();
    expect(screen.queryByText('Verificando disponibilidad…')).toBeNull();
  });

  it('un email que ya tiene cuenta dice «Este email ya está registrado en la plataforma.» y bloquea el envío', async () => {
    emailHasAccount.mockResolvedValue(true);
    mount();
    await rellenar();
    expect(await screen.findByText('Este email ya está registrado en la plataforma.')).toBeInTheDocument();
    expect(registrar()).toBeDisabled();
  });

  it('una respuesta TARDÍA de un texto que ya no es el del campo se descarta', async () => {
    const resolvers: Array<(v: boolean) => void> = [];
    emailHasAccount.mockImplementation(() => new Promise<boolean>((resolve) => resolvers.push(resolve)));
    mount();
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(email(), 'm');
    // La primera consulta (a@b.co) responde «ya existe» cuando el campo ya dice a@b.com.
    resolvers[0]?.(true);
    await waitFor(() => expect(screen.queryByText('Este email ya está registrado en la plataforma.')).toBeNull());
  });

  it('si la comprobación falla no se dice nada de «ya registrado» y el envío sigue disponible (decide el servidor)', async () => {
    emailHasAccount.mockRejectedValue(new Error('sin red'));
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    expect(screen.queryByText('Este email ya está registrado en la plataforma.')).toBeNull();
  });
});

describe('FRU · AdditionalUser · habilitar el envío', () => {
  it('con todo válido y T&C marcado se habilita', async () => {
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
  });

  it('sin T&C se queda deshabilitado', async () => {
    mount();
    await rellenar({ tc: false });
    await waitFor(() => expect(emailHasAccount).toHaveBeenCalled());
    expect(registrar()).toBeDisabled();
  });

  it('con las contraseñas distintas se queda deshabilitado', async () => {
    mount();
    await rellenar({ repite: 'Otra1234567!' });
    expect(registrar()).toBeDisabled();
  });
});

describe('FRU · AdditionalUser · registrar', () => {
  it('manda nombre, email y contraseña a la función y muestra el éxito con sus dos botones', async () => {
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    await userEvent.click(registrar());
    expect(registerAdditionalMember).toHaveBeenCalledTimes(1);
    expect(registerAdditionalMember).toHaveBeenCalledWith({ fullName: NOMBRE, email: EMAIL, password: PASS });
    expect(await screen.findByText('Usuario registrado correctamente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir otro usuario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al panel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar usuario' })).toBeNull();
  });

  it('mientras se registra el botón está deshabilitado (no se crea dos veces la cuenta)', async () => {
    let resolver: () => void = () => {};
    registerAdditionalMember.mockReturnValue(new Promise<void>((resolve) => (resolver = resolve)));
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    await userEvent.click(registrar());
    expect(registrar()).toBeDisabled();
    resolver();
    await screen.findByText('Usuario registrado correctamente.');
    expect(registerAdditionalMember).toHaveBeenCalledTimes(1);
  });

  it('si la función rechaza se dice el MOTIVO en una alerta y el formulario NO se vacía', async () => {
    registerAdditionalMember.mockRejectedValue(new Error('Tu organización ha alcanzado el límite de 5 usuarios.'));
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    await userEvent.click(registrar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu organización ha alcanzado el límite de 5 usuarios.');
    expect(nombre()).toHaveValue(NOMBRE);
    expect(email()).toHaveValue(EMAIL);
    expect(screen.queryByText('Usuario registrado correctamente.')).toBeNull();
  });

  it('«Añadir otro usuario» vuelve al formulario VACÍO, con el botón deshabilitado', async () => {
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    await userEvent.click(registrar());
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir otro usuario' }));
    expect(nombre()).toHaveValue('');
    expect(email()).toHaveValue('');
    expect(pass()).toHaveValue('');
    expect(repite()).toHaveValue('');
    expect(terminos()).not.toBeChecked();
    expect(registrar()).toBeDisabled();
    expect(screen.queryByText('Usuario registrado correctamente.')).toBeNull();
  });

  it('«Ir al panel» llama a onGoToPanel; si rechaza, lo dice en una alerta', async () => {
    onGoToPanel.mockRejectedValueOnce(new Error('Tu cuenta no está pendiente de activación.'));
    mount();
    await rellenar();
    await waitFor(() => expect(registrar()).toBeEnabled());
    await userEvent.click(registrar());
    await userEvent.click(await screen.findByRole('button', { name: 'Ir al panel' }));
    expect(onGoToPanel).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta no está pendiente de activación.');
  });
});
