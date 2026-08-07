import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InventoryLine, Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * Se mockean SOLO las cuatro funciones que tocan red. La lógica pura del módulo
 * (antigüedad, paginación, saneado) sigue siendo la de verdad: mockearla
 * convertiría estos tests en una comprobación de los mocks.
 */
const fetchPage = vi.fn<(q: PageQuery) => Promise<Page>>();
const fetchStats = vi.fn<() => Promise<Stats>>();
const archiveLine = vi.fn<() => Promise<void>>();
const deleteLine = vi.fn<() => Promise<void>>();

vi.mock('../../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/inventory')>()),
  fetchPage: (q: PageQuery) => fetchPage(q),
  fetchStats: () => fetchStats(),
  archiveLine: () => archiveLine(),
  deleteLine: () => deleteLine(),
}));

const { Inventory } = await import('./Inventory');

const NOW = new Date('2026-08-07T12:00:00Z');

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

function line(over: Partial<InventoryLine> = {}): InventoryLine {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 840,
    country: 'ES',
    productFamily: 'Rodamiento rigido de bolas',
    status: 'PUBLISHED',
    leadTimeDays: 3,
    lastUploadAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
    ...over,
  };
}

const STATS: Stats = {
  published: 15,
  stale: 3,
  lastUploadAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
  visits: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchStats.mockResolvedValue(STATS);
  fetchPage.mockResolvedValue({ lines: [line()], total: 1 });
});

function renderScreen() {
  render(<Inventory profile={profile} now={NOW} />);
}

describe('INV-01 · cabecera y resumen', () => {
  it('los tres literales de la spec §3 son los aprobados', async () => {
    renderScreen();
    expect(screen.getByText('Módulo 02 · Gestión de Inventario')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Gestiona y publica tu stock de rodamientos. Los distribuidores verificados podrán consultarlo en tiempo real.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('pide el inventario de la organización de la sesión, no de otra', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    expect(fetchPage.mock.calls[0]?.[0]).toMatchObject({ orgId: profile.orgId });
  });

  it('pinta las cuatro tarjetas con los números de la base', async () => {
    renderScreen();
    expect(await screen.findByTestId('stat-published')).toHaveTextContent('15');
    expect(screen.getByTestId('stat-stale')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-last')).toHaveTextContent('Hace 2 días');
  });

  /**
   * No hay tabla de visitas en el esquema ni en el plan. La spec pinta 892 como
   * ejemplo; copiar ese número, o derivarlo de algo que no lo mide, es el riesgo
   * #1 de CLAUDE.md §7 en la interfaz — una cifra con aplomo delante del socio.
   */
  it('la tarjeta de visitas no inventa un número', async () => {
    renderScreen();
    expect(await screen.findByTestId('stat-visits')).toHaveTextContent('—');
    expect(screen.queryByText('892')).not.toBeInTheDocument();
    expect(screen.getByText('sin instrumentar en el MVP')).toBeInTheDocument();
  });

  it('las desactualizadas van en naranja solo si son más de cero', async () => {
    renderScreen();
    expect((await screen.findByTestId('stat-stale')).className).toMatch(/warn/);
  });

  it('a cero desactualizadas el número NO va en naranja — cero es la buena noticia', async () => {
    fetchStats.mockResolvedValue({ ...STATS, stale: 0 });
    renderScreen();
    expect((await screen.findByTestId('stat-stale')).className).not.toMatch(/warn/);
  });
});

describe('INV-01 · canales de actualización', () => {
  /**
   * Plan §9 "Fuera" excluye la importación de inventario (INV-02/03/04) y el
   * INV-07 de visibilidad. Los tres destinos de esta sección están fuera del MVP,
   * así que la pantalla no puede ofrecerlos como si funcionaran.
   */
  it('dice que los canales están fuera del MVP en vez de decir "Activo"', async () => {
    renderScreen();
    expect(screen.getByTestId('channels-scope')).toHaveTextContent('fuera del alcance del MVP');
    expect(screen.getAllByText('Fuera del MVP')).toHaveLength(2);
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByText('Siempre disponible')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('no inventa una dirección de ingestión — alguien podría escribirle', async () => {
    renderScreen();
    expect(screen.getByTestId('ingest-addr')).toHaveTextContent('—');
    expect(screen.queryByText(/@ingest\.bearingworld\.io/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('la dropzone no es un control: no abre ningún selector de archivo', async () => {
    renderScreen();
    expect(screen.getByText('Arrastra tu archivo aquí')).toBeInTheDocument();
    // La dropzone del HTML aprobado es un div con onclick que abre un <input
    // type=file>. Aquí no hay input de archivo en toda la pantalla.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  /**
   * Decisión del PO el 7-ago: **deshabilitado, no ausente**. Es un botón primario de
   * un diseño aprobado y quitarlo dejaba la barra de herramientas a medias, pero
   * INV-02 está en el Plan §9 "Fuera" y no puede llevar a ningún sitio.
   */
  it('el botón de subir inventario está, pero deshabilitado y diciendo por qué', async () => {
    renderScreen();
    const btn = screen.getByRole('button', { name: /Subir nuevo inventario/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining('fuera del alcance del MVP'));
    // Y el motivo también para quien no usa ratón.
    expect(screen.getByText(/INV-02\) está fuera del alcance del MVP/)).toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });
});

describe('INV-01 · filtros y búsqueda', () => {
  it('los cuatro chips están y Todos arranca activo', async () => {
    renderScreen();
    // Se espera al contador: el chip de desactualizados no lo tiene hasta que
    // llegan las estadísticas, y leer los cuatro rótulos antes daría un falso rojo.
    await screen.findByRole('button', { name: 'Desactualizados (3)' });
    const chips = screen.getByRole('group', { name: 'Filtros de inventario' });
    const labels = within(chips)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels).toEqual(['Todos', 'Publicados', 'Desactualizados (3)', 'Archivados']);
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('el chip de desactualizados lleva el contador de la spec §6', async () => {
    renderScreen();
    expect(await screen.findByRole('button', { name: 'Desactualizados (3)' })).toBeInTheDocument();
  });

  it('sin desactualizadas el chip va sin contador, no con "(0)"', async () => {
    fetchStats.mockResolvedValue({ ...STATS, stale: 0 });
    renderScreen();
    expect(await screen.findByRole('button', { name: 'Desactualizados' })).toBeInTheDocument();
  });

  it('cambiar de chip vuelve a consultar con ese filtro', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    await waitFor(() =>
      expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ filter: 'archivados', page: 1 }),
    );
  });

  /**
   * Spec §3: la búsqueda es server-side y se lanza al pulsar Enter o la lupa,
   * **no es live search** — con hasta 500.000 líneas, una petición por tecla es
   * una petición por tecla.
   */
  it('escribir NO lanza la búsqueda', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar/i }), '6205');
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('Enter sí la lanza', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar/i }), '6205{Enter}');
    await waitFor(() =>
      expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ search: '6205' }),
    );
  });

  it('la lupa también, y es un botón de verdad para que la alcance el teclado', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar/i }), 'FAG');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'FAG' }));
  });
});

