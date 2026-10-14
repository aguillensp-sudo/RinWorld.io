import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InventoryLine, Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · INV-01 · cargas que llegan desordenadas (F-250). Escrito a mano.
 *
 * El contrato de aceptación de INV-01 (`Inventory.test.tsx`) es el de la tarea del arnés y no se toca para
 * otra cosa (`F-116`). Aquí vive lo que no pedía: cada cambio de filtro, búsqueda o página lanza una carga
 * nueva, y la red no garantiza que lleguen en orden. Solo la última carga lanzada puede escribir líneas,
 * error o fin de carga. Mismo patrón que `SearchResults.fuera-de-contrato.test.tsx`.
 *
 * Se dispara cambiando de chip y no de página: durante la carga la tabla —y con ella la paginación— se
 * sustituye por «Cargando inventario…», así que los chips son lo único que se puede pulsar con una carga
 * en vuelo. El código protegido es el mismo `load` para las tres causas.
 */

const fetchPage = vi.fn<(q: PageQuery) => Promise<Page>>();
const fetchStats = vi.fn<() => Promise<Stats>>();

vi.mock('../../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/inventory')>()),
  fetchPage: (q: PageQuery) => fetchPage(q),
  fetchStats: () => fetchStats(),
  archiveLine: () => Promise.resolve(),
  deleteLine: () => Promise.resolve(),
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

function line(partNumber: string): InventoryLine {
  return {
    id: `id-${partNumber}`,
    partNumber,
    brand: 'SKF',
    quantity: 840,
    country: 'ES',
    productFamily: 'Rodamiento rigido de bolas',
    status: 'PUBLISHED',
    leadTimeDays: 3,
    lastUploadAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
  };
}

const STATS: Stats = {
  published: 15,
  stale: 3,
  lastUploadAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
  visits: null,
  visibilityMode: 'VISIBLE_TODOS',
};

/** Una promesa que se resuelve o se rechaza cuando el test lo decide. */
function diferida() {
  let resolver: (p: Page) => void = () => {};
  let rechazar: (e: unknown) => void = () => {};
  const promesa = new Promise<Page>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

/**
 * Carga inicial inmediata (`INICIAL`); después, `Archivados` queda en vuelo (la vieja) y `Publicados`
 * (la nueva) se responde con lo que decida el test. Devuelve los mandos de ambas.
 */
async function montarConDosCargasEnVuelo() {
  const archivados = diferida();
  const publicados = diferida();
  fetchPage.mockImplementation((q) => {
    if (q.filter === 'archivados') return archivados.promesa;
    if (q.filter === 'publicados') return publicados.promesa;
    return Promise.resolve({ lines: [line('INICIAL')], total: 1 });
  });

  render(<Inventory profile={profile} now={NOW} />);
  await screen.findByText('INICIAL');

  await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
  await waitFor(() => expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ filter: 'archivados' }));
  await userEvent.click(screen.getByRole('button', { name: 'Publicados' }));
  await waitFor(() => expect(fetchPage.mock.calls.at(-1)?.[0]).toMatchObject({ filter: 'publicados' }));

  return { archivados, publicados };
}

const esperar = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  vi.clearAllMocks();
  fetchPage.mockReset();
  fetchStats.mockReset().mockResolvedValue(STATS);
});

describe('INV-01 · cargas que llegan desordenadas', () => {
  it('una respuesta vieja que llega la última no pisa la del filtro nuevo', async () => {
    const { archivados, publicados } = await montarConDosCargasEnVuelo();

    // Llega la nueva (Publicados) y se pinta.
    publicados.resolver({ lines: [line('NUEVA')], total: 1 });
    expect(await screen.findByText('NUEVA')).toBeInTheDocument();

    // Ahora llega la vieja (Archivados), la última: no debe tocar nada.
    archivados.resolver({ lines: [line('VIEJA')], total: 1 });
    await esperar();
    expect(screen.getByText('NUEVA')).toBeInTheDocument();
    expect(screen.queryByText('VIEJA')).not.toBeInTheDocument();
  });

  it('un fallo de la carga vieja ni pinta el error ni apaga el «Cargando» de la nueva', async () => {
    const { archivados, publicados } = await montarConDosCargasEnVuelo();

    // La vieja falla mientras la nueva sigue en vuelo: ni banner, ni se da la carga por terminada.
    archivados.rechazar({ message: 'timeout', code: '57014' });
    await esperar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Cargando inventario…')).toBeInTheDocument();

    // Y la nueva, cuando llega, se pinta con normalidad.
    publicados.resolver({ lines: [line('NUEVA')], total: 1 });
    expect(await screen.findByText('NUEVA')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
