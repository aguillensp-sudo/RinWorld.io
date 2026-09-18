import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampThreadPage,
  fetchCategory,
  fetchForumRateLimitStatus,
  fetchThread,
  fetchThreadPosts,
  fetchThreads,
  postReply,
  rateLimitMinutesLabel,
  rateLimitReached,
  reactionLabel,
  reactToPost,
  replyCountLabel,
  THREADS_PAGE_SIZE,
  threadPageCount,
  toForumPost,
  toThreadHeader,
  toThreadRow,
  unreactToPost,
} from './forum';

/**
 * La capa de datos de FORO-02: lógica pura y CONSULTAS.
 *
 * La escribe Claude Code, no el Coder: no es el contrato del arnés. Las consultas
 * se prueban porque lo que falla en ellas no da error, da otra lista: un filtro de
 * categoría que falta enseña los hilos de todo el foro, y un orden al revés
 * parece un foro sin actividad reciente.
 *
 * Mismo mock encadenado por `Proxy` que `panel.queries.test.ts`.
 */

interface Llamada {
  metodo: string;
  args: unknown[];
}

let llamadas: Llamada[] = [];
let respuestas: unknown[] = [];
let respuestaRpc: unknown = { data: [], error: null };

function cadena(): unknown {
  const api: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const r = respuestas.shift() ?? { data: [], error: null, count: 0 };
          return (res: (v: unknown) => void) => res(r);
        }
        return (...args: unknown[]) => {
          llamadas.push({ metodo: prop, args });
          return api;
        };
      },
    },
  );
  return api;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      llamadas.push({ metodo: 'from', args: [tabla] });
      return cadena();
    },
    rpc: (fn: string, args?: unknown) => {
      llamadas.push({ metodo: 'rpc', args: [fn, args] });
      return Promise.resolve(respuestaRpc);
    },
  },
}));

function seLlamo(metodo: string, ...args: unknown[]): boolean {
  return llamadas.some(
    (l) => l.metodo === metodo && args.every((a, i) => JSON.stringify(l.args[i]) === JSON.stringify(a)),
  );
}

const CATEGORIA = '33330000-0000-4000-8000-000000000002';

function fila(over: Record<string, unknown> = {}) {
  return {
    id: '44440000-0000-4000-8000-00000000c003',
    title: 'Equivalencia FAG 6205-2RS ↔ NSK',
    author_org_name: 'Nordwälz Lager',
    reply_count: 3,
    reaction_count: 3,
    last_post_at: '2026-09-06T11:12:14Z',
    ...over,
  };
}

beforeEach(() => {
  llamadas = [];
  respuestas = [];
  respuestaRpc = { data: [], error: null };
});

describe('los contadores de la fila', () => {
  it('se leen como los escribe la spec', () => {
    expect(replyCountLabel(3)).toBe('3 respuestas');
    expect(reactionLabel(5)).toBe('👍 5');
  });

  it('un hilo sin respuestas dice cero, y el singular no dice "1 respuestas"', () => {
    expect(replyCountLabel(0)).toBe('0 respuestas');
    expect(replyCountLabel(1)).toBe('1 respuesta');
    expect(reactionLabel(0)).toBe('👍 0');
  });
});

describe('la paginación', () => {
  it('son veinte hilos por página', () => {
    expect(THREADS_PAGE_SIZE).toBe(20);
  });

  it('cero hilos es UNA página vacía, no cero páginas', () => {
    expect(threadPageCount(0)).toBe(1);
    expect(threadPageCount(20)).toBe(1);
    expect(threadPageCount(21)).toBe(2);
  });

  it('una página que no existe se encaja en la que sí', () => {
    expect(clampThreadPage(3, 21)).toBe(2);
    expect(clampThreadPage(0, 21)).toBe(1);
    expect(clampThreadPage(Number.NaN, 21)).toBe(1);
  });
});

