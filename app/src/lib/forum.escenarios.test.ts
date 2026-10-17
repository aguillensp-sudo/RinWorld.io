import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS · community-forum/not-e2ee-content
 *
 * Escrito desde la spec: el contenido del foro se guarda en texto plano, legible
 * por el servidor, a diferencia de la mensajería. Dos mitades, las dos en unit:
 *
 *  · el cliente envía el cuerpo TAL CUAL, sin cifrar ni envolver (lo que llega al
 *    servidor es exactamente lo que escribió el miembro);
 *  · el esquema que lo recibe guarda `body` como `text` y no tiene columnas de
 *    cifrado (`*_ciphertext`, `*_iv`).
 *
 * Lo que un unit NO puede hacer es inspeccionar el almacenamiento real: la
 * segunda mitad es una lectura estática de la migración.
 */

const insertados: { tabla: string; fila: Record<string, unknown> }[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
      insert: (fila: Record<string, unknown>) => {
        insertados.push({ tabla, fila });
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

const { postReply, toForumPost } = await import('./forum');

function migracionesDelForo(): string {
  const dir = resolve(process.cwd(), '..', 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .filter((sql) => /create table public\.forum_posts\b/i.test(sql))
    .join('\n');
}

describe('community-forum/not-e2ee-content', () => {
  it('community-forum/not-e2ee-content#1 · contenido legible por el servidor', () => {
    // GIVEN cualquier publicación del foro
    const texto = 'Equivalencia FAG 6205-2RS con NSK 6205DDU, ¿alguien la ha usado?';

    // WHEN se inspecciona su almacenamiento en servidor (lo que el cliente le entrega)
    return postReply('11111111-1111-4111-8111-111111111111', texto).then(() => {
      const envio = insertados.find((i) => i.tabla === 'forum_posts');
      expect(envio).toBeDefined();
      // THEN el contenido llega en texto plano: el mismo string, sin cifrar
      expect(envio!.fila.body).toBe(texto);
      // y no hay material de cifrado de ningún tipo en lo enviado
      const claves = Object.keys(envio!.fila).join(',');
      expect(claves).not.toMatch(/cipher|iv|wrapped|nonce|key/i);

      // El esquema que lo guarda: `body text`, sin columnas de cifrado
      const sql = migracionesDelForo();
      const definicion = sql.slice(sql.search(/create table public\.forum_posts\b/i));
      const cuerpoTabla = definicion
        .slice(0, definicion.indexOf(');'))
        .replace(/--.*$/gm, ''); // sin comentarios SQL: solo las columnas
      expect(cuerpoTabla).toMatch(/\bbody\s+text\s+not null/i);
      expect(cuerpoTabla).not.toMatch(/ciphertext|_iv\b|bytea/i);
    });
  });

  it('community-forum/not-e2ee-content#1 · lo que lee el cliente es el mismo texto plano', () => {
    const texto = 'Respuesta en claro, con acentos: información técnica.';
    const post = toForumPost({
      id: 'p1',
      author_org_id: 'o1',
      author_org_name: 'Nordwälz Lager',
      author_org_country: 'DE',
      body: texto,
      created_at: '2026-09-06T11:12:14Z',
      reaction_count: 0,
      reacted_by_me: false,
    } as never);
    expect(post.body).toBe(texto);
  });
});
