import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * unified-registration-form#1 · envío exitoso del FRO: el cableado «Crear mi cuenta → flujo de claves».
 *
 * GIVEN un usuario en estado INVITED_APPROVED que completa todos los campos obligatorios del FRO
 * WHEN  pulsa «Crear mi cuenta»
 * THEN  el sistema crea la organización y el usuario administrador en base de datos
 * AND   el estado transiciona a REGISTERED
 * AND   el usuario es redirigido al flujo de generación de claves E2EE (e2ee-key-management, FL-03)
 *
 * El formulario (`OrgRegistration`) se sustituye por un doble que solo hace «Crear mi cuenta»
 * (su validación, su envío y `onRegistered` ya los miden `OrgRegistration.test.tsx` y
 * `register-org.test.ts`, que prueba «da de alta y después inicia sesión»). Lo que mide ESTE fichero
 * es lo que ninguno de los dos ve: que `App`, al terminar el FRO, retira el token del enlace y, con
 * la cuenta recién nacida (ADMIN, REGISTERED), lleva a REG-05, la entrada de la generación de claves.
 *
 * ⚠ No caza que la organización y el administrador existan en la base: eso es SQL (`0041`).
 */

const BASE_ADMIN: MemberProfile = {
  id: 'm-1',
  email: 'ana.ruiz@sur.es',
  fullName: 'Ana Ruiz',
  role: 'ADMIN',
  state: 'REGISTERED',
  orgId: 'org-1',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

let session: { status: 'anonymous' } | { status: 'authenticated'; profile: MemberProfile } = { status: 'anonymous' };
const refresh = vi.fn();
const signOut = vi.fn();
const TOKEN = 'cd'.repeat(32);

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: session, error: null, signIn: vi.fn(), signOut, refresh }),
}));
vi.mock('./screens/onboarding/OrgRegistration', () => ({
  OrgRegistration: (props: { token: string; onRegistered: () => void }) => (
    <button
      type="button"
      data-token={props.token}
      onClick={() => {
        // Lo que hace `submitRegistration` al salir bien: la cuenta ya existe y hay sesión (ADMIN, REGISTERED).
        session = { status: 'authenticated', profile: BASE_ADMIN };
        props.onRegistered();
      }}
    >
      Crear mi cuenta
    </button>
  ),
}));

const { App } = await import('./App');

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  window.location.hash = '';
  session = { status: 'anonymous' };
  refresh.mockReset();
  signOut.mockReset();
});
afterEach(() => {
  window.location.hash = '';
});

describe('App · FRO → claves', () => {
  it('unified-registration-form#1 · al crear la cuenta se retira el token del enlace y el administrador REGISTERED aterriza en REG-05 (claves)', async () => {
    window.location.hash = `#registro?token=${TOKEN}`;
    const user = userEvent.setup();
    render(<App />);

    // Se entra al FRO con el token del enlace, sin pasar por el login.
    const crear = await screen.findByRole('button', { name: 'Crear mi cuenta' });
    expect(crear).toHaveAttribute('data-token', TOKEN);
    expect(screen.queryByRole('button', { name: 'Entendido, crear mi frase de seguridad' })).not.toBeInTheDocument();

    await user.click(crear);

    // THEN: la entrada del flujo de generación de claves E2EE.
    expect(await screen.findByRole('button', { name: 'Entendido, crear mi frase de seguridad' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Crear mi cuenta' })).not.toBeInTheDocument());
    // El token ya no sirve y no debe volver a aparecer: el hash se borra.
    expect(window.location.hash).toBe('');
  });
});
