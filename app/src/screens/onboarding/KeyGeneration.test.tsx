import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import type { SessionKeyPair } from '../../lib/crypto';
import type { KeyBackupPayload, NewKeyPair, ProtectedKey } from '../../lib/key-backup';

/**
 * REG-07 · Generando tus claves de seguridad (`KeyGeneration`). Escrita a mano, como
 * la pantalla (criptografía, Plan §4.3); no es contrato del arnés.
 *
 * Se mockean los cuatro pasos de `lib/key-backup` (la criptografía tiene sus pruebas en
 * `key-backup.test.ts`), la copia de dispositivo y el llavero; los textos son los de
 * verdad. Lo que se mide es la ORQUESTACIÓN: el orden, qué se reintenta desde dónde,
 * cuándo se suelta la frase y qué queda puesto al acabar.
 */

const FRASE = 'tornillo ámbar cometa jilguero 42';

const pair = { privateKey: {} as CryptoKey, publicKey: new Uint8Array(32).fill(1) } satisfies SessionKeyPair;
const payload = { publicKey: pair.publicKey } as unknown as KeyBackupPayload;
const sealed: ProtectedKey = { payload, wrappingKey: {} as CryptoKey };

const calls: string[] = [];
const createKeyPair = vi.fn<() => Promise<NewKeyPair>>();
const protectPrivateKey = vi.fn<(p: string, id: string, g: NewKeyPair) => Promise<ProtectedKey>>();
const uploadKeyBackup = vi.fn<(p: KeyBackupPayload) => Promise<void>>();
const verifyKeyBackup = vi.fn<(id: string, k: ProtectedKey) => Promise<void>>();
const saveDeviceKey = vi.fn<(id: string, p: SessionKeyPair) => Promise<boolean>>();
const adoptKeyring = vi.fn<(id: string, p: SessionKeyPair) => void>();

vi.mock('../../lib/key-backup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/key-backup')>()),
  createKeyPair: () => createKeyPair(),
  protectPrivateKey: (p: string, id: string, g: NewKeyPair) => protectPrivateKey(p, id, g),
  uploadKeyBackup: (p: KeyBackupPayload) => uploadKeyBackup(p),
  verifyKeyBackup: (id: string, k: ProtectedKey) => verifyKeyBackup(id, k),
}));
vi.mock('../../lib/device-key', () => ({
  saveDeviceKey: (id: string, p: SessionKeyPair) => saveDeviceKey(id, p),
}));
vi.mock('../../lib/keys', () => ({
  adoptKeyring: (id: string, p: SessionKeyPair) => adoptKeyring(id, p),
}));

const { KeyGeneration } = await import('./KeyGeneration');

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

const onPassphraseConsumed = vi.fn(() => calls.push('consumed'));
const onPassphraseMissing = vi.fn();
const onContinue = vi.fn();

