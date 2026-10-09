import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THREAD_STATES } from '../../lib/threads';
import type { ThreadDetail, ThreadItem } from '../../lib/thread-detail';
import {
  HILO, NOW, detail, ofertaConContenido, ofertaRecibida, profile,
} from './Thread.fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-02 · la pantalla.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * ⚠ **Todo lo que hay aquí se le pide al Coder en `MSG-02.json`, y nada más.** Lo
 * que queda fuera —Realtime, el cableado de `onBack`— vive en
 * `Thread.fuera-de-contrato.test.tsx`, que el arnés no puntúa (`F-116`,
 * `B-011`). Un rótulo dentro de un `describe` no es una frontera; un fichero sí.
 *
 * Se mockean **solo** las funciones que tocan red. La lógica pura —`offerActions`,
 * `canCloseThread`, `canRevertAgreement`, `asOfferCard`— sigue siendo la de
 * verdad: mockearla convertiría esto en una comprobación de los mocks.
 */

const fetchThreadDetail = vi.fn<(t: string, o: string) => Promise<ThreadDetail>>();
const fetchThreadItems = vi.fn<(t: string, o: string) => Promise<ThreadItem[]>>();
const acceptOffer = vi.fn<(i: string, o: string) => Promise<unknown>>();
const rejectOffer = vi.fn<(i: string, o: string) => Promise<unknown>>();
const closeThreadWithoutAgreement = vi.fn<(t: string) => Promise<void>>();
const revertAgreement = vi.fn<(t: string) => Promise<void>>();
const counterOffer = vi.fn<(i: string, t: string, c: unknown) => Promise<void>>();

vi.mock('../../lib/thread-detail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/thread-detail')>()),
  fetchThreadDetail: (t: string, o: string) => fetchThreadDetail(t, o),
  fetchThreadItems: (t: string, o: string) => fetchThreadItems(t, o),
  counterOffer: (i: string, t: string, c: unknown) => counterOffer(i, t, c),
}));

vi.mock('../../lib/offers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/offers')>()),
  acceptOffer: (i: string, o: string) => acceptOffer(i, o),
  rejectOffer: (i: string, o: string) => rejectOffer(i, o),
  closeThreadWithoutAgreement: (t: string) => closeThreadWithoutAgreement(t),
  revertAgreement: (t: string) => revertAgreement(t),
}));

/**
 * Realtime se mockea por lo mismo que en `Messages.test.tsx`: sin esto el
 * `.subscribe()` de supabase-js abre un websocket de verdad contra el
 * `localhost:54321` de mentira de `test/setup.ts` y se queda reintentando.
 */
const desuscribir = vi.fn();
const onThreadChanged = vi.fn<(id: string, cb: () => void) => () => void>(() => desuscribir);

vi.mock('../../lib/realtime', () => ({
  onThreadChanged: (id: string, cb: () => void) => onThreadChanged(id, cb),
}));

const { Thread } = await import('./Thread');
const { ENCRYPTED_NOTICE } = await import('../../lib/thread-detail');

beforeEach(() => {
  for (const m of [
    fetchThreadDetail,
    fetchThreadItems,
    acceptOffer,
    rejectOffer,
    closeThreadWithoutAgreement,
    revertAgreement,
    counterOffer,
  ]) {
    m.mockReset();
  }
  desuscribir.mockReset();
  onThreadChanged.mockReset();
  onThreadChanged.mockReturnValue(desuscribir);
  fetchThreadDetail.mockResolvedValue(detail());
  fetchThreadItems.mockResolvedValue([ofertaRecibida]);
  acceptOffer.mockResolvedValue(undefined);
  rejectOffer.mockResolvedValue(undefined);
  closeThreadWithoutAgreement.mockResolvedValue(undefined);
  revertAgreement.mockResolvedValue(undefined);
  counterOffer.mockResolvedValue(undefined);
});

const pinta = () => render(<Thread profile={profile} threadId={HILO} now={NOW} />);

