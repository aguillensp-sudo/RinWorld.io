import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampThreadPage,
  fetchCategory,
  fetchThreads,
  reactionLabel,
  replyCountLabel,
  THREADS_PAGE_SIZE,
  threadPageCount,
  toThreadRow,
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
