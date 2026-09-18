import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ForumPost, ForumRateLimitStatus, ThreadHeader } from '../../lib/forum';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-03 · pantalla (`ForumThread`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las seis funciones de red de `lib/forum` que esta pantalla usa
 * (`fetchThread`, `fetchThreadPosts`, `postReply`, `reactToPost`,
 * `unreactToPost`, `fetchForumRateLimitStatus`); `relativeShort`,
 * `replyCountLabel` y el resto siguen siendo los de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe
 * `app/e2e/forum-thread.spec.ts`: que el orden de las publicaciones y las
 * reacciones salgan de la base (`forum_post_detail`, 0033) y no de un cálculo
 * en el cliente.
 */

const fetchThread = vi.fn<(id: string) => Promise<ThreadHeader | null>>();
const fetchThreadPosts = vi.fn<(id: string) => Promise<ForumPost[]>>();
const postReply = vi.fn<(id: string, body: string) => Promise<void>>();
const reactToPost = vi.fn<(id: string) => Promise<void>>();
const unreactToPost = vi.fn<(id: string) => Promise<void>>();
const fetchForumRateLimitStatus = vi.fn<() => Promise<ForumRateLimitStatus>>();

vi.mock('../../lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/forum')>()),
  fetchThread: (id: string) => fetchThread(id),
  fetchThreadPosts: (id: string) => fetchThreadPosts(id),
  postReply: (id: string, body: string) => postReply(id, body),
  reactToPost: (id: string) => reactToPost(id),
  unreactToPost: (id: string) => unreactToPost(id),
  fetchForumRateLimitStatus: () => fetchForumRateLimitStatus(),
}));

const { ForumThread } = await import('./ForumThread');

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

const ORG_A = 'a1000000-0000-4000-8000-000000000001'; // el propio, el de `profile`
const ORG_B = 'b2000000-0000-4000-8000-000000000002'; // ajena

const NOW = new Date('2026-09-22T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

const HILO = 't-c003';

const CABECERA: ThreadHeader = {
  id: HILO,
  title: 'Equivalencia FAG 6205-2RS ↔ NSK: ¿alguien la ha montado?',
  categoryId: 'cat-1',
  categorySlug: 'referencias-tecnicas',
  categoryName: 'Referencias técnicas',
};

const RATE_LIMIT_OK: ForumRateLimitStatus = { used: 2, limit: 10, secondsUntilReset: 1800 };

function publicacion(over: Partial<ForumPost> = {}): ForumPost {
  return {
    id: 'p1',
    authorOrgId: ORG_B,
    authorOrgName: 'Nordwälz Lager',
    authorOrgCountry: 'DE',
    body: '¿Alguien ha sustituido un FAG 6205-2RS por el NSK equivalente?',
    createdAt: hace(9),
    reactionCount: 2,
    reactedByMe: false,
    ...over,
  };
}

const TRES_PUBLICACIONES: ForumPost[] = [
  publicacion({ id: 'p1', authorOrgId: ORG_B, authorOrgName: 'Nordwälz Lager', authorOrgCountry: 'DE', createdAt: hace(9) }),
  publicacion({
    id: 'p2',
    authorOrgId: ORG_A,
    authorOrgName: 'Rodamientos Ibéricos',
    authorOrgCountry: 'ES',
    body: 'Montado en dos bombas el año pasado. Sin incidencias.',
    createdAt: hace(8),
    reactionCount: 1,
  }),
  publicacion({
    id: 'p3',
    authorOrgId: ORG_B,
    authorOrgName: 'Nordwälz Lager',
    authorOrgCountry: 'DE',
    body: 'Gracias, eso es justo lo que necesitaba saber.',
    createdAt: hace(7),
    reactionCount: 0,
  }),
];

function montar(over: Partial<Parameters<typeof ForumThread>[0]> = {}) {
  const onBackToForum = vi.fn();
  const onBackToCategory = vi.fn();
  render(
    <ForumThread
      profile={profile}
      threadId={HILO}
      onBackToForum={onBackToForum}
      onBackToCategory={onBackToCategory}
      now={NOW}
      {...over}
    />,
  );
  return { onBackToForum, onBackToCategory };
}

/** Espera a que llegue el título -- leer antes encuentra la carga, no el hilo (F-159). */
async function listo() {
  await screen.findByRole('heading', { level: 1, name: CABECERA.title });
}

beforeEach(() => {
  fetchThread.mockReset();
  fetchThreadPosts.mockReset();
  postReply.mockReset();
  reactToPost.mockReset();
  unreactToPost.mockReset();
  fetchForumRateLimitStatus.mockReset();

  fetchThread.mockResolvedValue(CABECERA);
  fetchThreadPosts.mockResolvedValue(TRES_PUBLICACIONES);
  fetchForumRateLimitStatus.mockResolvedValue(RATE_LIMIT_OK);
  postReply.mockResolvedValue(undefined);
  reactToPost.mockResolvedValue(undefined);
  unreactToPost.mockResolvedValue(undefined);
});

describe('FORO-03 · al montar', () => {
  it('pide el hilo y sus publicaciones por el id, y el estado del límite', async () => {
    montar();
    await listo();
    expect(fetchThread).toHaveBeenCalledWith(HILO);
    expect(fetchThreadPosts).toHaveBeenCalledWith(HILO);
    expect(fetchForumRateLimitStatus).toHaveBeenCalled();
  });

  it('la raíz lleva `data-testid="forum-thread"` y el id, SIEMPRE -- también mientras carga', () => {
    fetchThread.mockReturnValue(new Promise(() => {}));
    montar();
    const raiz = screen.getByTestId('forum-thread');
    expect(raiz).toHaveAttribute('data-thread-id', HILO);
  });

  it('mientras carga, dice que carga con `aria-busy`', () => {
    fetchThread.mockReturnValue(new Promise(() => {}));
    montar();
    const cargando = screen.getByText('Cargando publicaciones…');
    expect(cargando).toHaveAttribute('aria-busy', 'true');
  });

  it('un error de red se pinta con `role="alert"`', async () => {
    fetchThread.mockRejectedValue(new Error('boom'));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('boom');
  });
});

describe('FORO-03 · cabecera (spec §3)', () => {
  it('eyebrow y título completo del hilo en un h1 de verdad', async () => {
    montar();
    await listo();
    expect(screen.getByText('Módulo 08 · Foro de la Comunidad')).toBeInTheDocument();
  });

  it('el breadcrumb tiene DOS enlaces: "Foros" y el nombre de la categoría', async () => {
    const { onBackToForum, onBackToCategory } = montar();
    await listo();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });

    fireEvent.click(within(nav).getByRole('button', { name: 'Foros' }));
    expect(onBackToForum).toHaveBeenCalledTimes(1);

    fireEvent.click(within(nav).getByRole('button', { name: 'Referencias técnicas' }));
    expect(onBackToCategory).toHaveBeenCalledTimes(1);
  });

  it('el aviso de confidencialidad es el mismo bloque permanente de FORO-01/02', async () => {
    montar();
    await listo();
    const negrita = screen.getByText('Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.');
    expect(negrita.tagName).toBe('STRONG');
    expect(negrita.parentElement).toHaveTextContent(
      'El contenido publicado en el Foro es texto plano, visible para todos los miembros de Bearingworld.io.',
    );
  });
});

