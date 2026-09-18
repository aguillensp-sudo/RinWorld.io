import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Category, ThreadPage, ThreadQuery } from '../../lib/forum';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-02 · pantalla (`ForumCategory`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las dos funciones de red de `lib/forum` (`fetchCategory`,
 * `fetchThreads`); `relativeShort`, `replyCountLabel`, `reactionLabel` y el
 * resto siguen siendo los de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe
 * `app/e2e/forum-category.spec.ts`: que el orden y los contadores salgan de la
 * base (`forum_thread_list`, 0030) y no de un cálculo en el cliente.
 */

const fetchCategory = vi.fn<(slug: string) => Promise<Category | null>>();
const fetchThreads = vi.fn<(q: ThreadQuery) => Promise<ThreadPage>>();

vi.mock('../../lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/forum')>()),
  fetchCategory: (slug: string) => fetchCategory(slug),
  fetchThreads: (q: ThreadQuery) => fetchThreads(q),
}));

const { ForumCategory } = await import('./ForumCategory');

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

const NOW = new Date('2026-09-11T12:00:00Z');
const hace = (horas: number) => new Date(NOW.getTime() - horas * 3_600_000).toISOString();

const CATEGORIA: Category = {
  id: 'c2',
  slug: 'referencias-tecnicas',
  name: 'Referencias técnicas',
  description: 'Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias.',
  position: 2,
  threadCount: 4,
  postCount: 15,
  lastActivityAt: hace(5),
};

/** Ya en el orden del servidor: la pantalla NO reordena. */
const PAGINA: ThreadPage = {
  rows: [
    { id: 't1', title: 'Equivalencia FAG 6205-2RS ↔ NSK', authorOrgName: 'SKF Nordic AB', replyCount: 3, reactionCount: 5, lastPostAt: hace(5) },
    { id: 't2', title: '¿Alguien sabe el equivalente NSK de 22316-E?', authorOrgName: 'Rodamientos del Sur SL', replyCount: 1, reactionCount: 2, lastPostAt: hace(24) },
    { id: 't3', title: 'Diferencia entre 6205-2RS y 6205-2RS/C3', authorOrgName: 'NTN-SNR Roulements', replyCount: 7, reactionCount: 12, lastPostAt: hace(48) },
    { id: 't4', title: 'Sustitución NU2210-E por alternativa', authorOrgName: 'Timken Europe GmbH', replyCount: 0, reactionCount: 0, lastPostAt: hace(72) },
  ],
  total: 4,
  page: 1,
  pageCount: 1,
};

const VACIA: ThreadPage = { rows: [], total: 0, page: 1, pageCount: 1 };

const CREAR_TITLE = 'El formulario de creación de hilo (FL-FORO-01) llega en una próxima versión.';

function montar(onBack = vi.fn(), onOpenThread = vi.fn()) {
  render(
    <ForumCategory
      profile={profile}
      slug="referencias-tecnicas"
      onBack={onBack}
      onOpenThread={onOpenThread}
      now={NOW}
    />,
  );
  return { onBack, onOpenThread };
}

/** Espera a que la lista haya llegado: leer antes encuentra cero filas (F-159). */
async function listo() {
  await screen.findByRole('button', { name: 'Equivalencia FAG 6205-2RS ↔ NSK' });
}

beforeEach(() => {
  fetchCategory.mockReset();
  fetchThreads.mockReset();
  fetchCategory.mockResolvedValue(CATEGORIA);
  fetchThreads.mockResolvedValue(PAGINA);
});

describe('FORO-02 · al montar', () => {
  it('pide la categoría por su slug y la página 1 de sus hilos, sin búsqueda', async () => {
    montar();
    await listo();
    expect(fetchCategory).toHaveBeenCalledWith('referencias-tecnicas');
    expect(fetchThreads).toHaveBeenCalledWith({ categoryId: 'c2', search: '', page: 1 });
  });

  it('la raíz lleva `data-testid="forum-category"` y el slug, que es lo que ancla FORO-01', async () => {
    montar();
    await listo();
    const raiz = screen.getByTestId('forum-category');
    expect(raiz).toHaveAttribute('data-slug', 'referencias-tecnicas');
  });

  it('mientras carga, dice que carga con `aria-busy`', () => {
    fetchThreads.mockReturnValue(new Promise(() => {}));
    montar();
    const cargando = screen.getByText('Cargando hilos…');
    expect(cargando).toHaveAttribute('aria-busy', 'true');
  });
});

