import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import type { PassphraseCheck } from '../../lib/passphrase';

/**
 * CONTRATO DE ACEPTACIÓN · REG-06 · Establecer la frase de seguridad (`BackupPassphrase`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no lo ve.
 * Se mockea **solo** `checkPassphrase` de `lib/passphrase` (zxcvbn y la huella de la
 * contraseña tienen sus propias pruebas en `passphrase.test.ts`); `passphraseView`, los
 * textos y los niveles siguen siendo los de verdad, porque mockearlos convertiría esto en
 * una comprobación de los mocks.
 *
 * La medida falsa: menos de 12 caracteres → 1 (Débil); `debil-pero-larga` → 2
 * (Aceptable); `LOGIN` → 4 y es la contraseña de acceso; lo demás → 4 (Muy fuerte).
 */

const LOGIN = 'Mi-Contraseña-De-Acceso-1';
const BUENA = 'correct-horse-battery-staple-2024';

const checkPassphrase = vi.fn<(email: string, p: string, ui?: readonly string[]) => Promise<PassphraseCheck>>();

vi.mock('../../lib/passphrase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/passphrase')>()),
  checkPassphrase: (email: string, p: string, ui?: readonly string[]) => checkPassphrase(email, p, ui),
}));

const { BackupPassphrase } = await import('./BackupPassphrase');

const profile: MemberProfile = {
  id: 'm-1',
  email: 'admin@julsa.es',
  fullName: 'Alberto Guillén',
  role: 'ADMIN',
  state: 'REGISTERED',
  orgId: 'org-1',
  orgName: 'JULSA INDUSTRIAL S.A',
  orgCountry: 'ES',
};

const onContinue = vi.fn<(passphrase: string) => void>();
const fetchSpy = vi.fn();

function medir(_email: string, p: string): Promise<PassphraseCheck> {
  if (p === '') return Promise.resolve({ passphrase: p, score: 0, sameAsLogin: false });
  if (p === LOGIN) return Promise.resolve({ passphrase: p, score: 4, sameAsLogin: true });
  if (p === 'debil-pero-larga') return Promise.resolve({ passphrase: p, score: 2, sameAsLogin: false });
  return Promise.resolve({ passphrase: p, score: p.length < 12 ? 1 : 4, sameAsLogin: false });
}

