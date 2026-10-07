import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import type { RecoverOutcome } from '../../lib/key-recovery';

/**
 * REC-01 · Recuperar acceso a tu historial cifrado. Escrito por Claude Code junto con la
 * pantalla (criptografía, a mano; no es contrato del arnés). Se mockea SOLO `recoverKey`:
 * su criptografía se prueba en `lib/key-recovery.test.ts`; aquí, lo que la pantalla
 * enseña y hace con cada respuesta, y que la frase no sale de ella.
 */

const recoverKey = vi.fn<(passphrase: string, memberId: string) => Promise<RecoverOutcome>>();

vi.mock('../../lib/key-recovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/key-recovery')>()),
  recoverKey: (p: string, id: string) => recoverKey(p, id),
}));

const { KeyRecovery } = await import('./KeyRecovery');

const profile: MemberProfile = {
  id: 'm-1',
  email: 'admin@julsa.es',
  fullName: 'Alberto Guillén',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-1',
  orgName: 'JULSA INDUSTRIAL S.A',
  orgCountry: 'ES',
};

const FRASE = 'tornillo ámbar cometa jilguero 42';
const onRecovered = vi.fn();
const onSkip = vi.fn();

function mount(onGenerateNew?: () => Promise<void>) {
  return render(
    <KeyRecovery
      profile={profile}
      onRecovered={onRecovered}
      onSkip={onSkip}
      {...(onGenerateNew ? { onGenerateNew } : {})}
    />,
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>, phrase = FRASE) {
  await user.type(screen.getByLabelText('Frase de seguridad'), phrase);
  await user.click(screen.getByRole('button', { name: 'Desbloquear historial' }));
}

beforeEach(() => {
  recoverKey.mockReset();
  onRecovered.mockReset();
  onSkip.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('REC-01 · el formulario', () => {
  it('pinta el título, el subtítulo y el campo de tipo password', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Recuperar acceso a tu historial cifrado' })).toBeTruthy();
    expect(screen.getByText(/descifrar tu clave privada/)).toBeTruthy();
    expect(screen.getByLabelText('Frase de seguridad').getAttribute('type')).toBe('password');
  });

  it('el botón está deshabilitado con el campo vacío', () => {
    mount();
    expect((screen.getByRole('button', { name: 'Desbloquear historial' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('no enseña el contador de intentos antes de fallar', () => {
    mount();
    expect(screen.queryByTestId('attempts')).toBeNull();
  });

  it('«Ahora no» deja seguir sin la clave', async () => {
    mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ahora no, ir al panel' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('REC-01 · recuperar', () => {
  it('con la frase buena pide recuperar con el id del miembro y enseña el éxito', async () => {
    recoverKey.mockResolvedValue({ kind: 'recovered' });
    const user = userEvent.setup();
    mount();
    await submit(user);
    expect(recoverKey).toHaveBeenCalledWith(FRASE, 'm-1');
    expect(await screen.findByText('Clave descifrada. Tu historial ya es accesible.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver al panel' }));
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('con la frase mala dice «Frase incorrecta» y deja reintentar', async () => {
    recoverKey.mockResolvedValue({ kind: 'wrong', attemptsLeft: 4, lockedSeconds: 0 });
    const user = userEvent.setup();
    mount();
    await submit(user, 'mala frase');
    expect(await screen.findByText('Frase incorrecta. Compruébala e inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByLabelText('Frase de seguridad').getAttribute('aria-invalid')).toBe('true');
  });

  it('el contador aparece desde el segundo fallo: «3 de 5 intentos restantes»', async () => {
    recoverKey.mockResolvedValueOnce({ kind: 'wrong', attemptsLeft: 4, lockedSeconds: 0 });
    recoverKey.mockResolvedValueOnce({ kind: 'wrong', attemptsLeft: 3, lockedSeconds: 0 });
    const user = userEvent.setup();
    mount();
    await submit(user, 'mala 1');
    await screen.findByText(/Frase incorrecta/);
    expect(screen.queryByTestId('attempts')).toBeNull();
    await user.clear(screen.getByLabelText('Frase de seguridad'));
    await submit(user, 'mala 2');
    expect(await screen.findByText('3 de 5 intentos restantes')).toBeTruthy();
  });

  it('un fallo de red lo dice sin acusar a la frase', async () => {
    recoverKey.mockRejectedValue(new Error('red'));
    const user = userEvent.setup();
    mount();
    await submit(user);
    expect(await screen.findByText(/No hemos podido comprobar tu frase/)).toBeTruthy();
    expect(screen.queryByText(/Frase incorrecta/)).toBeNull();
  });

  it('la frase no se pinta en ningún texto de la pantalla', async () => {
    recoverKey.mockResolvedValue({ kind: 'wrong', attemptsLeft: 4, lockedSeconds: 0 });
    const user = userEvent.setup();
    const { container } = mount();
    await submit(user);
    await screen.findByText(/Frase incorrecta/);
    expect(container.textContent).not.toContain(FRASE);
  });
});

describe('REC-01 · el bloqueo de 30 minutos', () => {
  it('el quinto fallo enseña la cuenta atrás y ya no hay formulario', async () => {
    recoverKey.mockResolvedValue({ kind: 'wrong', attemptsLeft: 0, lockedSeconds: 1800 });
    const user = userEvent.setup();
    mount();
    await submit(user);
    expect((await screen.findByTestId('cooldown-timer')).textContent).toBe('30:00');
    expect(screen.getByText(/Demasiados intentos fallidos/)).toBeTruthy();
    expect(screen.getByText(/Podrás volver a intentarlo en 30 minutos/)).toBeTruthy();
    expect(screen.queryByLabelText('Frase de seguridad')).toBeNull();
  });

  it('si el servidor dice «locked» desde el primer intento, igual', async () => {
    recoverKey.mockResolvedValue({ kind: 'locked', secondsLeft: 1723 });
    const user = userEvent.setup();
    mount();
    await submit(user);
    expect((await screen.findByTestId('cooldown-timer')).textContent).toBe('28:43');
  });

  it('la cuenta atrás baja y, a cero, vuelve el formulario', async () => {
    recoverKey.mockResolvedValue({ kind: 'locked', secondsLeft: 3 });
    // Solo el reloj y el intervalo son falsos: `setTimeout` sigue real para userEvent.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const user = userEvent.setup();
    mount();
    await submit(user);
    const before = (await screen.findByTestId('cooldown-timer')).textContent;
    expect(before).toBe('00:03');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId('cooldown-timer').textContent).not.toBe(before);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.queryByTestId('cooldown-timer')).toBeNull();
    expect(screen.getByLabelText('Frase de seguridad')).toBeTruthy();
  });

  it('con el bloqueo puesto se puede volver al panel', async () => {
    recoverKey.mockResolvedValue({ kind: 'locked', secondsLeft: 600 });
    const user = userEvent.setup();
    mount();
    await submit(user);
    await user.click(await screen.findByRole('button', { name: 'Volver al panel' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('REC-01 · «He perdido mi frase de seguridad»', () => {
  it('sin camino de vuelta (no ADMIN) no hay enlace', () => {
    mount();
    expect(screen.queryByText(/He perdido mi frase/)).toBeNull();
  });

  it('abre un aviso y «Generar nuevas claves» espera a la casilla de comprensión', async () => {
    const generate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    mount(generate);
    await user.click(screen.getByRole('button', { name: /He perdido mi frase/ }));
    const dialog = screen.getByRole('dialog');
    const confirm = screen.getByRole('button', { name: 'Generar nuevas claves' }) as HTMLButtonElement;
    expect(dialog).toBeTruthy();
    expect(confirm.disabled).toBe(true);

    await user.click(screen.getByLabelText('Entiendo que perderé permanentemente el acceso a mi historial cifrado anterior'));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('Cancelar cierra el aviso sin generar nada', async () => {
    const generate = vi.fn();
    const user = userEvent.setup();
    mount(generate);
    await user.click(screen.getByRole('button', { name: /He perdido mi frase/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it('si no se pudo preparar, lo dice y deja reintentar', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('no'));
    const user = userEvent.setup();
    mount(generate);
    await user.click(screen.getByRole('button', { name: /He perdido mi frase/ }));
    await user.click(screen.getByLabelText(/Entiendo que perderé/));
    await user.click(screen.getByRole('button', { name: 'Generar nuevas claves' }));
    await waitFor(() => expect(screen.getByText(/No hemos podido preparar las claves nuevas/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Generar nuevas claves' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
