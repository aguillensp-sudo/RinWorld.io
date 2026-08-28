import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadDetail, ThreadItem } from '../../lib/thread-detail';
import { HILO, NOW, detail, ofertaRecibida, profile } from './Thread.fixtures';

/**
 * MSG-02 · LO QUE **NO** SE LE PIDIÓ AL CODER.
 *
 * Tests del producto, obligatorios, que corren en `npm test` y en la CI como
 * siempre, y que el arnés no puntúa: C1 lanza `npm run test:arnes`, que los
 * excluye (`vitest.config.arnes.ts`), y C2 corre solo los ficheros de
 * `acceptance.unit`, donde ya no están.
 *
 * Ver la nota larga de `Messages.fuera-de-contrato.test.tsx` para el porqué
 * (`F-116`, `B-011`). Aquí no llegaron a costar una medición —`MSG-02` quedó
 * fuera de la corrida del 28-ago por tener el contrato rancio (`D-08-02`)— pero
 * el defecto era el mismo y se arregla igual: **la regla se aplica entera o no
 * está aplicada.**
 */

const fetchThreadDetail = vi.fn<(t: string, o: string) => Promise<ThreadDetail>>();
const fetchThreadItems = vi.fn<(t: string, o: string) => Promise<ThreadItem[]>>();

vi.mock('../../lib/thread-detail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/thread-detail')>()),
  fetchThreadDetail: (t: string, o: string) => fetchThreadDetail(t, o),
  fetchThreadItems: (t: string, o: string) => fetchThreadItems(t, o),
}));

/**
 * Sin este mock el `.subscribe()` de supabase-js abre un websocket de verdad
 * contra el `localhost:54321` de mentira de `test/setup.ts` y se queda
 * reintentando con backoff.
 */
const desuscribir = vi.fn();
const onThreadChanged = vi.fn<(id: string, cb: () => void) => () => void>(() => desuscribir);

vi.mock('../../lib/realtime', () => ({
  onThreadChanged: (id: string, cb: () => void) => onThreadChanged(id, cb),
}));

const { Thread } = await import('./Thread');

beforeEach(() => {
  fetchThreadDetail.mockReset();
  fetchThreadItems.mockReset();
  desuscribir.mockReset();
  onThreadChanged.mockReset();
  onThreadChanged.mockReturnValue(desuscribir);
  fetchThreadDetail.mockResolvedValue(detail());
  fetchThreadItems.mockResolvedValue([ofertaRecibida]);
});

const pinta = () => render(<Thread profile={profile} threadId={HILO} now={NOW} />);

describe('MSG-02 · Realtime — fuera del contrato del arnés', () => {
  it('se suscribe a ESTE hilo, por su id', async () => {
    pinta();
    await waitFor(() => expect(onThreadChanged).toHaveBeenCalledWith(HILO, expect.any(Function)));
  });

  it('un evento vuelve a leer el hilo y sus elementos', async () => {
    pinta();
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(1));

    // Señal, no datos: ni el estado del hilo ni los elementos salen del payload.
    // El estado lo deriva la base (0007) y dos navegadores que lo mezclaran a
    // mano acabarían discrepando, ganando el último que escriba (F-044).
    onThreadChanged.mock.calls[0]![1]!();

    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(2));
    expect(fetchThreadItems).toHaveBeenCalledTimes(2);
  });

  it('⚠ se da de baja al desmontar', async () => {
    const { unmount } = pinta();
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalled());
    unmount();
    expect(desuscribir).toHaveBeenCalled();
  });
});

describe('MSG-02 · cableado — fuera del contrato del arnés', () => {
  /**
   * Estos dos no los midió el Coder: `onBack` es opcional y llegó en el cableado
   * a mano del día 7, después de la corrida.
   */
  it('el breadcrumb vuelve a la lista de hilos', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Thread profile={profile} threadId={HILO} now={NOW} onBack={onBack} />);
    await user.click(await screen.findByRole('button', { name: 'Hilos' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sin `onBack` el breadcrumb no revienta', () => {
    // La prop es opcional justamente para que el contrato del arnés compile sin
    // ella. Un `onBack()` a secas sobre `undefined` sería un TypeError en el clic.
    expect(() => pinta()).not.toThrow();
  });
});