describe('carga', () => {
  it('pide el hilo y sus elementos con mi organización', async () => {
    pinta();
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledWith(HILO, profile.orgId));
    expect(fetchThreadItems).toHaveBeenCalledWith(HILO, profile.orgId);
  });

  it('declara la carga con aria-busy y la termina', async () => {
    pinta();
    const zona = screen.getByTestId('thread-body');
    expect(zona).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(zona).toHaveAttribute('aria-busy', 'false'));
  });

  it('un fallo se dice con su mensaje, no con un texto genérico (F-020)', async () => {
    fetchThreadDetail.mockRejectedValue({ message: 'PGRST201: more than one relationship' });
    pinta();
    expect(await screen.findByText(/more than one relationship/)).toBeInTheDocument();
  });

  it('pinta la cabecera y el historial con lo que trajo', async () => {
    pinta();
    // ⚠ POR ROL, NO POR TEXTO, y el fallo era MÍO: la §3 pone el nombre de la
    // contraparte DOS veces —en el breadcrumb `Hilos › NSK Europe Ltd` y como
    // enlace de la cabecera—, así que `findByText` encuentra dos y revienta.
    // El artefacto estaba bien; el aserto estaba mal escrito.
    expect(await screen.findByRole('button', { name: 'NSK Europe Ltd' })).toBeInTheDocument();
    expect(screen.getByText(ENCRYPTED_NOTICE)).toBeInTheDocument();
  });
});

describe('⚠ el campo de mensaje se queda en LOS CINCO estados (D-07-01)', () => {
  it.each(THREAD_STATES)('en %s', async (state) => {
    fetchThreadDetail.mockResolvedValue(detail(state));
    pinta();
    // La decisión del PO del 11-ago: un hilo cerrado se reabre al volver a
    // escribir en él. La §6 de la spec dice que el campo DESAPARECE en CERRADO SIN
    // ACUERDO — y si desapareciera, nadie podría escribir y la reapertura no
    // ocurriría nunca. Esta es la desviación obligatoria de MSG-02.
    expect(await screen.findByRole('textbox', { name: 'Escribe un mensaje' })).toBeInTheDocument();
    // Y desde el día 8 el campo no solo está: **funciona**. Hasta hoy este
    // aserto comprobaba el motivo de un botón inerte; comprobar que se puede
    // enviar de verdad es lo que cierra D-07-01, porque la reapertura del hilo
    // depende de que alguien pueda escribir.
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
  });
});

describe('cerrar sin acuerdo', () => {
  it('pide confirmación con un diálogo propio, nunca con window.confirm', async () => {
    // `window.confirm` no se puede probar, no se puede estilar y bloquea el hilo.
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Acciones del hilo' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sin acuerdo' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(closeThreadWithoutAgreement).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('⚠ el diálogo NO dice que sea irreversible, porque ya no lo es', async () => {
    // Cuatro specs de pantalla lo llaman "el único estado irreversible". D-07-01 lo
    // cambió y el aviso al usuario tiene que reflejarlo: un hilo cerrado se reabre
    // volviendo a escribir en él.
    const user = userEvent.setup();
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Acciones del hilo' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sin acuerdo' }));

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.textContent ?? '').not.toMatch(/irreversible|no se puede deshacer/i);
    expect(dialogo.textContent ?? '').toMatch(/reabrir|volver a escribir/i);
  });

  it('cancelar no escribe nada', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Acciones del hilo' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sin acuerdo' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(closeThreadWithoutAgreement).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirmar cierra y vuelve a leer el hilo', async () => {
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Acciones del hilo' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sin acuerdo' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(closeThreadWithoutAgreement).toHaveBeenCalledWith(HILO);
    // El estado del hilo lo deriva la base (0007): tras escribir hay que releerlo,
    // no calcularlo aquí. Un estado calculado en cliente es F-044 otra vez.
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(2));
  });
});

describe('revertir el acuerdo', () => {
  it('revierte y vuelve a leer', async () => {
    const user = userEvent.setup();
    fetchThreadDetail.mockResolvedValue(detail('ACUERDO ALCANZADO'));
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Acciones del hilo' }));
    await user.click(screen.getByRole('button', { name: 'Revertir a abierto' }));

    await waitFor(() => expect(revertAgreement).toHaveBeenCalledWith(HILO));
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(2));
  });
});