beforeEach(() => {
  checkPassphrase.mockReset();
  checkPassphrase.mockImplementation(medir);
  onContinue.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount() {
  return render(<BackupPassphrase profile={profile} onContinue={onContinue} />);
}

const frase = () => screen.getByLabelText('Backup passphrase');
const repetir = () => screen.getByLabelText('Repetir backup passphrase');
const casilla = () =>
  screen.getByRole('checkbox', {
    name: 'Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente.',
  });
const continuar = () => screen.getByRole('button', { name: 'Continuar' });
const nivel = () => screen.queryByTestId('strength-label');
const segmentosEncendidos = () =>
  screen.queryAllByTestId('strength-segment').filter((s) => s.getAttribute('data-on') === 'true').length;

async function rellenar(p: string, r: string, marcar = true) {
  const user = userEvent.setup();
  if (p) await user.type(frase(), p);
  if (r) await user.type(repetir(), r);
  if (marcar) await user.click(casilla());
  return user;
}

const plano = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('REG-06 · cabecera y estructura', () => {
  it('el título es el único <h1>: «Crea tu frase de seguridad»', () => {
    mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Crea tu frase de seguridad');
  });

  it('antetítulo y subtítulo literales del HTML aprobado', () => {
    mount();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Esta frase protege tu clave privada. Es diferente a tu contraseña de acceso y debes guardarla en un lugar seguro.',
      ),
    ).toBeInTheDocument();
  });

  it('los pasos del registro: cuatro, «Seguridad» es el actual (aria-current="step")', () => {
    mount();
    const lista = screen.getByRole('list', { name: 'Pasos del registro' });
    expect(lista.tagName).toBe('OL');
    const pasos = within(lista).getAllByRole('listitem');
    expect(pasos.map(plano).map((t) => t.replace(/^[✓\d]\s*/, ''))).toEqual([
      'Solicitud',
      'Organización',
      'Seguridad',
      'Activación',
    ]);
    const actuales = pasos.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(actuales).toHaveLength(1);
    expect(plano(actuales[0]!)).toMatch(/^3\s*Seguridad$/);
  });

  it('los dos campos son de contraseña, con su etiqueta, su placeholder y autocompletado de contraseña nueva', () => {
    mount();
    expect(frase()).toHaveAttribute('type', 'password');
    expect(frase()).toHaveAttribute('placeholder', 'Mín. 12 caracteres');
    expect(frase()).toHaveAttribute('autocomplete', 'new-password');
    expect(repetir()).toHaveAttribute('type', 'password');
    expect(repetir()).toHaveAttribute('placeholder', 'Repite la frase');
    expect(repetir()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('el aviso: «Anótala ahora.» en <strong>, seguido del resto', () => {
    mount();
    const fuerte = screen.getByText('Anótala ahora.');
    expect(fuerte.tagName).toBe('STRONG');
    expect(plano(fuerte.parentElement!)).toBe(
      'Anótala ahora. Si la pierdes y no tienes backup en la nube, perderás acceso a tu historial cifrado permanentemente.',
    );
  });

  it('la confirmación es un checkbox de verdad, sin marcar, con el texto exacto de la spec', () => {
    mount();
    expect(casilla()).not.toBeChecked();
  });

  it('al montar: sin barra de fortaleza, sin errores y «Continuar» deshabilitado', () => {
    mount();
    expect(nivel()).toBeNull();
    expect(screen.queryByText('Las frases no coinciden')).toBeNull();
    expect(screen.queryByText('La frase necesita ser más fuerte para continuar')).toBeNull();
    expect(continuar()).toBeDisabled();
  });

  it('todos los <svg> son decorativos (aria-hidden)', () => {
    const { container } = mount();
    for (const svg of Array.from(container.querySelectorAll('svg'))) expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('REG-06 · mostrar u ocultar la frase', () => {
  it('cada campo tiene su botón «Mostrar frase» (type="button") que alterna password ↔ text', async () => {
    mount();
    const user = userEvent.setup();
    const ojos = screen.getAllByRole('button', { name: 'Mostrar frase' });
    expect(ojos).toHaveLength(2);
    for (const ojo of ojos) expect(ojo).toHaveAttribute('type', 'button');
    await user.click(ojos[0]!);
    expect(frase()).toHaveAttribute('type', 'text');
    expect(repetir()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Ocultar frase' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ocultar frase' }));
    expect(frase()).toHaveAttribute('type', 'password');
  });

  it('mostrar la frase no envía el formulario ni avanza', async () => {
    mount();
    await rellenar(BUENA, BUENA);
    await userEvent.click(screen.getAllByRole('button', { name: 'Mostrar frase' })[0]!);
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('REG-06 · la fortaleza', () => {
  it('mide la frase con el email del perfil y su nombre y organización como datos del usuario', async () => {
    mount();
    await userEvent.type(frase(), 'abc');
    await waitFor(() => expect(checkPassphrase).toHaveBeenLastCalledWith('admin@julsa.es', 'abc', expect.anything()));
    const ui = checkPassphrase.mock.lastCall?.[2] ?? [];
    expect(ui).toEqual(expect.arrayContaining(['Alberto Guillén', 'JULSA INDUSTRIAL S.A']));
  });

  it('una frase fuerte: «Muy fuerte» con los cinco segmentos encendidos', async () => {
    mount();
    await userEvent.type(frase(), BUENA);
    await waitFor(() => expect(nivel()).toHaveTextContent('Muy fuerte'));
    expect(screen.getAllByTestId('strength-segment')).toHaveLength(5);
    expect(segmentosEncendidos()).toBe(5);
    expect(screen.queryByText('La frase necesita ser más fuerte para continuar')).toBeNull();
  });

  it('una frase corta: «Débil», dos segmentos y el error de «más fuerte»', async () => {
    mount();
    await userEvent.type(frase(), 'corta');
    await waitFor(() => expect(nivel()).toHaveTextContent('Débil'));
    expect(segmentosEncendidos()).toBe(2);
    expect(screen.getByText('La frase necesita ser más fuerte para continuar')).toBeInTheDocument();
    expect(frase()).toHaveAttribute('aria-invalid', 'true');
  });

  it('«Aceptable» no basta: el error sigue y el botón también deshabilitado', async () => {
    mount();
    await rellenar('debil-pero-larga', 'debil-pero-larga');
    await waitFor(() => expect(nivel()).toHaveTextContent('Aceptable'));
    expect(segmentosEncendidos()).toBe(3);
    expect(screen.getByText('La frase necesita ser más fuerte para continuar')).toBeInTheDocument();
    expect(continuar()).toBeDisabled();
  });

  it('borrar el campo quita la barra y el error', async () => {
    mount();
    const user = userEvent.setup();
    await user.type(frase(), 'corta');
    await waitFor(() => expect(nivel()).not.toBeNull());
    await user.clear(frase());
    await waitFor(() => expect(nivel()).toBeNull());
    expect(screen.queryByText('La frase necesita ser más fuerte para continuar')).toBeNull();
  });

  it('una medida que llega tarde (de una pulsación anterior) no pisa la de la frase actual', async () => {
    let soltarVieja: (v: PassphraseCheck) => void = () => {};
    checkPassphrase.mockImplementation((email, p) => {
      if (p === 'cor') return new Promise((r) => (soltarVieja = r));
      return medir(email, p);
    });
    mount();
    await userEvent.type(frase(), 'cor');
    await userEvent.type(frase(), 'rect-horse-battery-staple-2024');
    await waitFor(() => expect(nivel()).toHaveTextContent('Muy fuerte'));
    soltarVieja({ passphrase: 'cor', score: 0, sameAsLogin: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(nivel()).toHaveTextContent('Muy fuerte');
  });
});

describe('REG-06 · los errores', () => {
  it('la contraseña de acceso: su error, en vez del de «más fuerte», y sin botón', async () => {
    mount();
    await rellenar(LOGIN, LOGIN);
    await waitFor(() =>
      expect(screen.getByText('La frase de seguridad debe ser diferente a tu contraseña de acceso')).toBeInTheDocument(),
    );
    expect(screen.queryByText('La frase necesita ser más fuerte para continuar')).toBeNull();
    expect(continuar()).toBeDisabled();
  });

  it('no coinciden: «Las frases no coinciden» bajo el campo 2, que queda aria-invalid', async () => {
    mount();
    await rellenar(BUENA, BUENA + 'x');
    expect(await screen.findByText('Las frases no coinciden')).toBeInTheDocument();
    expect(repetir()).toHaveAttribute('aria-invalid', 'true');
    expect(continuar()).toBeDisabled();
  });

  it('el error de «no coinciden» no sale mientras el campo 2 está vacío', async () => {
    mount();
    await rellenar(BUENA, '', false);
    await waitFor(() => expect(nivel()).toHaveTextContent('Muy fuerte'));
    expect(screen.queryByText('Las frases no coinciden')).toBeNull();
  });

  it('los errores van enlazados a su campo con aria-describedby', async () => {
    mount();
    await rellenar('corta', 'otra');
    const err1 = await screen.findByText('La frase necesita ser más fuerte para continuar');
    const err2 = screen.getByText('Las frases no coinciden');
    expect(err1.id).not.toBe('');
    expect(err2.id).not.toBe('');
    expect(frase().getAttribute('aria-describedby') ?? '').toContain(err1.id);
    expect(repetir().getAttribute('aria-describedby') ?? '').toContain(err2.id);
  });
});

describe('REG-06 · continuar', () => {
  it('fuerte + coinciden + casilla: «Continuar» se habilita', async () => {
    mount();
    await rellenar(BUENA, BUENA);
    await waitFor(() => expect(continuar()).toBeEnabled());
  });

  it('sin la casilla, no', async () => {
    mount();
    await rellenar(BUENA, BUENA, false);
    await waitFor(() => expect(nivel()).toHaveTextContent('Muy fuerte'));
    expect(continuar()).toBeDisabled();
  });

  it('pulsar «Continuar» entrega la frase EXACTA al wiring, una sola vez', async () => {
    mount();
    const user = await rellenar(BUENA, BUENA);
    await waitFor(() => expect(continuar()).toBeEnabled());
    await user.click(continuar());
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith(BUENA);
  });

  it('Enter en el último campo también continúa (es un formulario), y solo si vale', async () => {
    mount();
    const user = userEvent.setup();
    await user.type(frase(), BUENA);
    await user.click(casilla());
    await user.type(repetir(), BUENA + '{Enter}');
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(BUENA));
    onContinue.mockReset();
    await user.type(repetir(), 'x{Enter}');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('la frase no se pinta en ningún sitio fuera de los campos', async () => {
    const { container } = mount();
    await rellenar(BUENA, BUENA);
    await waitFor(() => expect(continuar()).toBeEnabled());
    expect(container.textContent ?? '').not.toContain(BUENA);
  });

  it('no llama a la red: la frase no sale del navegador (ADR-001)', async () => {
    mount();
    const user = await rellenar(BUENA, BUENA);
    await waitFor(() => expect(continuar()).toBeEnabled());
    await user.click(continuar());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