describe('FORO-03 · hilo inexistente', () => {
  it('un hilo que no existe lo dice, sin pintar un título vacío', async () => {
    fetchThread.mockResolvedValue(null);
    montar();
    expect(await screen.findByText('Este hilo no existe.')).toBeInTheDocument();
    expect(fetchThreadPosts).not.toHaveBeenCalled();
  });
});

describe('FORO-03 · las publicaciones', () => {
  it('una fila por publicación, en el orden en que llegan -- la primera ES la inicial', async () => {
    montar();
    await listo();
    const filas = screen.getAllByTestId(/^forum-post-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual(['forum-post-p1', 'forum-post-p2', 'forum-post-p3']);
  });

  it('cada fila pinta organización, país, contenido, tiempo relativo y reacciones', async () => {
    montar();
    await listo();
    const p1 = screen.getByTestId('forum-post-p1');
    expect(within(p1).getByText('Nordwälz Lager')).toBeInTheDocument();
    expect(within(p1).getByText('DE')).toBeInTheDocument();
    expect(within(p1).getByText('¿Alguien ha sustituido un FAG 6205-2RS por el NSK equivalente?')).toBeInTheDocument();
    expect(within(p1).getByText('hace 9 días')).toBeInTheDocument();
    expect(within(p1).getByRole('button', { name: '👍 2' })).toBeInTheDocument();
  });

  it('"X respuestas" cuenta las publicaciones MENOS la inicial', async () => {
    montar();
    await listo();
    expect(screen.getByText('2 respuestas')).toBeInTheDocument();
  });

  it('Editar/Eliminar SOLO en las publicaciones de la propia organización, y apagados', async () => {
    montar();
    await listo();
    const propia = screen.getByTestId('forum-post-p2'); // ORG_A === profile.orgId
    expect(within(propia).getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(within(propia).getByRole('button', { name: 'Eliminar' })).toBeDisabled();

    const ajena = screen.getByTestId('forum-post-p1'); // ORG_B
    expect(within(ajena).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(ajena).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });
});

describe('FORO-03 · hilo sin respuestas', () => {
  it('con solo la inicial, el mensaje reemplaza al contador y a la lista de respuestas', async () => {
    fetchThreadPosts.mockResolvedValue(TRES_PUBLICACIONES.slice(0, 1));
    montar();
    await listo();
    expect(screen.getByText('Todavía no hay respuestas. Sé el primero en responder.')).toBeInTheDocument();
    expect(screen.queryByText(/respuestas$/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^forum-post-/)).toHaveLength(1);
  });
});

describe('FORO-03 · reaccionar (spec §3, CA-FORO-05)', () => {
  it('reaccionar llama a reactToPost con el id de ESA publicación', async () => {
    montar();
    await listo();
    const p2 = screen.getByTestId('forum-post-p2'); // reactedByMe: false
    fireEvent.click(within(p2).getByRole('button', { name: '👍 1' }));
    await waitFor(() => expect(reactToPost).toHaveBeenCalledWith('p2'));
    expect(unreactToPost).not.toHaveBeenCalled();
  });

  it('quitar la reacción llama a unreactToPost, no a reactToPost', async () => {
    fetchThreadPosts.mockResolvedValue([
      publicacion({ id: 'p1', reactedByMe: true, reactionCount: 2 }),
    ]);
    montar();
    await listo();
    const p1 = screen.getByTestId('forum-post-p1');
    fireEvent.click(within(p1).getByRole('button', { name: '👍 2' }));
    await waitFor(() => expect(unreactToPost).toHaveBeenCalledWith('p1'));
    expect(reactToPost).not.toHaveBeenCalled();
  });

  it('el botón anuncia su estado con aria-pressed', async () => {
    fetchThreadPosts.mockResolvedValue([publicacion({ id: 'p1', reactedByMe: true })]);
    montar();
    await listo();
    expect(screen.getByRole('button', { name: '👍 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el contador se actualiza -- CA-FORO-05, "actualiza inmediatamente"', async () => {
    montar();
    await listo();
    const p2 = screen.getByTestId('forum-post-p2');
    fireEvent.click(within(p2).getByRole('button', { name: '👍 1' }));
    await waitFor(() => expect(within(p2).getByRole('button', { name: '👍 2' })).toBeInTheDocument());
  });
});

describe('FORO-03 · responder (spec §3, §6, RNG-FORO-06)', () => {
  const TEXTAREA = 'Escribe tu respuesta...';

  it('"Publicar respuesta" está deshabilitado mientras el textarea está vacío', async () => {
    montar();
    await listo();
    expect(screen.getByRole('button', { name: 'Publicar respuesta' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(TEXTAREA), { target: { value: 'Mi respuesta' } });
    expect(screen.getByRole('button', { name: 'Publicar respuesta' })).not.toBeDisabled();
  });

  it('el texto secundario dice a quién se le atribuye la respuesta', async () => {
    montar();
    await listo();
    expect(
      screen.getByText('Tu respuesta será visible para todos los miembros con la identidad de tu organización.'),
    ).toBeInTheDocument();
  });

  it('publicar llama a postReply con el hilo y el texto recortado, limpia el campo y vuelve a pedir', async () => {
    montar();
    await listo();
    fireEvent.change(screen.getByPlaceholderText(TEXTAREA), { target: { value: '  Una respuesta nueva.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));

    await waitFor(() => expect(postReply).toHaveBeenCalledWith(HILO, 'Una respuesta nueva.'));
    await waitFor(() => expect(screen.getByPlaceholderText(TEXTAREA)).toHaveValue(''));
    await waitFor(() => expect(fetchThreadPosts).toHaveBeenCalledTimes(2)); // al montar + tras publicar
    expect(fetchForumRateLimitStatus).toHaveBeenCalledTimes(2); // al montar + tras publicar
  });

  it('RNG-FORO-06: con el límite alcanzado, el botón se bloquea con el mensaje y los minutos exactos', async () => {
    fetchForumRateLimitStatus.mockResolvedValue({ used: 10, limit: 10, secondsUntilReset: 125 });
    montar();
    await listo();
    fireEvent.change(screen.getByPlaceholderText(TEXTAREA), { target: { value: 'Algo' } });
    expect(screen.getByRole('button', { name: 'Publicar respuesta' })).toBeDisabled();
    expect(
      screen.getByText('Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás publicar en 3 minutos.'),
    ).toBeInTheDocument();
    expect(postReply).not.toHaveBeenCalled();
  });

  it('con el límite alcanzado, la lectura y las reacciones NO se ven afectadas', async () => {
    fetchForumRateLimitStatus.mockResolvedValue({ used: 10, limit: 10, secondsUntilReset: 60 });
    montar();
    await listo();
    const p2 = screen.getByTestId('forum-post-p2');
    fireEvent.click(within(p2).getByRole('button', { name: '👍 1' }));
    await waitFor(() => expect(reactToPost).toHaveBeenCalledWith('p2'));
  });

  it('un error al publicar se pinta, no se traga en silencio', async () => {
    postReply.mockRejectedValue(new Error('RNG-FORO-06: limite'));
    montar();
    await listo();
    fireEvent.change(screen.getByPlaceholderText(TEXTAREA), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));
    expect(await screen.findByText('RNG-FORO-06: limite')).toBeInTheDocument();
  });
});