describe('FORO-02 · cabecera (spec §3)', () => {
  it('eyebrow, título con el nombre de la categoría y subtítulo con su descripción', async () => {
    montar();
    await listo();
    expect(screen.getByText('Módulo 08 · Foro de la Comunidad')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Referencias técnicas' })).toBeInTheDocument();
    expect(screen.getByText(CATEGORIA.description)).toBeInTheDocument();
  });

  it('el breadcrumb "Foros" vuelve a FORO-01', async () => {
    const { onBack } = montar();
    await listo();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Foros' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(within(nav).getByText('Referencias técnicas')).toBeInTheDocument();
  });

  it('el aviso de confidencialidad es el mismo bloque permanente de FORO-01', async () => {
    montar();
    await listo();
    const negrita = screen.getByText('Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.');
    expect(negrita.tagName).toBe('STRONG');
    expect(negrita.parentElement).toHaveTextContent(
      'El contenido publicado en el Foro es texto plano, visible para todos los miembros de Bearingworld.io.',
    );
  });

  it('"Crear hilo" está apagado -FL-FORO-01 no existe todavía- y lo dice', async () => {
    montar();
    await listo();
    const crear = screen.getByRole('button', { name: 'Crear hilo' });
    expect(crear).toBeDisabled();
    expect(crear).toHaveAttribute('title', CREAR_TITLE);
  });
});

describe('FORO-02 · la lista', () => {
  it('una fila por hilo, en el orden en que llegan', async () => {
    montar();
    await listo();
    const titulos = screen
      .getAllByRole('button', { name: /6205|22316|NU2210/ })
      .map((b) => b.textContent);
    expect(titulos).toEqual([
      'Equivalencia FAG 6205-2RS ↔ NSK',
      '¿Alguien sabe el equivalente NSK de 22316-E?',
      'Diferencia entre 6205-2RS y 6205-2RS/C3',
      'Sustitución NU2210-E por alternativa',
    ]);
  });

  it('cada fila trae organización, respuestas, reacciones y tiempo relativo', async () => {
    montar();
    await listo();
    const fila = screen.getByTestId('forum-thread-t1');
    expect(within(fila).getByText('SKF Nordic AB')).toBeInTheDocument();
    expect(within(fila).getByText('3 respuestas')).toBeInTheDocument();
    expect(within(fila).getByText('👍 5')).toBeInTheDocument();
    expect(within(fila).getByText('hace 5h')).toBeInTheDocument();
  });

  it('el singular y el cero se leen bien, y el tiempo largo es en días', async () => {
    montar();
    await listo();
    expect(within(screen.getByTestId('forum-thread-t2')).getByText('1 respuesta')).toBeInTheDocument();
    expect(within(screen.getByTestId('forum-thread-t2')).getByText('hace 1 día')).toBeInTheDocument();
    expect(within(screen.getByTestId('forum-thread-t4')).getByText('0 respuestas')).toBeInTheDocument();
    expect(within(screen.getByTestId('forum-thread-t4')).getByText('👍 0')).toBeInTheDocument();
  });

  it('el título abre el hilo por su id (FORO-03)', async () => {
    const { onOpenThread } = montar();
    await listo();
    fireEvent.click(screen.getByRole('button', { name: 'Equivalencia FAG 6205-2RS ↔ NSK' }));
    expect(onOpenThread).toHaveBeenCalledWith('t1');
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  it('sin badge de categoría: dentro de una categoría no se repite (spec §7)', async () => {
    montar();
    await listo();
    expect(within(screen.getByTestId('forum-thread-t1')).queryByText(/REFERENCIAS/)).not.toBeInTheDocument();
  });

  it('una categoría sin hilos lo dice, y no pinta paginación', async () => {
    fetchThreads.mockResolvedValue(VACIA);
    montar();
    expect(
      await screen.findByText('Todavía no hay hilos en esta categoría. ¡Sé el primero en abrir uno!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('un fallo de red se pinta en `role="alert"`', async () => {
    fetchThreads.mockRejectedValue(new Error('la base no responde'));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('la base no responde');
  });

  it('una categoría que no existe lo dice y no pide hilos', async () => {
    fetchCategory.mockResolvedValue(null);
    montar();
    expect(await screen.findByText('Esta categoría no existe.')).toBeInTheDocument();
    expect(fetchThreads).not.toHaveBeenCalled();
  });
});

describe('FORO-02 · la búsqueda (spec §3, §7)', () => {
  it('escribir NO busca: no es live search', async () => {
    montar();
    await listo();
    fireEvent.change(screen.getByPlaceholderText('Buscar en esta categoría...'), { target: { value: 'NSK' } });
    expect(fetchThreads).toHaveBeenCalledTimes(1);
  });

  it('Enter busca en el servidor, desde la página 1', async () => {
    montar();
    await listo();
    const buscador = screen.getByPlaceholderText('Buscar en esta categoría...');
    fireEvent.change(buscador, { target: { value: 'NSK' } });
    fireEvent.keyDown(buscador, { key: 'Enter' });
    await waitFor(() =>
      expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: 'NSK', page: 1 }),
    );
  });

  it('la lupa busca igual que Enter', async () => {
    montar();
    await listo();
    fireEvent.change(screen.getByPlaceholderText('Buscar en esta categoría...'), { target: { value: '6205' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: '6205', page: 1 }),
    );
  });

  it('la "x" del campo aparece al escribir y borra solo el borrador, sin consultar', async () => {
    montar();
    await listo();
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();

    const buscador = screen.getByPlaceholderText('Buscar en esta categoría...');
    fireEvent.change(buscador, { target: { value: 'NSK' } });
    const borrar = await screen.findByRole('button', { name: 'Borrar búsqueda' });

    fireEvent.click(borrar);
    expect(buscador).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
    expect(fetchThreads).toHaveBeenCalledTimes(1); // borrar el borrador no consulta
  });

  it('sin resultados, la frase va entera en UN nodo, con el texto buscado, y "Limpiar búsqueda" la quita', async () => {
    montar();
    await listo();
    fetchThreads.mockResolvedValue(VACIA);
    const buscador = screen.getByPlaceholderText('Buscar en esta categoría...');
    fireEvent.change(buscador, { target: { value: '6308-ZZ' } });
    fireEvent.keyDown(buscador, { key: 'Enter' });
    expect(
      await screen.findByText('No hemos encontrado hilos que coincidan con "6308-ZZ".'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay hilos en esta categoría. ¡Sé el primero en abrir uno!')).not.toBeInTheDocument();

    fetchThreads.mockResolvedValue(PAGINA);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    await waitFor(() =>
      expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: '', page: 1 }),
    );
    expect(screen.getByPlaceholderText('Buscar en esta categoría...')).toHaveValue('');
  });
});

describe('FORO-02 · la paginación (spec §3: 20 por página, numérica, server-side)', () => {
  const TRES_PAGINAS: ThreadPage = { ...PAGINA, total: 45, page: 1, pageCount: 3 };

  it('con una sola página no hay paginación', async () => {
    montar();
    await listo();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('con varias, un botón por página cuyo nombre es su número, y la actual marcada', async () => {
    fetchThreads.mockResolvedValue(TRES_PAGINAS);
    montar();
    await listo();
    const pag = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(pag).getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(within(pag).getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(within(pag).getByRole('button', { name: '2' })).not.toHaveAttribute('aria-current');
  });

  it('pulsar un número pide esa página con la búsqueda que haya', async () => {
    fetchThreads.mockResolvedValue(TRES_PAGINAS);
    montar();
    await listo();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Paginación' })).getByRole('button', { name: '3' }));
    await waitFor(() =>
      expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: '', page: 3 }),
    );
  });

  it('buscar estando en la página 3 vuelve a pedir la 1', async () => {
    fetchThreads.mockResolvedValue(TRES_PAGINAS);
    montar();
    await listo();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Paginación' })).getByRole('button', { name: '3' }));
    await waitFor(() => expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: '', page: 3 }));
    const buscador = screen.getByPlaceholderText('Buscar en esta categoría...');
    fireEvent.change(buscador, { target: { value: 'FAG' } });
    fireEvent.keyDown(buscador, { key: 'Enter' });
    await waitFor(() =>
      expect(fetchThreads).toHaveBeenLastCalledWith({ categoryId: 'c2', search: 'FAG', page: 1 }),
    );
  });
});