describe('el mapeo de la fila', () => {
  it('trae lo que pinta la fila, con los contadores como número', () => {
    expect(toThreadRow(fila({ reply_count: '3', reaction_count: '7' }))).toEqual({
      id: '44440000-0000-4000-8000-00000000c003',
      title: 'Equivalencia FAG 6205-2RS ↔ NSK',
      authorOrgName: 'Nordwälz Lager',
      replyCount: 3,
      reactionCount: 7,
      lastPostAt: '2026-09-06T11:12:14Z',
    });
  });

  it('una organización que no se pudo leer no rompe la fila', () => {
    expect(toThreadRow(fila({ author_org_name: null })).authorOrgName).toBe('');
  });
});

describe('fetchCategory', () => {
  it('busca por slug en la vista de contadores', async () => {
    respuestas = [{ data: null, error: null }];
    await fetchCategory('referencias-tecnicas');
    expect(seLlamo('from', 'forum_category_stats')).toBe(true);
    expect(seLlamo('eq', 'slug', 'referencias-tecnicas')).toBe(true);
    expect(seLlamo('maybeSingle')).toBe(true);
  });

  it('un slug que no existe devuelve null, no una categoría vacía', async () => {
    respuestas = [{ data: null, error: null }];
    expect(await fetchCategory('no-existe')).toBeNull();
  });
});

describe('fetchThreads', () => {
  it('lee de la vista de la lista, filtra por categoría y pide el total', async () => {
    respuestas = [{ data: [fila()], error: null, count: 1 }];
    const r = await fetchThreads({ categoryId: CATEGORIA, search: '', page: 1 });
    expect(seLlamo('from', 'forum_thread_list')).toBe(true);
    expect(seLlamo('eq', 'category_id', CATEGORIA)).toBe(true);
    expect(llamadas.find((l) => l.metodo === 'select')?.args[1]).toEqual({ count: 'exact' });
    expect(r).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    expect(r.rows[0]?.replyCount).toBe(3);
  });

  it('⚠ ordena SIEMPRE por actividad reciente, con desempate estable', async () => {
    respuestas = [{ data: [], error: null, count: 0 }];
    await fetchThreads({ categoryId: CATEGORIA, search: '', page: 1 });
    const ordenes = llamadas.filter((l) => l.metodo === 'order').map((l) => l.args);
    expect(ordenes).toEqual([
      ['last_post_at', { ascending: false }],
      ['id', { ascending: true }],
    ]);
    expect(llamadas.some((l) => l.metodo === 'order' && /reaction/.test(String(l.args[0])))).toBe(false);
  });

  it('sin texto no filtra por título; con texto, ilike sobre el título y solo sobre él', async () => {
    respuestas = [{ data: [], error: null, count: 0 }];
    await fetchThreads({ categoryId: CATEGORIA, search: '   ', page: 1 });
    expect(llamadas.some((l) => l.metodo === 'ilike')).toBe(false);

    llamadas = [];
    respuestas = [{ data: [], error: null, count: 0 }];
    await fetchThreads({ categoryId: CATEGORIA, search: ' 6205 ', page: 1 });
    expect(seLlamo('ilike', 'title', '%6205%')).toBe(true);
    expect(llamadas.filter((l) => l.metodo === 'ilike')).toHaveLength(1);
  });

  it('la sintaxis de filtros de PostgREST no se cuela desde el buscador', async () => {
    respuestas = [{ data: [], error: null, count: 0 }];
    await fetchThreads({ categoryId: CATEGORIA, search: 'a,b(c)', page: 1 });
    expect(seLlamo('ilike', 'title', '%abc%')).toBe(true);
  });

  it('la página 2 pide las filas 20 a 39', async () => {
    respuestas = [{ data: [], error: null, count: 45 }];
    const r = await fetchThreads({ categoryId: CATEGORIA, search: '', page: 2 });
    expect(seLlamo('range', 20, 39)).toBe(true);
    expect(r).toMatchObject({ page: 2, pageCount: 3, total: 45 });
  });

  it('una página que ya no existe se vuelve a pedir en la última que sí', async () => {
    respuestas = [
      { data: [], error: null, count: 5 },
      { data: [fila()], error: null, count: 5 },
    ];
    const r = await fetchThreads({ categoryId: CATEGORIA, search: 'FAG', page: 3 });
    expect(seLlamo('range', 40, 59)).toBe(true);
    expect(seLlamo('range', 0, 19)).toBe(true);
    expect(r).toMatchObject({ page: 1, pageCount: 1, total: 5 });
    expect(r.rows).toHaveLength(1);
  });

  it('un error de la base se lanza, no se pinta como lista vacía', async () => {
    respuestas = [{ data: null, error: { message: 'boom' }, count: null }];
    await expect(fetchThreads({ categoryId: CATEGORIA, search: '', page: 1 })).rejects.toEqual({ message: 'boom' });
  });
});

