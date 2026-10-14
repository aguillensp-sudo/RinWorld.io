import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ThreadDetail, ThreadItem } from '../../lib/thread-detail';
import { HILO, NOW, detail, ofertaRecibida, profile } from './Thread.fixtures';

/**
 * FUERA DE CONTRATO · MSG-02 · relecturas que llegan desordenadas (F-250). Escrito a mano.
 *
 * El contrato de aceptación de MSG-02 (`Thread.test.tsx`) es el de la tarea del arnés y no se toca para
 * otra cosa (`F-116`). Aquí vive lo que no pedía: tras cada escritura hay una relectura propia y el evento
 * de Realtime que esa misma escritura provoca lanza otra —dos solapadas por diseño—, y la más lenta pisaba
 * a la más nueva. Solo la última relectura lanzada puede escribir detalle, elementos, error o fin de carga.
 *
 * El solape se provoca con el montaje (relectura 1, en vuelo) y el callback de `onThreadChanged` (relectura
 * 2): es el mismo `reload` que dispara `write`, sin tener que montar el pie de composición.
 */

const fetchThreadDetail = vi.fn<(t: string, o: string) => Promise<ThreadDetail>>();
const fetchThreadItems = vi.fn<(t: string, o: string) => Promise<ThreadItem[]>>();

vi.mock('../../lib/thread-detail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/thread-detail')>()),
  fetchThreadDetail: (t: string, o: string) => fetchThreadDetail(t, o),
  fetchThreadItems: (t: string, o: string) => fetchThreadItems(t, o),
}));

/** Sin este mock el `.subscribe()` de supabase-js abre un websocket de verdad (ver el fichero de Realtime). */
const desuscribir = vi.fn();
const onThreadChanged = vi.fn<(id: string, cb: () => void) => () => void>(() => desuscribir);

vi.mock('../../lib/realtime', () => ({
  onThreadChanged: (id: string, cb: () => void) => onThreadChanged(id, cb),
}));

const { Thread } = await import('./Thread');

/** Un detalle reconocible por el nombre de la contraparte, que la cabecera pinta. */
const conNombre = (counterpartyName: string): ThreadDetail => ({ ...detail(), counterpartyName });

/** Una promesa que se resuelve o se rechaza cuando el test lo decide. */
function diferida() {
  let resolver: (d: ThreadDetail) => void = () => {};
  let rechazar: (e: unknown) => void = () => {};
  const promesa = new Promise<ThreadDetail>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const esperar = () => new Promise((r) => setTimeout(r, 30));

/**
 * La relectura del montaje queda en vuelo (`vieja`); el evento de Realtime lanza otra (`nueva`). Devuelve
 * los mandos de ambas, para que el test decida en qué orden llegan.
 */
async function montarConDosRelecturasEnVuelo() {
  const vieja = diferida();
  const nueva = diferida();
  fetchThreadDetail.mockReturnValueOnce(vieja.promesa).mockReturnValueOnce(nueva.promesa);

  render(<Thread profile={profile} threadId={HILO} now={NOW} />);
  await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(1));

  onThreadChanged.mock.calls.at(-1)![1]();
  await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(2));

  return { vieja, nueva };
}

beforeEach(() => {
  fetchThreadDetail.mockReset();
  fetchThreadItems.mockReset().mockResolvedValue([ofertaRecibida]);
  desuscribir.mockReset();
  onThreadChanged.mockReset();
  onThreadChanged.mockReturnValue(desuscribir);
});

describe('MSG-02 · relecturas que llegan desordenadas', () => {
  it('una relectura vieja que llega la última no pisa la nueva', async () => {
    const { vieja, nueva } = await montarConDosRelecturasEnVuelo();

    nueva.resolver(conNombre('Contraparte nueva'));
    expect((await screen.findAllByText('Contraparte nueva')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('thread-body')).toHaveAttribute('aria-busy', 'false');

    // La del montaje llega la última, con datos anteriores: no debe tocar nada.
    vieja.resolver(conNombre('Contraparte vieja'));
    await esperar();
    expect(screen.queryByText('Contraparte vieja')).not.toBeInTheDocument();
    expect(screen.getAllByText('Contraparte nueva').length).toBeGreaterThan(0);
    expect(screen.getByTestId('thread-body')).toHaveAttribute('aria-busy', 'false');
  });

  it('un fallo de la relectura vieja ni pinta el error ni apaga el «Cargando» de la nueva', async () => {
    const { vieja, nueva } = await montarConDosRelecturasEnVuelo();

    // La vieja falla con la nueva todavía en vuelo: ni banner, ni se da la carga por terminada.
    vieja.rechazar({ message: 'timeout', code: '57014' });
    await esperar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('thread-body')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Cargando hilo…')).toBeInTheDocument();

    nueva.resolver(conNombre('Contraparte nueva'));
    expect((await screen.findAllByText('Contraparte nueva')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('thread-body')).toHaveAttribute('aria-busy', 'false');
  });
});