describe('INV-01 · estados de la tabla', () => {
  it('mientras carga lo dice, y las tarjetas van con skeleton', () => {
    fetchPage.mockReturnValue(new Promise(() => {}));
    fetchStats.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText('Cargando inventario…')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-published')).not.toBeInTheDocument();
  });

  it('sin líneas y sin filtro usa el mensaje literal de la spec §6', async () => {
    fetchPage.mockResolvedValue({ lines: [], total: 0 });
    renderScreen();
    expect(await screen.findByTestId('inventory-empty')).toHaveTextContent(
      'Todavía no tienes ninguna línea de inventario publicada.',
    );
  });

  it('sin resultados pero con filtro dice que es el filtro, no que no hay inventario', async () => {
    renderScreen();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    fetchPage.mockResolvedValue({ lines: [], total: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(await screen.findByTestId('inventory-empty')).toHaveTextContent(
      'Ninguna línea coincide con el filtro.',
    );
  });

  it('un error de la base se muestra con su mensaje, no como "[object Object]"', async () => {
    // Un error de PostgREST es un objeto plano, no una instancia de Error. F-020.
    fetchPage.mockRejectedValue({ message: 'permission denied', code: '42501' });
    renderScreen();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('permission denied');
    expect(alert).toHaveTextContent('42501');
    expect(alert).not.toHaveTextContent('[object Object]');
  });
});

describe('INV-01 · paginación', () => {
  it('con una sola página no hay botones de número que navegar', async () => {
    renderScreen();
    expect(await screen.findByTestId('pag-info')).toHaveTextContent('1 línea · pág. 1/1');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  /**
   * El pie del HTML aprobado dice "1.247 líneas · pág. 1/25". Las 25 páginas se
   * respetan; el punto no, porque el CLDR de `es` no agrupa cuatro cifras (ver el
   * comentario en InventoryTable.test.tsx). A partir de cinco sí.
   */
  it('con 1247 líneas anuncia 25 páginas, como el pie del HTML aprobado', async () => {
    fetchPage.mockResolvedValue({ lines: [line()], total: 1247 });
    renderScreen();
    expect(await screen.findByTestId('pag-info')).toHaveTextContent('1247 líneas · pág. 1/25');
  });

  it('con 12.500 líneas agrupa con punto y calcula 250 páginas', async () => {
    fetchPage.mockResolvedValue({ lines: [line()], total: 12_500 });
    renderScreen();
    expect(await screen.findByTestId('pag-info')).toHaveTextContent('12.500 líneas · pág. 1/250');
  });

  it('ir a otra página vuelve a consultar con ese número', async () => {
    fetchPage.mockResolvedValue({ lines: [line()], total: 1247 });
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Página 2' }));
    await waitFor(() => expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }));
  });
});

describe('INV-01 · acciones de fila', () => {
  it('archivar llama a la base y recarga', async () => {
    archiveLine.mockResolvedValue();
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar 6205-2RS' }));
    await waitFor(() => expect(archiveLine).toHaveBeenCalledOnce());
    // Dos veces: la carga inicial y la de después de la acción.
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
  });

  it('eliminar llama a la base y recarga', async () => {
    deleteLine.mockResolvedValue();
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar 6205-2RS' }));
    await waitFor(() => expect(deleteLine).toHaveBeenCalledOnce());
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
  });

  it('si la acción falla lo dice y no se queda mostrando un estado que no es', async () => {
    archiveLine.mockRejectedValue({ message: 'row level security', code: '42501' });
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar 6205-2RS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('row level security');
  });
});