// -----------------------------------------------------------------------------
// FORO-03 · el hilo, sus publicaciones, responder y reaccionar
// -----------------------------------------------------------------------------

const HILO = '22220000-0000-4000-8000-00000000bbb1';

function cabeceraCruda(over: Record<string, unknown> = {}) {
  return {
    id: HILO,
    title: 'Equivalencia FAG 6205-2RS ↔ NSK',
    category_id: CATEGORIA,
    forum_categories: { slug: 'referencias-tecnicas', name: 'Referencias técnicas' },
    ...over,
  };
}

function publicacionCruda(over: Record<string, unknown> = {}) {
  return {
    id: '55550000-0000-4000-8000-000000000001',
    author_org_id: '11111111-1111-1111-1111-111111111111',
    author_org_name: 'SKF Nordic AB',
    author_org_country: 'se',
    body: 'Hola a todos.',
    created_at: '2026-09-13T09:00:00Z',
    reaction_count: 5,
    reacted_by_me: false,
    ...over,
  };
}

describe('el mapeo de la cabecera y de la publicación', () => {
  it('toThreadHeader trae lo que arma el breadcrumb', () => {
    expect(toThreadHeader(cabeceraCruda())).toEqual({
      id: HILO,
      title: 'Equivalencia FAG 6205-2RS ↔ NSK',
      categoryId: CATEGORIA,
      categorySlug: 'referencias-tecnicas',
      categoryName: 'Referencias técnicas',
    });
  });

  it('una categoría que no se pudo leer no rompe la cabecera', () => {
    expect(toThreadHeader(cabeceraCruda({ forum_categories: null }))).toMatchObject({
      categorySlug: '',
      categoryName: '',
    });
  });

  it('toForumPost pone el país en mayúsculas y los contadores como número', () => {
    expect(toForumPost(publicacionCruda({ reaction_count: '5' }))).toEqual({
      id: '55550000-0000-4000-8000-000000000001',
      authorOrgId: '11111111-1111-1111-1111-111111111111',
      authorOrgName: 'SKF Nordic AB',
      authorOrgCountry: 'SE',
      body: 'Hola a todos.',
      createdAt: '2026-09-13T09:00:00Z',
      reactionCount: 5,
      reactedByMe: false,
    });
  });

  it('reactedByMe solo es true si la fila lo dice, nunca por un valor a medias', () => {
    expect(toForumPost(publicacionCruda({ reacted_by_me: true })).reactedByMe).toBe(true);
    expect(toForumPost(publicacionCruda({ reacted_by_me: null })).reactedByMe).toBe(false);
  });
});

describe('fetchThread', () => {
  it('busca por id, con la categoría anidada', async () => {
    respuestas = [{ data: cabeceraCruda(), error: null }];
    await fetchThread(HILO);
    expect(seLlamo('from', 'forum_threads')).toBe(true);
    expect(seLlamo('eq', 'id', HILO)).toBe(true);
    expect(seLlamo('maybeSingle')).toBe(true);
  });

  it('un hilo que no existe devuelve null', async () => {
    respuestas = [{ data: null, error: null }];
    expect(await fetchThread('no-existe')).toBeNull();
  });
});

