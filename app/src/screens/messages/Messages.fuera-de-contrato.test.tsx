import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadPage, ThreadQuery } from '../../lib/threads';
import { NOW, page, profile, thread } from './Messages.fixtures';

/**
 * MSG-01 · LO QUE **NO** SE LE PIDIÓ AL CODER.
 *
 * Estos tests son del producto y siguen siendo obligatorios: los corre `npm test`
 * y los corre la CI, como siempre. Lo que no hacen es puntuar en el arnés — C1
 * lanza `npm run test:arnes`, que los excluye (`vitest.config.arnes.ts`), y C2
 * corre solo los ficheros de `acceptance.unit`, donde ya no están.
 *
 * **Por qué existe este fichero** (`F-116`, `B-011`, decidido por el PO el
 * 28-ago-2026): hasta hoy vivían dentro de `Messages.test.tsx`, en dos `describe`
 * rotulados *«FUERA del contrato del arnés»*. El rótulo estaba solo en el nombre
 * del `describe` y no lo honraba nadie: C2 corría el fichero entero, y en la
 * corrida del 28-ago **tres de los seis rojos de MSG-01 eran estos**, que además
 * dominaban el recorte del feedback (`F-114`). Al Coder se le pedía arreglar lo
 * único que su tarea no le manda construir — `MSG-01.json` no menciona realtime
 * en ninguna parte.
 *
 * Es `F-058` por el reverso: allí eran asertos que pasaban en verde contra un
 * componente vacío; estos solo podían salir en rojo hiciera lo que hiciera el
 * Coder. Las dos mitades del mismo error — un veredicto que no depende del
 * artefacto.
 *
 * **La regla que deja escrita:** un aserto que la tarea no pide no vive en el
 * fichero que la mide. Se movió el fichero, no el rótulo, porque un rótulo no es
 * una frontera.
 */

const fetchThreadPage = vi.fn<(q: ThreadQuery) => Promise<ThreadPage>>();

vi.mock('../../lib/threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/threads')>()),
  fetchThreadPage: (q: ThreadQuery) => fetchThreadPage(q),
}));

/**
 * Sin este mock el `.subscribe()` de supabase-js abre un websocket **de verdad**
 * contra el `http://localhost:54321` de mentira que pone `test/setup.ts`, y se
 * queda reintentando con backoff. `desuscribir` es el espía de la limpieza al
 * desmontar, que es lo único que de verdad se rompe aquí.
 */
const desuscribir = vi.fn();
const onThreadsChanged = vi.fn<(cb: () => void) => () => void>(() => desuscribir);

vi.mock('../../lib/realtime', () => ({
  onThreadsChanged: (cb: () => void) => onThreadsChanged(cb),
}));

const { Messages } = await import('./Messages');

beforeEach(() => {
  fetchThreadPage.mockReset();
  fetchThreadPage.mockResolvedValue(page([thread()]));
  desuscribir.mockReset();
  onThreadsChanged.mockReset();
  onThreadsChanged.mockReturnValue(desuscribir);
});

function pintar() {
  return render(<Messages profile={profile} now={NOW} />);
}

describe('MSG-01 · Realtime — fuera del contrato del arnés', () => {
  it('se suscribe a los cambios de hilos al montar', async () => {
    pintar();
    await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
    expect(onThreadsChanged).toHaveBeenCalled();
  });

  it('un evento vuelve a leer la página', async () => {
    pintar();
    await waitFor(() => expect(fetchThreadPage).toHaveBeenCalledTimes(1));

    // Lo que el canal entrega es una SEÑAL, no datos: la pantalla pregunta otra
    // vez en vez de mezclar el payload. La lista está paginada y ordenada por
    // `last_item_at` en el servidor, así que insertar a mano lo que llega la
    // pondría en una página que a lo mejor no es la que se está viendo.
    const avisar = onThreadsChanged.mock.calls[0]![0];
    avisar();

    await waitFor(() => expect(fetchThreadPage).toHaveBeenCalledTimes(2));
  });

  it('⚠ se da de baja al desmontar', async () => {
    // Sin esto, cada visita a Hilos deja un canal abierto y una relectura que
    // apunta a un componente que ya no está.
    const { unmount } = pintar();
    await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
    unmount();
    expect(desuscribir).toHaveBeenCalled();
  });
});

describe('MSG-01 · cableado a MSG-02 — fuera del contrato del arnés', () => {
  /**
   * `onOpenThread` llegó en el cableado a mano del día 7, cuando MSG-02 pasó a
   * existir. Va aparte para que la frontera de qué se le pidió al Coder de
   * MSG-01 siga siendo legible: cuando se le encargó la pantalla, abrir un hilo
   * no llevaba a ningún sitio y esa era la respuesta correcta.
   */
  it('abrir un hilo avisa con su id', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    render(<Messages profile={profile} now={NOW} onOpenThread={onOpenThread} />);

    await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Nordwälz Lager/ }));

    expect(onOpenThread).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001');
  });

  it('sin `onOpenThread` el clic no revienta', async () => {
    // La prop es opcional para que el contrato de MSG-01 compile sin ella. Un
    // `onOpenThread(id)` a secas sobre `undefined` sería un TypeError en el clic.
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
    await expect(
      user.click(screen.getByRole('button', { name: /Nordwälz Lager/ })),
    ).resolves.not.toThrow();
  });
});