/** Una promesa que el test resuelve a mano: para mirar la pantalla A MITAD de un paso. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  createKeyPair.mockImplementation(async () => {
    calls.push('create');
    return { privateBytes: new Uint8Array(32), keyPair: pair };
  });
  protectPrivateKey.mockImplementation(async () => {
    calls.push('protect');
    return sealed;
  });
  uploadKeyBackup.mockImplementation(async () => {
    calls.push('upload');
  });
  verifyKeyBackup.mockImplementation(async () => {
    calls.push('verify');
  });
  saveDeviceKey.mockImplementation(async () => {
    calls.push('save');
    return true;
  });
  adoptKeyring.mockImplementation(() => {
    calls.push('adopt');
  });
});

function renderScreen(passphrase: string | null = FRASE) {
  return render(
    <KeyGeneration
      profile={profile}
      passphrase={passphrase}
      onPassphraseConsumed={onPassphraseConsumed}
      onPassphraseMissing={onPassphraseMissing}
      onContinue={onContinue}
    />,
  );
}

function states() {
  return screen.getAllByTestId('proc-step').map((li) => li.getAttribute('data-state'));
}

describe('REG-07 · lo que pinta', () => {
  it('título, subtítulo, los cuatro pasos con sus textos y el aviso de no cerrar', async () => {
    const hold = deferred<NewKeyPair>();
    createKeyPair.mockReturnValue(hold.promise);
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Generando tus claves de seguridad' })).toBeInTheDocument();
    expect(screen.getByText('Este proceso tardará unos segundos. No cierres esta ventana.')).toBeInTheDocument();
    for (const label of [
      'Generando tu par de claves',
      'Protegiendo tu clave privada',
      'Guardando el backup en servidor',
      'Verificando la integridad',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByText('No cierres ni recargues esta ventana. El proceso puede tardar hasta 30 segundos.'),
    ).toBeInTheDocument();
    expect(states()).toEqual(['active', 'pending', 'pending', 'pending']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    hold.resolve({ privateBytes: new Uint8Array(32), keyPair: pair });
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
  });

  it('en el paso 2: el rodamiento gira en ese paso, solo en ese, con «Calculando clave de protección…»', async () => {
    const hold = deferred<ProtectedKey>();
    protectPrivateKey.mockReturnValue(hold.promise);
    renderScreen();

    await waitFor(() => expect(states()).toEqual(['done', 'active', 'pending', 'pending']));
    const spinners = screen.getAllByTestId('bearing-spinner');
    expect(spinners).toHaveLength(1);
    expect(screen.getAllByTestId('proc-step')[1]).toContainElement(spinners[0]!);
    expect(screen.getByText('Calculando clave de protección…')).toBeInTheDocument();
    hold.resolve(sealed);
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
  });

  it('la frase no aparece en ningún sitio de la pantalla', async () => {
    const { container } = renderScreen();
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
    expect(container.innerHTML).not.toContain(FRASE);
  });
});

describe('REG-07 · el proceso', () => {
  it('ANCLA · los cuatro pasos en orden, y al acabar: copia en el dispositivo, llavero y «Continuar»', async () => {
    renderScreen();
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');

    expect(calls).toEqual(['create', 'protect', 'consumed', 'upload', 'verify', 'save', 'adopt']);
    expect(protectPrivateKey).toHaveBeenCalledWith(FRASE, 'm-1', expect.anything());
    expect(uploadKeyBackup).toHaveBeenCalledWith(payload);
    expect(verifyKeyBackup).toHaveBeenCalledWith('m-1', sealed);
    expect(saveDeviceKey).toHaveBeenCalledWith('m-1', pair);
    expect(adoptKeyring).toHaveBeenCalledWith('m-1', pair);

    expect(states()).toEqual(['done', 'done', 'done', 'done']);
    expect(screen.queryByTestId('bearing-spinner')).not.toBeInTheDocument();
    expect(screen.queryByText(/No cierres ni recargues/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('en StrictMode el proceso corre UNA vez (un solo par, una sola subida)', async () => {
    render(
      <StrictMode>
        <KeyGeneration
          profile={profile}
          passphrase={FRASE}
          onPassphraseConsumed={onPassphraseConsumed}
          onPassphraseMissing={onPassphraseMissing}
          onContinue={onContinue}
        />
      </StrictMode>,
    );
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
    expect(createKeyPair).toHaveBeenCalledTimes(1);
    expect(uploadKeyBackup).toHaveBeenCalledTimes(1);
  });

  it('sin frase (no debería pasar): no genera nada y vuelve a REG-06', async () => {
    renderScreen(null);
    await waitFor(() => expect(onPassphraseMissing).toHaveBeenCalledTimes(1));
    expect(protectPrivateKey).not.toHaveBeenCalled();
    expect(uploadKeyBackup).not.toHaveBeenCalled();
  });
});

describe('REG-07 · error en el paso 3 (spec §6)', () => {
  it('aspa en el paso 3, «Error de conexión», el mensaje de la spec y «Reintentar»', async () => {
    uploadKeyBackup.mockRejectedValueOnce(new Error('red'));
    renderScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hemos podido guardar el backup. Comprueba tu conexión e inténtalo de nuevo.',
    );
    expect(states()).toEqual(['done', 'done', 'error', 'pending']);
    expect(screen.getByText('Error de conexión')).toBeInTheDocument();
    expect(screen.queryByText(/No cierres ni recargues/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('ANCLA · «Reintentar» sigue desde el paso 3 con el MISMO backup: no vuelve a generar el par', async () => {
    uploadKeyBackup.mockRejectedValueOnce(new Error('red'));
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');

    expect(createKeyPair).toHaveBeenCalledTimes(1);
    expect(protectPrivateKey).toHaveBeenCalledTimes(1);
    expect(uploadKeyBackup).toHaveBeenCalledTimes(2);
    expect(uploadKeyBackup.mock.calls[1]?.[0]).toBe(payload);
  });

  it('un fallo en la verificación (paso 4) también reintenta desde el 3, sin generar otro par', async () => {
    verifyKeyBackup.mockRejectedValueOnce(new Error('red'));
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido guardar el backup.');
    expect(states()).toEqual(['done', 'done', 'done', 'error']);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
    expect(createKeyPair).toHaveBeenCalledTimes(1);
    expect(uploadKeyBackup).toHaveBeenCalledTimes(2);
    expect(verifyKeyBackup).toHaveBeenCalledTimes(2);
  });

  it('sin verificación no hay copia en el dispositivo ni llavero', async () => {
    verifyKeyBackup.mockRejectedValueOnce(new Error('no abre'));
    renderScreen();
    await screen.findByRole('alert');
    expect(saveDeviceKey).not.toHaveBeenCalled();
    expect(adoptKeyring).not.toHaveBeenCalled();
  });
});

describe('REG-07 · error en este navegador (pasos 1–2)', () => {
  it('el paso 2 falla: aviso propio, la frase NO se suelta, y «Reintentar» empieza de cero', async () => {
    protectPrivateKey.mockRejectedValueOnce(new Error('sin memoria'));
    renderScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido generar tus claves.');
    expect(states()).toEqual(['done', 'error', 'pending', 'pending']);
    expect(onPassphraseConsumed).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('¡Todo listo! Tu cuenta está protegida.');
    expect(createKeyPair).toHaveBeenCalledTimes(2);
    expect(protectPrivateKey).toHaveBeenLastCalledWith(FRASE, 'm-1', expect.anything());
    expect(onPassphraseConsumed).toHaveBeenCalledTimes(1);
  });
});
