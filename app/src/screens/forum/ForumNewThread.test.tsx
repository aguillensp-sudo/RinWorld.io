import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, ForumRateLimitStatus } from '../../lib/forum';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-03 · modo creación de hilo (`ForumNewThread`, FL-FORO-01).
 *
 * Escrito por Claude Code, no por el Coder. Se mockean solo las tres funciones de red de
 * `lib/forum` que la pantalla usa (`fetchCategory`, `fetchForumRateLimitStatus`,
 * `createThread`); los límites del formulario son los de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/forum-new-thread.spec.ts`:
 * que el hilo y su publicación inicial salgan de la base y salgan a nombre de la organización.
 */

const fetchCategory = vi.fn<(slug: string) => Promise<Category | null>>();
const fetchForumRateLimitStatus = vi.fn<() => Promise<ForumRateLimitStatus>>();
const createThread = vi.fn<(categoryId: string, title: string, body: string) => Promise<string>>();

vi.mock('../../lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/forum')>()),
  fetchCategory: (slug: string) => fetchCategory(slug),
  fetchForumRateLimitStatus: () => fetchForumRateLimitStatus(),
  createThread: (categoryId: string, title: string, body: string) => createThread(categoryId, title, body),
}));

const { ForumNewThread } = await import('./ForumNewThread');

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

const CATEGORIA: Category = {
  id: 'c2',
  slug: 'referencias-tecnicas',
  name: 'Referencias técnicas',
  description: 'Dudas y discusión.',
  position: 2,
  threadCount: 4,
  postCount: 15,
  lastActivityAt: '2026-09-11T07:00:00Z',
};

const LIMITE_OK: ForumRateLimitStatus = { used: 2, limit: 10, secondsUntilReset: 1800 };
const LIMITE_ALCANZADO: ForumRateLimitStatus = { used: 10, limit: 10, secondsUntilReset: 600 };

const TITULO = 'Equivalencia FAG 6205-2RS con NSK';
const CUERPO = '¿Alguien ha montado el equivalente NSK del FAG 6205-2RS?';

function montar() {
  const onCancel = vi.fn();
  const onBackToForum = vi.fn();
  const onCreated = vi.fn();
  render(
    <ForumNewThread
      profile={profile}
      slug="referencias-tecnicas"
      onCancel={onCancel}
      onBackToForum={onBackToForum}
      onCreated={onCreated}
    />,
  );
  return { onCancel, onBackToForum, onCreated };
}

async function listo() {
  await screen.findByRole('heading', { level: 1, name: 'Nuevo hilo en Referencias técnicas' });
}

function rellenar(titulo = TITULO, cuerpo = CUERPO) {
  fireEvent.change(screen.getByLabelText('Título del hilo'), { target: { value: titulo } });
  fireEvent.change(screen.getByLabelText('Cuerpo del hilo'), { target: { value: cuerpo } });
}

beforeEach(() => {
  fetchCategory.mockReset();
  fetchForumRateLimitStatus.mockReset();
  createThread.mockReset();
  fetchCategory.mockResolvedValue(CATEGORIA);
  fetchForumRateLimitStatus.mockResolvedValue(LIMITE_OK);
  createThread.mockResolvedValue('t-nuevo');
});

describe('FORO-03 · modo creación · al montar', () => {
  it('pide la categoría por su slug y titula "Nuevo hilo en [categoría]", con los campos vacíos', async () => {
    montar();
    await listo();
    expect(fetchCategory).toHaveBeenCalledWith('referencias-tecnicas');
    expect(screen.getByLabelText('Título del hilo')).toHaveValue('');
    expect(screen.getByLabelText('Cuerpo del hilo')).toHaveValue('');
    expect(screen.getByPlaceholderText('Escribe un título claro y descriptivo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Desarrolla tu pregunta o tema aquí...')).toBeInTheDocument();
  });

  it('lleva el aviso de confidencialidad, permanente', async () => {
    montar();
    await listo();
    expect(
      screen.getByText(/Nada de lo escrito aquí tiene ninguna garantía de confidencialidad\./),
    ).toBeInTheDocument();
  });

  it('una categoría que no existe lo dice, sin formulario', async () => {
    fetchCategory.mockResolvedValue(null);
    montar();
    expect(await screen.findByText('Esta categoría no existe.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título del hilo')).not.toBeInTheDocument();
  });
});

describe('FORO-03 · modo creación · publicar (CA-FORO-04)', () => {
  it('"Publicar hilo" está apagado hasta que título (5) y cuerpo (10) tienen su mínimo', async () => {
    montar();
    await listo();
    const publicar = screen.getByRole('button', { name: 'Publicar hilo' });
    expect(publicar).toBeDisabled();

    rellenar('abcd', CUERPO); // 4 caracteres de título
    expect(publicar).toBeDisabled();
    rellenar(TITULO, 'corto'); // 5 de cuerpo
    expect(publicar).toBeDisabled();
    rellenar('     ', CUERPO); // solo espacios
    expect(publicar).toBeDisabled();
    rellenar(TITULO, CUERPO);
    expect(publicar).toBeEnabled();
  });

  it('publicar llama a createThread con la categoría, el título y el cuerpo sin espacios sobrantes, y abre el hilo creado', async () => {
    const { onCreated } = montar();
    await listo();
    rellenar(`  ${TITULO}  `, `  ${CUERPO}  `);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar hilo' }));
    await waitFor(() => expect(createThread).toHaveBeenCalledWith('c2', TITULO, CUERPO));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('t-nuevo'));
  });

  it('si falla, dice por qué y los campos se quedan como estaban', async () => {
    createThread.mockRejectedValue(new Error('RNG-FORO-06: tu organizacion ha alcanzado el limite'));
    const { onCreated } = montar();
    await listo();
    rellenar();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar hilo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('RNG-FORO-06');
    expect(screen.getByLabelText('Título del hilo')).toHaveValue(TITULO);
    expect(screen.getByLabelText('Cuerpo del hilo')).toHaveValue(CUERPO);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('con el límite de RNG-FORO-06 alcanzado, el botón queda bloqueado y el aviso dice los minutos', async () => {
    fetchForumRateLimitStatus.mockResolvedValue(LIMITE_ALCANZADO);
    montar();
    await listo();
    rellenar();
    expect(screen.getByRole('button', { name: 'Publicar hilo' })).toBeDisabled();
    expect(
      screen.getByText(
        'Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás publicar en 10 minutos.',
      ),
    ).toBeInTheDocument();
    expect(createThread).not.toHaveBeenCalled();
  });
});

describe('FORO-03 · modo creación · salir sin publicar', () => {
  it('"Cancelar" y el enlace de la categoría vuelven a FORO-02 sin publicar nada', async () => {
    const { onCancel } = montar();
    await listo();
    rellenar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Referencias técnicas' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(createThread).not.toHaveBeenCalled();
  });

  it('el enlace "Foros" vuelve a FORO-01', async () => {
    const { onBackToForum } = montar();
    await listo();
    fireEvent.click(screen.getByRole('button', { name: 'Foros' }));
    expect(onBackToForum).toHaveBeenCalledTimes(1);
  });
});