describe('decidir una oferta', () => {
  it('aceptar avisa a la base con el id del elemento y mi organización', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Aceptar oferta' }));
    expect(acceptOffer).toHaveBeenCalledWith('of-1', profile.orgId);
    await waitFor(() => expect(fetchThreadItems).toHaveBeenCalledTimes(2));
  });

  it('rechazar, igual', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(rejectOffer).toHaveBeenCalledWith('of-1', profile.orgId);
  });

  it('⚠ dos clics seguidos escriben UNA vez', async () => {
    // El artefacto tenía un `busy` de estado que nadie leía —`tsc` lo cazó como
    // TS6133—, así que no protegía de nada. Y no es teórico: hoy entra Realtime,
    // y la segunda escritura pierde la carrera contra la primera y sale con "La
    // oferta ya no estaba pendiente" en la cara del usuario que solo hizo doble
    // clic. El cerrojo va en un `ref` porque el estado se aplica asíncrono y dos
    // clics en el mismo tick leerían los dos `false`.
    const user = userEvent.setup();
    let resolver: (() => void) | undefined;
    acceptOffer.mockImplementation(() => new Promise<void>((r) => { resolver = () => r(); }));

    pinta();
    const boton = await screen.findByRole('button', { name: 'Aceptar oferta' });
    await user.click(boton);
    await user.click(boton);

    expect(acceptOffer).toHaveBeenCalledTimes(1);
    resolver?.();
  });

  it('el error de una carrera perdida se enseña, no se traga', async () => {
    // `setOfferState` lanza "La oferta ya no estaba pendiente, o es tuya" cuando el
    // update no afecta a ninguna fila. Con Realtime el día 7 esto pasa de verdad:
    // dos pestañas sobre la misma oferta.
    const user = userEvent.setup();
    acceptOffer.mockRejectedValue(new Error('La oferta ya no estaba pendiente, o es tuya.'));
    pinta();
    await user.click(await screen.findByRole('button', { name: 'Aceptar oferta' }));
    expect(await screen.findByText(/ya no estaba pendiente/)).toBeInTheDocument();
  });
});

describe('contraofertar (Plan §3, día 10)', () => {
  it('envía el elemento, el hilo y el contenido nuevo, y vuelve a leer', async () => {
    fetchThreadItems.mockResolvedValue([ofertaConContenido]);
    const user = userEvent.setup();
    pinta();

    await user.click(await screen.findByRole('button', { name: 'Contra-ofertar' }));
    await user.click(screen.getByRole('button', { name: 'Enviar contraoferta' }));

    await waitFor(() =>
      expect(counterOffer).toHaveBeenCalledWith(
        'of-1',
        HILO,
        expect.objectContaining({ kind: 'OFERTA', unitPrice: 2.1, quantity: 500 }),
      ),
    );
    // El estado lo deriva la base (0007) tras la RPC de 0013: hay que releer,
    // no calcularlo aquí. Mismo criterio que aceptar/rechazar (F-044).
    await waitFor(() => expect(fetchThreadItems).toHaveBeenCalledTimes(2));
  });

  it('dos clics seguidos escriben UNA vez, mismo cerrojo que aceptar/rechazar', async () => {
    fetchThreadItems.mockResolvedValue([ofertaConContenido]);
    const user = userEvent.setup();
    let resolver: (() => void) | undefined;
    counterOffer.mockImplementation(() => new Promise<void>((r) => { resolver = () => r(); }));

    pinta();
    await user.click(await screen.findByRole('button', { name: 'Contra-ofertar' }));
    const boton = screen.getByRole('button', { name: 'Enviar contraoferta' });
    await user.click(boton);
    await user.click(boton);

    expect(counterOffer).toHaveBeenCalledTimes(1);
    resolver?.();
  });

  it('un fallo de la base se enseña, no se traga', async () => {
    fetchThreadItems.mockResolvedValue([ofertaConContenido]);
    counterOffer.mockRejectedValue(new Error('La oferta ya no esta Pendiente'));
    const user = userEvent.setup();
    pinta();

    await user.click(await screen.findByRole('button', { name: 'Contra-ofertar' }));
    await user.click(screen.getByRole('button', { name: 'Enviar contraoferta' }));

    expect(await screen.findByText(/ya no esta Pendiente/)).toBeInTheDocument();
  });
});

describe('el reloj', () => {
  it('`now` se le pasa al historial y no se congela al montar', async () => {
    // Mismo criterio que MSG-01 y SRCH-01: `new Date()` en el render, no en un
    // `useState` inicial. Los timestamps relativos del hilo son tan sensibles al
    // reloj como la columna Antigüedad de SRCH-01.
    pinta();
    expect(await screen.findByText(/hace/i)).toBeInTheDocument();
  });
});
