import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PARCIALES · community-forum (capa de datos). Escrito desde la spec
 * (`openspec/specs/community-forum/spec.md`), no desde el comportamiento del código.
 * Sin red: `supabase` es un doble que registra las llamadas.
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
    rpc: (fn: string) => {
      llamadas.push({ metodo: 'rpc', args: [fn] });
      return Promise.resolve({ data: [], error: null });
    },
  },
}));

const { fetchThreadPosts, fetchThreads, fetchThread, fetchRecentThreads, reactToPost, unreactToPost, toForumPost } =
  await import('./forum');

beforeEach(() => {
  llamadas = [];
  respuestas = [];
});

const raiz = resolve(process.cwd(), '..');
function migraciones(): { nombre: string; sql: string }[] {
  const dir = join(raiz, 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(join(dir, nombre), 'utf8') }));
}
const sinComentarios = (sql: string) => sql.replace(/--.*$/gm, '');

describe('community-forum/thread-and-reply-creation#3 · la persona no sale de la capa de datos', () => {
  /*
   * GIVEN cualquier publicación creada en el foro
   * WHEN  el sistema almacena el registro de autoría
   * THEN  guarda internamente qué usuario concreto escribió la publicación
   * AND   esa información de persona individual nunca se muestra a otros miembros
   * Parte comprobable sin base: ninguna consulta de lectura del cliente pide la columna de
   * la persona (`author_member_id`) y el mapeo no la arrastra aunque la fila la trajera.
   */
  it('community-forum/thread-and-reply-creation#3 · ninguna lectura del foro pide ni conserva la persona autora', async () => {
    respuestas = [
      { data: [], error: null },
      { data: [], error: null, count: 0 },
      { data: null, error: null },
      { data: [], error: null },
    ];
    await fetchThreadPosts('t1');
    await fetchThreads({ categoryId: 'c1', search: '', page: 1 });
    await fetchThread('t1');
    await fetchRecentThreads();

    const columnas = llamadas.filter((l) => l.metodo === 'select').map((l) => String(l.args[0]));
    expect(columnas.length).toBeGreaterThanOrEqual(4);
    for (const c of columnas) {
      expect(c).not.toMatch(/author_member|member_id|author_user|full_name|email/i);
    }

    // y si una fila llegara con la persona, el mapeo no la arrastra a lo que se pinta
    const post = toForumPost({
      id: 'p1',
      author_org_id: 'o1',
      author_org_name: 'Nordwälz Lager',
      author_org_country: 'DE',
      body: 'x',
      created_at: '2026-09-06T11:12:14Z',
      reaction_count: 0,
      reacted_by_me: false,
      author_member_id: 'm-secreto',
      author_name: 'Persona Concreta',
    } as unknown as Parameters<typeof toForumPost>[0]);
    expect(JSON.stringify(post)).not.toMatch(/m-secreto|Persona Concreta/);
  });

  it('community-forum/thread-and-reply-creation#3 · las vistas que alimentan FORO-02/03 no seleccionan la persona', () => {
    const vistas = migraciones()
      .map((m) => sinComentarios(m.sql))
      .join('\n')
      .match(/create (?:or replace )?view public\.forum_\w+[\s\S]*?;/gi);
    expect(vistas && vistas.length).toBeGreaterThanOrEqual(3); // category_stats, thread_list, post_detail
    for (const v of vistas ?? []) {
      expect(v).not.toMatch(/author_member_id/i);
    }
  });
});

describe('community-forum/reactions', () => {
  /*
   * Escenario «reacciones independientes por organización» (#2)
   *   GIVEN dos usuarios de la misma organización que reaccionan a la misma publicación
   *   WHEN  se contabilizan las reacciones
   *   THEN  cuentan como dos reacciones distintas, no como una
   * Parte comprobable sin base: la unidad de reacción es el usuario. La clave de la tabla
   * es (post, miembro) y el recuento cuenta miembros; ningún artefacto agrupa por organización.
   */
  it('community-forum/reactions#2 · la reacción es por usuario: clave (post, miembro) y recuento por miembro, nunca por organización', () => {
    const todo = migraciones()
      .map((m) => sinComentarios(m.sql))
      .join('\n');

    const tabla = todo.match(/create table public\.forum_reactions\s*\(([\s\S]*?)\n\);/i)?.[1] ?? '';
    expect(tabla).toMatch(/primary key \(post_id, member_id\)/i);
    expect(tabla).not.toMatch(/org/i);
    expect(todo).not.toMatch(/unique[^;]*forum_reactions[^;]*org|forum_reactions[^;]*unique[^;]*org/i);

    const vistaDetalle = todo.match(/create view public\.forum_post_detail[\s\S]*?;/i)?.[0] ?? '';
    expect(vistaDetalle).toMatch(/count\(r\.member_id\)/i);
    expect(vistaDetalle).not.toMatch(/count\(distinct[^)]*org/i);
  });

  /*
   * Escenario «reacciones sin efecto en ordenación» (#3)
   *   GIVEN un hilo con un alto número de reacciones acumuladas
   *   WHEN  se calcula el orden de los hilos en FORO-02
   *   THEN  las reacciones no influyen en absoluto en esa ordenación
   *   AND   tampoco afectan al sistema de Favoritos de conversational-search
   */
  it('community-forum/reactions#3 · reaccionar solo escribe en forum_reactions: ni toca Favoritos ni existe disparador que los una', async () => {
    respuestas = [{ data: null, error: null }, { data: null, error: null }];
    await reactToPost('post-1');
    await unreactToPost('post-1');
    const tablas = llamadas.filter((l) => l.metodo === 'from').map((l) => l.args[0]);
    expect(tablas).toEqual(['forum_reactions', 'forum_reactions']);

    // En la base: ninguna función ni disparador mira a la vez reacciones y favoritos.
    const sql = migraciones().map((m) => sinComentarios(m.sql));
    const bloques = sql
      .join('\n')
      .split(/^(?=\s*(?:create|alter|drop|grant|revoke|comment on)\b)/im)
      .filter((b) => /^\s*create (?:or replace )?(?:function|trigger|view|materialized view)/i.test(b));
    expect(bloques.length).toBeGreaterThan(20); // se miran las funciones, disparadores y vistas de verdad
    const cruzados = bloques.filter((b) => /forum_reactions/i.test(b) && /favorite_distributors/i.test(b));
    expect(cruzados).toEqual([]);
    // y la tabla de favoritos no referencia nada del foro
    const tablaFav = sql.join('\n').match(/create table public\.favorite_distributors\s*\(([\s\S]*?)\n\);/i)?.[1] ?? '';
    expect(tablaFav).toMatch(/org/i);
    expect(tablaFav).not.toMatch(/forum_/i);
  });

  it('community-forum/reactions#3 · el orden de FORO-02 no admite reacciones aunque el hilo con más sea el más antiguo', async () => {
    // Hilos de la categoría; el servidor devuelve lo que ordena la consulta. Si la consulta
    // incluyera `reaction_count` en el orden, aparecería en las llamadas a `order`.
    respuestas = [{ data: [], error: null, count: 0 }];
    await fetchThreads({ categoryId: 'c1', search: '', page: 1 });
    const ordenes = llamadas.filter((l) => l.metodo === 'order').map((l) => String(l.args[0]));
    expect(ordenes.length).toBeGreaterThan(0);
    expect(ordenes).not.toContain('reaction_count');
    expect(ordenes[0]).toBe('last_post_at');
  });
});
