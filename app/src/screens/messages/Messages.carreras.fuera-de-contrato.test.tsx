import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadPage, ThreadQuery } from '../../lib/threads';
import { NOW, page, profile, thread } from './Messages.fixtures';

/**
 * FUERA DE CONTRATO · MSG-01 · cargas que llegan desordenadas (F-250). Escrito a mano.
 *
 * El contrato de aceptación de MSG-01 (`Messages.test.tsx`) es el de la tarea del arnés y no se toca para
 * otra cosa (`F-116`). Aquí vive lo que no pedía: una relectura de Realtime (`onThreadsChanged(cargar)`)
 * se lanza sin cleanup, así que el `vivo` del efecto nunca la invalidaba, y si llegaba la última pisaba a
 * la carga posterior del usuario. Solo la última carga lanzada, venga de donde venga, puede escribir.
 *
 * El disparador es una búsqueda con la relectura en vuelo, no un cambio de página: mientras carga, la
 * paginación se oculta (`!loading`), pero el buscador sigue activo.
 */

const fetchThreadPage = vi.fn<(q: ThreadQuery) => Promise<ThreadPage>>();

vi.mock('../../lib/threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/threads')>()),
  fetchThreadPage: (q: ThreadQuery) => fetchThreadPage(q),
}));

/** Sin este mock el `.subscribe()` de supabase-js abre un websocket de verdad (ver el fichero de Realtime). */
const desuscribir = vi.fn();
const onThreadsChanged = vi.fn<(cb: () => void) => () => void>(() => desuscribir);

vi.mock('../../lib/realtime', () => ({
  onThreadsChanged: (cb: () => void) => onThreadsChanged(cb),
}));

const { Messages } = await import('./Messages');

/** Una promesa que se resuelve o se rechaza cuando el test lo decide. */
function diferida() {
  let resolver: (p: ThreadPage) => void = () => {};
  let rechazar: (e: unknown) => void = () => {};
  const promesa = new Promise<ThreadPage>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const esperar = () => new Promise((r) => setTimeout(r, 30));

/**
 * Se deja la lista en la página 2 de 3, se lanza una relectura de Realtime que queda en vuelo (`relectura`,
 * página 2) y el usuario busca «Nueva» (`busqueda`, página 1). Devuelve los mandos de ambas.
 */
async function montarConRelecturaYBusquedaEnVuelo() {
  const relectura = diferida();
  const busqueda = diferida();
  let relecturaPedida = false;
  fetchThreadPage.mockImplementation((q) => {
    if (q.search === 'Nueva') return busqueda.promesa;
    // Página 1 y página 2 sin búsqueda: la segunda llamada a la página 2 es la relectura de Realtime.
    if (q.page === 2 && relecturaPedida) return relectura.promesa;
    return Promise.resolve(page([thread({ counterpartyName: `Inicial p${q.page}` })], 90));
  });

  render(<Messages profile={profile} now={NOW} />);
  await screen.findByText('Inicial p1');
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  await screen.findByText('Inicial p2');

  // Realtime avisa con la página 2 en pantalla. El canal entrega el `cargar` vigente.
  relecturaPedida = true;
  const avisar = onThreadsChanged.mock.calls.at(-1)![0];
  avisar();
  await waitFor(() => expect(screen.getByText('Cargando hilos…')).toBeInTheDocument());

  // Con la relectura en vuelo, el usuario busca.
  await userEvent.type(screen.getByPlaceholderText('Buscar por nombre de organización...'), 'Nueva{Enter}');
  await waitFor(() => expect(fetchThreadPage.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'Nueva', page: 1 }));

  return { relectura, busqueda };
}

beforeEach(() => {
  fetchThreadPage.mockReset();
  desuscribir.mockReset();
  onThreadsChanged.mockReset();
  onThreadsChanged.mockReturnValue(desuscribir);
});

describe('MSG-01 · cargas que llegan desordenadas', () => {
  it('una relectura de Realtime vieja que llega la última no pisa la búsqueda del usuario', async () => {
    const { relectura, busqueda } = await montarConRelecturaYBusquedaEnVuelo();

    busqueda.resolver(page([thread({ counterpartyName: 'Resultado nuevo' })], 1));
    expect(await screen.findByText('Resultado nuevo')).toBeInTheDocument();

    // La relectura de la página 2 llega la última, con la lista sin filtrar: no debe tocar nada.
    relectura.resolver(page([thread({ counterpartyName: 'Resultado viejo' })], 90));
    await esperar();
    expect(screen.getByText('Resultado nuevo')).toBeInTheDocument();
    expect(screen.queryByText('Resultado viejo')).not.toBeInTheDocument();
    expect(screen.getByTestId('pag-info')).toHaveTextContent('1 hilo · Página 1 de 1');
  });

  it('un fallo de la relectura vieja ni pinta el error ni apaga el «Cargando» de la búsqueda', async () => {
    const { relectura, busqueda } = await montarConRelecturaYBusquedaEnVuelo();

    relectura.rechazar({ message: 'timeout', code: '57014' });
    await esperar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Cargando hilos…')).toBeInTheDocument();

    busqueda.resolver(page([thread({ counterpartyName: 'Resultado nuevo' })], 1));
    expect(await screen.findByText('Resultado nuevo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
