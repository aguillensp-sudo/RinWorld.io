import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  Category,
  ForumPost,
  ForumRateLimitStatus,
  RecentThread,
  ThreadHeader,
  ThreadPage,
} from '../../lib/forum';
import type { MemberProfile } from '../../lib/session';

/**
 * PARCIALES · community-forum. Escrito desde `openspec/specs/community-forum/spec.md`
 * (bloques `#### Scenario:`), no desde lo que el código hace. Cliente de red mockeado;
 * el resto de `lib/forum` (formato, etiquetas) es el de verdad.
 */

const fetchThread = vi.fn<(id: string) => Promise<ThreadHeader | null>>();
const fetchThreadPosts = vi.fn<(id: string) => Promise<ForumPost[]>>();
const postReply = vi.fn<(id: string, body: string) => Promise<void>>();
const fetchForumRateLimitStatus = vi.fn<() => Promise<ForumRateLimitStatus>>();
const fetchCategories = vi.fn<() => Promise<Category[]>>();
const fetchRecentThreads = vi.fn<(n?: number) => Promise<RecentThread[]>>();
const fetchCategory = vi.fn<(slug: string) => Promise<Category | null>>();
const fetchThreads = vi.fn<() => Promise<ThreadPage>>();

vi.mock('../../lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/forum')>()),
  fetchThread: (id: string) => fetchThread(id),
  fetchThreadPosts: (id: string) => fetchThreadPosts(id),
  postReply: (id: string, body: string) => postReply(id, body),
  fetchForumRateLimitStatus: () => fetchForumRateLimitStatus(),
  fetchCategories: () => fetchCategories(),
  fetchRecentThreads: (n?: number) => fetchRecentThreads(n),
  fetchCategory: (s: string) => fetchCategory(s),
  fetchThreads: () => fetchThreads(),
}));

const { ForumThread } = await import('./ForumThread');
const { ForumCategory } = await import('./ForumCategory');
const { Forum } = await import('./Forum');
const { OPERATOR_NAV_ITEMS } = await import('../../shell/OperatorShell');

const ORG_A = 'a1000000-0000-4000-8000-000000000001'; // la del que mira
const ORG_B = 'b2000000-0000-4000-8000-000000000002';

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'persona.individual@bearingworld.test',
  fullName: 'Pilar Personaje',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: ORG_A,
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

const NOW = new Date('2026-09-22T12:00:00Z');
const hace = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const CABECERA: ThreadHeader = {
  id: 't1',
  title: 'Equivalencia FAG 6205-2RS',
  categoryId: 'c2',
  categorySlug: 'referencias-tecnicas',
  categoryName: 'Referencias técnicas',
};

const post = (over: Partial<ForumPost>): ForumPost => ({
  id: 'p',
  authorOrgId: ORG_B,
  authorOrgName: 'Nordwälz Lager',
  authorOrgCountry: 'DE',
  body: 'texto',
  createdAt: hace(60),
  reactionCount: 0,
  reactedByMe: false,
  ...over,
});

const INICIAL = post({ id: 'p1', body: 'Pregunta inicial sobre la equivalencia.', createdAt: hace(120) });
const RESPUESTA_AJENA = post({
  id: 'p2',
  authorOrgName: 'SKF Nordic AB',
  authorOrgCountry: 'SE',
  body: 'Yo lo he montado, sirve.',
  createdAt: hace(90),
});
const RESPUESTA_PROPIA = post({
  id: 'p3',
  authorOrgId: ORG_A,
  authorOrgName: 'Rodamientos Ibéricos',
  authorOrgCountry: 'ES',
  body: 'Gracias, lo pruebo mañana.',
  createdAt: hace(1),
});

beforeEach(() => {
  for (const f of [fetchThread, fetchThreadPosts, postReply, fetchForumRateLimitStatus, fetchCategories, fetchRecentThreads, fetchCategory, fetchThreads]) {
    f.mockReset();
  }
  fetchThread.mockResolvedValue(CABECERA);
  fetchForumRateLimitStatus.mockResolvedValue({ used: 1, limit: 10, secondsUntilReset: 1800 });
  postReply.mockResolvedValue(undefined);
});