describe('fetchThreadPosts', () => {
  it('lee de forum_post_detail, filtra por hilo y ordena cronológico ascendente', async () => {
    respuestas = [{ data: [publicacionCruda()], error: null }];
    const filas = await fetchThreadPosts(HILO);
    expect(seLlamo('from', 'forum_post_detail')).toBe(true);
    expect(seLlamo('eq', 'thread_id', HILO)).toBe(true);
    expect(seLlamo('order', 'created_at', { ascending: true })).toBe(true);
    expect(filas[0]?.authorOrgName).toBe('SKF Nordic AB');
  });

  it('la primera fila ES la publicación inicial -- ningún hilo se crea sin ella', async () => {
    respuestas = [
      {
        data: [
          publicacionCruda({ id: 'inicial', created_at: '2026-09-13T09:00:00Z' }),
          publicacionCruda({ id: 'respuesta-1', created_at: '2026-09-13T10:00:00Z' }),
        ],
        error: null,
      },
    ];
    const filas = await fetchThreadPosts(HILO);
    expect(filas[0]?.id).toBe('inicial');
    expect(filas[1]?.id).toBe('respuesta-1');
  });

  it('un error de la base se lanza', async () => {
    respuestas = [{ data: null, error: { message: 'boom' } }];
    await expect(fetchThreadPosts(HILO)).rejects.toEqual({ message: 'boom' });
  });
});

describe('postReply', () => {
  it('inserta SOLO thread_id y body -- la autoría la pone la base', async () => {
    respuestas = [{ data: null, error: null }];
    await postReply(HILO, 'Mi respuesta.');
    expect(seLlamo('from', 'forum_posts')).toBe(true);
    expect(seLlamo('insert', { thread_id: HILO, body: 'Mi respuesta.' })).toBe(true);
  });

  it('un error de la base se lanza, no se traga en silencio', async () => {
    respuestas = [{ data: null, error: { message: 'RNG-FORO-06' } }];
    await expect(postReply(HILO, 'x')).rejects.toEqual({ message: 'RNG-FORO-06' });
  });
});

describe('reactToPost / unreactToPost', () => {
  it('reaccionar inserta solo el post_id -- la firma la pone la base', async () => {
    respuestas = [{ data: null, error: null }];
    await reactToPost('post-1');
    expect(seLlamo('from', 'forum_reactions')).toBe(true);
    expect(seLlamo('insert', { post_id: 'post-1' })).toBe(true);
  });

  it('quitar la reacción filtra por post_id -- la RLS ya restringe a la propia', async () => {
    respuestas = [{ data: null, error: null }];
    await unreactToPost('post-1');
    expect(seLlamo('delete')).toBe(true);
    expect(seLlamo('eq', 'post_id', 'post-1')).toBe(true);
  });
});

describe('fetchForumRateLimitStatus', () => {
  it('llama al envoltorio público, no a app.forum_rate_limit_status directamente', async () => {
    respuestaRpc = { data: [{ used: 3, limit: 10, seconds_until_reset: 120 }], error: null };
    const estado = await fetchForumRateLimitStatus();
    expect(seLlamo('rpc', 'forum_rate_limit_status')).toBe(true);
    expect(estado).toEqual({ used: 3, limit: 10, secondsUntilReset: 120 });
  });

  it('sin fila (nunca debería pasar) cae a 0 de 10, no revienta', async () => {
    respuestaRpc = { data: [], error: null };
    expect(await fetchForumRateLimitStatus()).toEqual({ used: 0, limit: 10, secondsUntilReset: 0 });
  });

  it('un error de la base se lanza', async () => {
    respuestaRpc = { data: null, error: { message: 'boom' } };
    await expect(fetchForumRateLimitStatus()).rejects.toEqual({ message: 'boom' });
  });
});

describe('rateLimitReached / rateLimitMinutesLabel', () => {
  it('alcanzado es used >= limit, no used > limit', () => {
    expect(rateLimitReached({ used: 9, limit: 10, secondsUntilReset: 60 })).toBe(false);
    expect(rateLimitReached({ used: 10, limit: 10, secondsUntilReset: 60 })).toBe(true);
  });

  it('redondea siempre hacia arriba: un segundo sigue siendo "1 minuto", nunca "0"', () => {
    expect(rateLimitMinutesLabel(1)).toBe('1 minuto');
    expect(rateLimitMinutesLabel(60)).toBe('1 minuto');
    expect(rateLimitMinutesLabel(61)).toBe('2 minutos');
    expect(rateLimitMinutesLabel(0)).toBe('1 minuto');
  });
});
