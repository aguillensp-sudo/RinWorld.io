import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * PARCIALES · community-forum/active-account-access#1 (cableado de `App.tsx`).
 * Escrito desde la spec, no desde el código.
 *
 *   GIVEN un visitante sin sesión activa
 *   WHEN  intenta acceder a cualquier categoría, hilo o publicación del foro
 *   THEN  el sistema lo redirige a login
 *   AND   no muestra ningún contenido del foro sin autenticación
 *
 * Las pantallas del foro no tienen URL propia en V1 (navegación por estado), así que "intentar
 * acceder" se ejerce de dos maneras: direcciones con pinta de foro (`#foro/...`) sin sesión, y
 * una sesión que se pierde estando dentro de una categoría. En las dos, la capa de datos del
 * foro no debe ni llamarse.
 */

const PROFILE: MemberProfile = {
  id: 'm-1',
  email: 'ana@sur.es',
  fullName: 'Ana Ruiz',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-1',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

let session: { status: 'anonymous' } | { status: 'authenticated'; profile: MemberProfile } = { status: 'anonymous' };

const fetchCategories = vi.fn(async () => [
  { id: 'c2', slug: 'referencias-tecnicas', name: 'Referencias técnicas', description: 'd', position: 2, threadCount: 1, postCount: 2, lastActivityAt: null },
]);
const fetchRecentThreads = vi.fn(async () => []);
const fetchCategory = vi.fn(async () => ({
  id: 'c2', slug: 'referencias-tecnicas', name: 'Referencias técnicas', description: 'd', position: 2, threadCount: 1, postCount: 2, lastActivityAt: null,
}));
const fetchThreads = vi.fn(async () => ({
  rows: [{ id: 't1', title: 'Hilo secreto del foro', authorOrgName: 'SKF', replyCount: 0, reactionCount: 0, lastPostAt: '2026-09-01T00:00:00Z' }],
  total: 1,
  page: 1,
  pageCount: 1,
}));
const fetchThread = vi.fn(async () => null);
const fetchThreadPosts = vi.fn(async () => []);

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: session, error: null, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
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
vi.mock('./lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/forum')>()),
  fetchCategories: () => fetchCategories(),
  fetchRecentThreads: () => fetchRecentThreads(),
  fetchCategory: () => fetchCategory(),
  fetchThreads: () => fetchThreads(),
  fetchThread: () => fetchThread(),
  fetchThreadPosts: () => fetchThreadPosts(),
}));
vi.mock('./screens/panel/Panel', () => ({ Panel: () => <div>panel</div> }));

const { App } = await import('./App');

vi.setConfig({ testTimeout: 30_000 });

const llamadasAlForo = () =>
  [fetchCategories, fetchRecentThreads, fetchCategory, fetchThreads, fetchThread, fetchThreadPosts].reduce(
    (n, f) => n + f.mock.calls.length,
    0,
  );

beforeEach(() => {
  session = { status: 'anonymous' };
  for (const f of [fetchCategories, fetchRecentThreads, fetchCategory, fetchThreads, fetchThread, fetchThreadPosts]) f.mockClear();
  window.location.hash = '';
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* sin storage no hay nada que limpiar */
  }
});

describe('community-forum/active-account-access', () => {
  it('community-forum/active-account-access#1 · sin sesión, cualquier dirección del foro acaba en el login y la capa de datos del foro no se llama', () => {
    const direcciones = [
      '#foro',
      '#foro/referencias-tecnicas',
      '#foro/hilo/t1',
      '#foro/hilo/t1/publicacion/p1',
      '#/foros/categoria/referencias-tecnicas/hilo/t1',
    ];
    for (const hash of direcciones) {
      window.location.hash = hash;
      const { unmount } = render(<App />);

      // THEN: login
      expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
      // AND: nada del foro
      expect(screen.queryByTestId('forum-thread')).not.toBeInTheDocument();
      expect(screen.queryByTestId('forum-category')).not.toBeInTheDocument();
      expect(screen.queryByText('Hilo secreto del foro')).not.toBeInTheDocument();
      expect(screen.queryByText(/Referencias técnicas/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Foro de la Comunidad/)).not.toBeInTheDocument();
      unmount();
    }
    expect(llamadasAlForo()).toBe(0);
  });

  it('community-forum/active-account-access#1 · si la sesión se pierde dentro de una categoría del foro, el contenido desaparece y queda el login', async () => {
    session = { status: 'authenticated', profile: PROFILE };
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    // GIVEN: dentro de FORO-02 con sus hilos a la vista
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: /Foros/ }),
    );
    await user.click(await screen.findByRole('button', { name: /Referencias técnicas/ }));
    expect(await screen.findByText('Hilo secreto del foro')).toBeInTheDocument();

    // WHEN: la sesión deja de existir
    session = { status: 'anonymous' };
    rerender(<App />);

    // THEN: login, y ningún contenido del foro
    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText('Hilo secreto del foro')).not.toBeInTheDocument();
    expect(screen.queryByTestId('forum-category')).not.toBeInTheDocument();
  });
});
