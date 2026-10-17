import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';
import type { ProxyCall, ProxyRequest, ProxyTurn } from './lib/vera';

/**
 * ESCENARIOS DE SPEC sobre el cableado de `App.tsx` (nivel unit, sin red ni modelo real).
 * Salen de `openspec/specs/<capability>/spec.md`, no del código: cada `it` empieza por el id del
 * escenario de `openspec/v1/trazabilidad.csv`.
 *
 * Cliente LLM mockeado (`CLAUDE.md` §5): `createProxyCall` devuelve un espía.
 */

const BASE: MemberProfile = {
  id: 'm-1',
  email: 'admin@sur.es',
  fullName: 'Juan Martínez',
  role: 'ADMIN',
  state: 'REGISTERED',
  orgId: 'org-1',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

let session: { status: 'anonymous' } | { status: 'authenticated'; profile: MemberProfile } = {
  status: 'authenticated',
  profile: BASE,
};
const callSpy = vi.fn<ProxyCall>();
let rerenderApp: () => void = () => {};
/** El logout de verdad cambia la sesión a anónima y `App` pinta el login: se imita eso. */
const signOut = vi.fn(async () => {
  session = { status: 'anonymous' };
  rerenderApp();
});

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: session, error: null, signIn: vi.fn(), signOut, refresh: vi.fn() }),
}));
vi.mock('./lib/login-fingerprint', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/login-fingerprint')>()),
  hasLoginFingerprint: () => true,
}));
vi.mock('./lib/keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/keys')>()),
  ensureKeyring: async () => ({ publicKey: new Uint8Array(32) }),
  keyringHasBackup: () => true,
}));
vi.mock('./lib/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/invitations')>()),
  fetchTeam: async () => [],
  fetchInvitations: async () => [],
}));
vi.mock('./lib/vera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/vera')>()),
  createProxyCall: () => (body: ProxyRequest) => callSpy(body),
}));
vi.mock('./screens/panel/Panel', () => ({ Panel: () => <div>panel</div> }));

const { App } = await import('./App');

vi.setConfig({ testTimeout: 30_000 });

function turno(p: Partial<ProxyTurn>): ProxyTurn {
  return { stopReason: 'end_turn', text: '', toolUses: [], raw: [], ...p };
}

beforeEach(() => {
  session = { status: 'authenticated', profile: BASE };
  callSpy.mockReset();
  signOut.mockClear();
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* sin storage no hay nada que limpiar */
  }
});

describe('e2ee-key-management/passphrase-bloqueante', () => {
  /*
   * Escenario «intento de saltar el paso» (passphrase-bloqueante#1)
   *   GIVEN un miembro en la pantalla REG-06
   *   WHEN  intenta navegar a cualquier otra sección sin completar la passphrase
   *   THEN  el sistema impide la navegación
   *   AND   mantiene al usuario en REG-06 hasta que el paso se complete correctamente
   * Y el requisito: «sin ofrecer ninguna opción de omitir o diferir este paso».
   */
  it('e2ee-key-management/passphrase-bloqueante#1 · desde REG-06 ninguna navegación ni opción de omitir saca al miembro sin completar la frase', async () => {
    const user = userEvent.setup();
    render(<App />);

    // GIVEN: el miembro está en REG-06 (REG-05 → «Entendido, crear mi frase de seguridad»).
    await user.click(await screen.findByRole('button', { name: 'Entendido, crear mi frase de seguridad' }));
    const titulo = () => screen.queryByRole('heading', { level: 1, name: 'Crea tu frase de seguridad' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Crea tu frase de seguridad' })).toBeInTheDocument();

    // No hay opción de omitir ni de diferir.
    const opcionesDeSalida = screen.queryAllByRole('button').concat(screen.queryAllByRole('link'));
    for (const o of opcionesDeSalida) {
      expect(o.textContent ?? '').not.toMatch(/omitir|saltar|m[aá]s tarde|despu[eé]s|luego|ahora no|skip|diferir/i);
    }

    // WHEN: pulsa cualquier ítem de ambos menús (el principal y el lateral).
    const items = [
      ...within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('button'),
      ...within(screen.getByRole('navigation', { name: 'Navegación lateral' })).getAllByRole('button'),
    ];
    expect(items.length).toBeGreaterThanOrEqual(8);
    for (const item of items) {
      await user.click(item);
      // THEN: sigue en REG-06 y no se ha pintado ninguna otra sección.
      expect(titulo()).toBeInTheDocument();
      expect(screen.queryByText('panel')).not.toBeInTheDocument();
    }

    // Y «Continuar» sin completar nada ni se habilita ni avanza a REG-07.
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled();
    await user.click(continuar);
    expect(titulo()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /claves/i })).not.toBeInTheDocument();
  });
});

describe('vera-agent/session-context-layer', () => {
  /*
   * Escenario «purga al cerrar sesión» (session-context-layer#2)
   *   GIVEN un usuario que cierra sesión voluntariamente antes de las 24 horas
   *   WHEN  se ejecuta el logout
   *   THEN  el contexto de sesión se purga inmediatamente, sin esperar al cumplimiento del TTL
   * Y el requisito: «sin ofrecer ninguna opción de persistencia de este historial entre sesiones».
   */
  it('vera-agent/session-context-layer#2 · tras cerrar sesión y volver a entrar, VERA no recuerda nada de la conversación anterior', async () => {
    session = { status: 'authenticated', profile: { ...BASE, state: 'ACTIVE' } };
    callSpy.mockResolvedValueOnce(turno({ text: 'Tienes 3 negociaciones abiertas.' }));
    callSpy.mockResolvedValueOnce(turno({ text: 'Hola de nuevo.' }));
    const user = userEvent.setup();
    const { rerender } = render(<App />);
    rerenderApp = () => rerender(<App />);

    // GIVEN: una conversación en curso (menos de 24 h desde el inicio de sesión).
    await user.type(await screen.findByLabelText('Pregunta a VERA'), 'cuántas negociaciones tengo');
    await user.click(screen.getByLabelText('Enviar'));
    expect(await screen.findByText('Tienes 3 negociaciones abiertas.')).toBeInTheDocument();

    // WHEN: cierra sesión voluntariamente.
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);

    // THEN: el panel y su memoria desaparecen en el acto, sin esperar al TTL.
    expect(screen.queryByLabelText('Pregunta a VERA')).not.toBeInTheDocument();
    expect(screen.queryByText('Tienes 3 negociaciones abiertas.')).not.toBeInTheDocument();

    // AND: no se ha persistido el historial en ningún almacenamiento del navegador.
    const volcado = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(volcado).not.toContain('negociaciones');

    // AND: la sesión siguiente empieza de cero: el modelo solo recibe la pregunta nueva.
    session = { status: 'authenticated', profile: { ...BASE, state: 'ACTIVE' } };
    rerender(<App />);
    expect(screen.queryByText('Tienes 3 negociaciones abiertas.')).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText('Pregunta a VERA'), 'hola');
    await user.click(screen.getByLabelText('Enviar'));
    expect(await screen.findByText('Hola de nuevo.')).toBeInTheDocument();
    expect(callSpy).toHaveBeenCalledTimes(2);
    expect(callSpy.mock.calls[1]![0].messages).toEqual([{ role: 'user', content: 'hola' }]);
  });
});
