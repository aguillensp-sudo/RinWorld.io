import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import type { PassphraseCheck } from '../../lib/passphrase';
import type { ChangeOutcome } from '../../lib/key-recovery';

/**
 * SET-SEC-01 · Cambiar backup passphrase. Escrito por Claude Code junto con la pantalla
 * (criptografía, a mano; no es contrato del arnés). Se mockean `changeBackupPassphrase`
 * (su criptografía está en `lib/key-recovery.test.ts`) y `checkPassphrase` (zxcvbn);
 * `passphraseView` y los textos son los de verdad.
 */

const ACTUAL = 'tornillo ámbar cometa jilguero 42';
const NUEVA = 'correct-horse-battery-staple-2024';
const LOGIN = 'Mi-Contraseña-De-Acceso-1';

const change = vi.fn<(cur: string, next: string, id: string) => Promise<ChangeOutcome>>();
const checkPassphrase = vi.fn<(email: string, p: string, ui?: readonly string[]) => Promise<PassphraseCheck>>();

vi.mock('../../lib/key-recovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/key-recovery')>()),
  changeBackupPassphrase: (c: string, n: string, id: string) => change(c, n, id),
}));
vi.mock('../../lib/passphrase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/passphrase')>()),
  checkPassphrase: (email: string, p: string, ui?: readonly string[]) => checkPassphrase(email, p, ui),
}));

const { ChangePassphrase } = await import('./ChangePassphrase');

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

beforeEach(() => {
  change.mockReset();
  checkPassphrase.mockReset();
  checkPassphrase.mockImplementation((_e, p) => {
    if (p === LOGIN) return Promise.resolve({ passphrase: p, score: 4, sameAsLogin: true });
    return Promise.resolve({ passphrase: p, score: p.length < 12 ? 1 : 4, sameAsLogin: false });
  });
});

type User = ReturnType<typeof userEvent.setup>;

async function fill(user: User, { actual = ACTUAL, nueva = NUEVA, repetir = nueva }: { actual?: string; nueva?: string; repetir?: string } = {}) {
  await user.type(screen.getByLabelText('Passphrase actual'), actual);
  await user.type(screen.getByLabelText('Nueva passphrase'), nueva);
  await user.type(screen.getByLabelText('Repetir nueva passphrase'), repetir);
}

const saveButton = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

describe('SET-SEC-01 · el formulario', () => {
  it('pinta el título, la etiqueta E2EE aprobada y tres campos password', () => {
    render(<ChangePassphrase profile={profile} />);
    expect(screen.getByRole('heading', { name: 'Cambiar backup passphrase' })).toBeTruthy();
    expect(screen.getByText(/X25519 \+ Argon2id \+ AES-256-GCM/)).toBeTruthy();
    for (const label of ['Passphrase actual', 'Nueva passphrase', 'Repetir nueva passphrase']) {
      expect(screen.getByLabelText(label).getAttribute('type')).toBe('password');
    }
  });

  it('avisa de que el backup anterior se sobrescribe', () => {
    render(<ChangePassphrase profile={profile} />);
    expect(screen.getByText(/no hay histórico/)).toBeTruthy();
  });

  it('el botón está deshabilitado hasta que los tres campos valen', async () => {
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    expect(saveButton().disabled).toBe(true);
    await user.type(screen.getByLabelText('Passphrase actual'), ACTUAL);
    await user.type(screen.getByLabelText('Nueva passphrase'), NUEVA);
    expect(saveButton().disabled).toBe(true);
    await user.type(screen.getByLabelText('Repetir nueva passphrase'), NUEVA);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
  });

  it('una nueva frase débil se dice y no deja guardar', async () => {
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user, { nueva: 'corta' });
    expect(await screen.findByText(/no cumple los requisitos|demasiado débil|débil/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('la nueva igual a la contraseña de acceso no vale', async () => {
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user, { nueva: LOGIN });
    await waitFor(() => expect(screen.getByLabelText('Nueva passphrase').getAttribute('aria-invalid')).toBe('true'));
    expect(saveButton().disabled).toBe(true);
  });

  it('si la repetición no coincide lo dice y no deja guardar', async () => {
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user, { repetir: NUEVA + 'x' });
    expect(await screen.findByText(/no coinciden/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });
});

describe('SET-SEC-01 · guardar', () => {
  it('llama con la actual, la nueva y el id del miembro, y enseña el éxito vaciando el formulario', async () => {
    change.mockResolvedValue({ kind: 'changed' });
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());
    expect(change).toHaveBeenCalledWith(ACTUAL, NUEVA, 'm-1');
    expect(await screen.findByText('Backup passphrase actualizada. Tu clave privada ha sido recifrada.')).toBeTruthy();
    expect((screen.getByLabelText('Nueva passphrase') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Passphrase actual') as HTMLInputElement).value).toBe('');
  });

  it('con la actual mala dice «no es correcta» y conserva la nueva', async () => {
    change.mockResolvedValue({ kind: 'wrong', attemptsLeft: 3, lockedSeconds: 0 });
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());
    expect(await screen.findByText('La passphrase actual no es correcta.')).toBeTruthy();
    expect((screen.getByLabelText('Nueva passphrase') as HTMLInputElement).value).toBe(NUEVA);
    expect((screen.getByLabelText('Passphrase actual') as HTMLInputElement).value).toBe('');
  });

  it('si se agotaron los intentos, dice cuánto esperar', async () => {
    change.mockResolvedValue({ kind: 'locked', secondsLeft: 1500 });
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());
    expect(await screen.findByText(/Demasiados intentos\. Vuelve a intentarlo en 25 minutos/)).toBeTruthy();
  });

  it('un fallo al guardar avisa de que la frase anterior sigue valiendo', async () => {
    change.mockRejectedValue(new Error('red'));
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());
    expect(await screen.findByText(/Tu frase anterior sigue siendo válida/)).toBeTruthy();
  });

  it('Cancelar vacía el formulario sin llamar a nada', async () => {
    const user = userEvent.setup();
    render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect((screen.getByLabelText('Nueva passphrase') as HTMLInputElement).value).toBe('');
    expect(change).not.toHaveBeenCalled();
  });

  it('ninguna de las frases se pinta en un texto de la pantalla', async () => {
    change.mockResolvedValue({ kind: 'wrong', attemptsLeft: 3, lockedSeconds: 0 });
    const user = userEvent.setup();
    const { container } = render(<ChangePassphrase profile={profile} />);
    await fill(user);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await user.click(saveButton());
    await screen.findByText('La passphrase actual no es correcta.');
    expect(container.textContent).not.toContain(ACTUAL);
    expect(container.textContent).not.toContain(NUEVA);
  });
});