function montarHilo() {
  render(
    <ForumThread
      profile={profile}
      threadId="t1"
      onBackToForum={vi.fn()}
      onBackToCategory={vi.fn()}
      now={NOW}
    />,
  );
}

const ordenDePublicaciones = () =>
  screen.getAllByTestId(/^forum-post-/).map((el) => el.getAttribute('data-testid'));

describe('community-forum/thread-and-reply-creation', () => {
  /*
   * Escenario «respuesta a hilo existente» (#2)
   *   GIVEN un miembro visualizando un hilo en FORO-03
   *   WHEN  escribe contenido en el campo de respuesta y confirma
   *   THEN  la respuesta se añade cronológicamente al final del hilo
   *   AND   se muestra con la organización autora, nunca con la persona individual
   */
  it('community-forum/thread-and-reply-creation#2 · la respuesta nueva queda la última, con su organización y sin la persona', async () => {
    fetchThreadPosts.mockResolvedValueOnce([INICIAL, RESPUESTA_AJENA]);
    montarHilo();
    await screen.findByText('Pregunta inicial sobre la equivalencia.');
    expect(ordenDePublicaciones()).toEqual(['forum-post-p1', 'forum-post-p2']);

    // Tras publicar, la base devuelve las publicaciones ordenadas por fecha ascendente
    // y la recién escrita (la más reciente) cierra la lista.
    fetchThreadPosts.mockResolvedValueOnce([INICIAL, RESPUESTA_AJENA, RESPUESTA_PROPIA]);
    fireEvent.change(screen.getByPlaceholderText('Escribe tu respuesta...'), {
      target: { value: '  Gracias, lo pruebo mañana.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));

    await waitFor(() => expect(postReply).toHaveBeenCalledWith('t1', 'Gracias, lo pruebo mañana.'));
    await screen.findByText('Gracias, lo pruebo mañana.');

    // THEN: al final, y el orden en pantalla es el cronológico de las fechas
    const orden = ordenDePublicaciones();
    expect(orden).toEqual(['forum-post-p1', 'forum-post-p2', 'forum-post-p3']);
    const fechas = [INICIAL, RESPUESTA_AJENA, RESPUESTA_PROPIA].map((p) => Date.parse(p.createdAt));
    expect([...fechas].sort((a, b) => a - b)).toEqual(fechas);

    // AND: la publicación nueva se firma con la organización...
    const nueva = screen.getByTestId('forum-post-p3');
    expect(within(nueva).getByText('Rodamientos Ibéricos')).toBeInTheDocument();
    // ... y en ningún sitio aparece la persona que la escribió
    const pagina = screen.getByTestId('forum-thread').textContent ?? '';
    expect(pagina).not.toContain('Pilar Personaje');
    expect(pagina).not.toContain('persona.individual@bearingworld.test');
  });
});

describe('community-forum/thread-and-reply-creation · identidad no visible (parte de interfaz)', () => {
  /*
   * Escenario «identidad interna registrada pero no visible» (#3)
   *   GIVEN cualquier publicación creada en el foro
   *   WHEN  el sistema almacena el registro de autoría
   *   THEN  guarda internamente qué usuario concreto escribió la publicación
   *   AND   esa información de persona individual nunca se muestra a otros miembros
   * Aquí se cubre la segunda mitad en la interfaz: aunque la fila llegue con datos de la
   * persona, la pantalla de un OTRO miembro solo pinta la organización.
   */
  it('community-forum/thread-and-reply-creation#3 · FORO-03 solo pinta la organización autora, aunque la fila traiga a la persona', async () => {
    const conPersona = {
      ...RESPUESTA_AJENA,
      authorMemberId: 'ffffffff-0000-4000-8000-0000000000aa',
      authorName: 'Greta Individual',
      authorEmail: 'greta@skf.test',
    } as ForumPost;
    fetchThreadPosts.mockResolvedValue([INICIAL, conPersona]);
    montarHilo();
    await screen.findByText('Yo lo he montado, sirve.');

    const texto = screen.getByTestId('forum-thread').textContent ?? '';
    expect(texto).toContain('SKF Nordic AB');
    expect(texto).not.toContain('Greta Individual');
    expect(texto).not.toContain('greta@skf.test');
    expect(texto).not.toContain('ffffffff-0000-4000-8000-0000000000aa');
  });
});

describe('community-forum/no-active-moderation', () => {
  /*
   * Escenario «ausencia de herramientas de moderación» (#1)
   *   GIVEN cualquier usuario o el Operador de Plataforma
   *   WHEN  busca un botón de denuncia o un panel de moderación sobre el contenido del foro
   *   THEN  no existe ningún elemento de este tipo en la interfaz en V1
   */
  const MODERACION = /denunci|report|moderac|moderar|inapropiad|abuso|abuse|flag|spam|quej|bloquear|vetar|ocultar/i;

  const controles = (raiz: HTMLElement) =>
    [
      ...raiz.querySelectorAll('button, a, [role="button"], [role="link"], [role="menuitem"]'),
    ].map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`);

  it('community-forum/no-active-moderation#1 · ni FORO-01, ni FORO-02, ni FORO-03 tienen denuncia ni moderación, y el Operador no tiene sección para ello', async () => {
    // FORO-03 con publicaciones propias y ajenas
    fetchThreadPosts.mockResolvedValue([INICIAL, RESPUESTA_AJENA, RESPUESTA_PROPIA]);
    const hilo = render(
      <ForumThread profile={profile} threadId="t1" onBackToForum={vi.fn()} onBackToCategory={vi.fn()} now={NOW} />,
    );
    await screen.findByText('Yo lo he montado, sirve.');
    const enHilo = controles(hilo.container);
    expect(enHilo.length).toBeGreaterThan(3); // hay controles reales que mirar (reaccionar, Editar...)
    expect(enHilo.filter((t) => MODERACION.test(t))).toEqual([]);
    hilo.unmount();

    // FORO-02 (lista de hilos de la categoría)
    fetchCategory.mockResolvedValue({
      id: 'c2', slug: 'referencias-tecnicas', name: 'Referencias técnicas', description: 'd',
      position: 2, threadCount: 1, postCount: 2, lastActivityAt: hace(5),
    });
    fetchThreads.mockResolvedValue({
      rows: [{ id: 't1', title: 'Equivalencia FAG 6205-2RS', authorOrgName: 'SKF Nordic AB', replyCount: 1, reactionCount: 3, lastPostAt: hace(5) }],
      total: 1, page: 1, pageCount: 1,
    });
    const cat = render(
      <ForumCategory profile={profile} slug="referencias-tecnicas" onBack={vi.fn()} onOpenThread={vi.fn()} now={NOW} />,
    );
    await screen.findByRole('button', { name: 'Equivalencia FAG 6205-2RS' });
    const enCategoria = controles(cat.container);
    expect(enCategoria.length).toBeGreaterThan(1);
    expect(enCategoria.filter((t) => MODERACION.test(t))).toEqual([]);
    cat.unmount();

    // FORO-01 (categorías)
    fetchCategories.mockResolvedValue([
      { id: 'c2', slug: 'referencias-tecnicas', name: 'Referencias técnicas', description: 'd', position: 2, threadCount: 1, postCount: 2, lastActivityAt: hace(5) },
    ]);
    fetchRecentThreads.mockResolvedValue([]);
    const foro = render(<Forum profile={profile} now={NOW} onOpenCategory={vi.fn()} />);
    await screen.findByText('Referencias técnicas');
    expect(controles(foro.container).filter((t) => MODERACION.test(t))).toEqual([]);
    foro.unmount();

    // El Operador de Plataforma: su navegación no tiene panel de moderación ni de foro.
    expect(OPERATOR_NAV_ITEMS.map((i) => i.label).filter((l) => MODERACION.test(l) || /foro/i.test(l))).toEqual([]);
  });
});
