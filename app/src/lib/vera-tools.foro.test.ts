import { describe, expect, it, vi } from 'vitest';
import { runTool, type ToolContext } from './vera-tools';

/** Un contexto mínimo: solo lo que estas dos herramientas leen. El resto no se llama desde el foro. */
function contexto(extra: Partial<ToolContext> = {}): ToolContext {
  return {
    profile: {} as ToolContext['profile'],
    navigate: vi.fn(),
    setCriteria: vi.fn(),
    threadOpen: false,
    prepareDraft: vi.fn(),
    ...extra,
  };
}

describe('resumir_hilo_foro · solo el hilo abierto en pantalla, y solo texto', () => {
  it('sin hilo del foro abierto, no lee nada y lo dice', async () => {
    const leer = vi.fn();
    const r = await runTool('resumir_hilo_foro', {}, contexto({ readForumThread: leer }));
    expect(r.isError).toBe(true);
    expect(leer).not.toHaveBeenCalled();
  });

  it('con el hilo abierto, devuelve título y publicaciones en orden, con su autor', async () => {
    const leer = vi.fn(async () => ({
      title: 'Juntas de eje',
      posts: [
        { author: 'Nordwälz Lager', date: '2026-10-01', body: 'Pregunta por juntas.' },
        { author: 'Rey Transmisiones', date: '2026-10-02', body: 'Tenemos stock en Madrid.' },
      ],
    }));
    const r = await runTool('resumir_hilo_foro', {}, contexto({ forumThreadId: 'h1', readForumThread: leer }));
    expect(leer).toHaveBeenCalledWith('h1');
    expect(r.isError).toBe(false);
    expect(r.content).toContain('«Juntas de eje», 2 publicaciones');
    expect(r.content.indexOf('Pregunta por juntas')).toBeLessThan(r.content.indexOf('Tenemos stock'));
    expect(r.content).toContain('[Nordwälz Lager');
  });

  it('un hilo enorme se recorta en publicaciones y en caracteres, y lo dice', async () => {
    const posts = Array.from({ length: 60 }, (_, i) => ({ author: 'A', date: 'd', body: `p${i} ` + 'x'.repeat(400) }));
    const leer = vi.fn(async () => ({ title: 'Largo', posts }));
    const r = await runTool('resumir_hilo_foro', {}, contexto({ forumThreadId: 'h2', readForumThread: leer }));
    expect(r.content).toContain('Solo se incluyen las primeras 40');
    expect(r.content).toContain('[texto recortado por longitud]');
  });
});

describe('preparar_hilo_foro · redacta el borrador, nunca publica', () => {
  it('fuera de una categoría, no abre nada', async () => {
    const preparar = vi.fn();
    const r = await runTool('preparar_hilo_foro', { titulo: 'Un título válido', cuerpo: 'Un cuerpo de más de diez' }, contexto({ prepareForumDraft: preparar }));
    expect(r.isError).toBe(true);
    expect(preparar).not.toHaveBeenCalled();
  });

  it('con un título o cuerpo fuera de rango, lo rechaza sin abrir el formulario', async () => {
    const preparar = vi.fn();
    const r = await runTool('preparar_hilo_foro', { titulo: 'Hi', cuerpo: 'corto' }, contexto({ forumCategorySlug: 'rodamientos', prepareForumDraft: preparar }));
    expect(r.isError).toBe(true);
    expect(preparar).not.toHaveBeenCalled();
  });

  it('con datos válidos, deja el borrador y dice que NO está publicado', async () => {
    const preparar = vi.fn();
    const r = await runTool(
      'preparar_hilo_foro',
      { titulo: 'Juntas de eje para bombas', cuerpo: 'Busco juntas de eje para bombas centrífugas.' },
      contexto({ forumCategorySlug: 'rodamientos', prepareForumDraft: preparar }),
    );
    expect(r.isError).toBe(false);
    expect(preparar).toHaveBeenCalledWith({
      title: 'Juntas de eje para bombas',
      body: 'Busco juntas de eje para bombas centrífugas.',
    });
    expect(r.content).toContain('NO está publicado');
  });
});
