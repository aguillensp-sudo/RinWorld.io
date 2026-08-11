import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { relativeTime } from '../../lib/threads';
import { EXPIRED_NOTICE } from '../../lib/offers';
import { ENCRYPTED_NOTICE, type ItemContent, type ThreadItem } from '../../lib/thread-detail';
import { ThreadHistory } from './ThreadHistory';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-02 · historial de elementos.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * ⚠ ESTE COMPONENTE ES PRESENTACIONAL, y por eso puede probarse **la costura por
 * sus dos lados hoy** (D-07-05): los tests le pasan contenido descifrado a mano
 * donde la aplicación de hoy le pasa `null`. La rama que el día 8 pondrá en
 * producción ya está cubierta desde ahora.
 *
 * ── LAS ANCLAS ──────────────────────────────────────────────────────────────
 *
 * Varios asertos de aquí dicen "esto NO está": que el emisor no tiene botón, que
 * no se cuela una cifra, que una oferta terminal no ofrece acciones. **Un aserto
 * negativo lo cumple un componente que no pinta nada**, y cinco de ellos pasaban
 * en verde contra el esqueleto vacío antes de anclarlos.
 *
 * Así que cada uno lleva delante un aserto positivo —"la tarjeta está y es
 * suya"— que falla si no hay pantalla. Es F-047 llevado a su conclusión: no basta
 * con que el contrato compile y se ejecute; hay que mirar **qué se queda en
 * verde** contra una implementación vacía, porque eso es lo que no está midiendo
 * nada.
 */

const MIA = 'a1000000-0000-4000-8000-000000000001';
const SUYA = 'b2000000-0000-4000-8000-000000000002';
const HILO = 't1000000-0000-4000-8000-000000000001';

const NOW = new Date('2026-08-11T12:00:00Z');
const hace = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const onAcceptOffer = vi.fn();
const onRejectOffer = vi.fn();

beforeEach(() => {
  onAcceptOffer.mockReset();
  onRejectOffer.mockReset();
});

function item(over: Partial<ThreadItem> = {}): ThreadItem {
  return {
    id: 'it-1',
    type: 'MENSAJE',
    senderOrgId: MIA,
    isOwn: true,
    createdAt: hace(1),
    partNumber: null,
    brand: null,
    offerState: null,
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    ...over,
  };
}

const ofertaRecibida = (over: Partial<ThreadItem> = {}) =>
  item({
    id: 'of-1',
    type: 'OFERTA',
    senderOrgId: SUYA,
    isOwn: false,
    partNumber: '6205-2RS',
    brand: 'NSK',
    offerState: 'Pendiente',
    createdAt: hace(2),
    ...over,
  });

const contenidoOferta: ItemContent = {
  kind: 'OFERTA',
  unitPrice: 2.1,
  currency: 'EUR',
  quantity: 500,
  leadTimeDays: 14,
  shippingCost: 45,
  shippingCostCurrency: 'EUR',
  validUntil: null,
  notes: null,
};

function pinta(items: ThreadItem[]) {
  return render(
    <ThreadHistory
      items={items}
      threadId={HILO}
      viewerOrgId={MIA}
      ownOrgName="Rodamientos del Sur SL"
      counterpartyName="NSK Europe Ltd"
      now={NOW}
      onAcceptOffer={onAcceptOffer}
      onRejectOffer={onRejectOffer}
    />,
  );
}

describe('el historial', () => {
  it('pinta los elementos EN EL ORDEN QUE LOS RECIBE', () => {
    // Ordenar es de la capa de datos, que ya los trae ascendentes (§3: el más
    // antiguo arriba). Reordenar aquí sería un segundo criterio que discrepa.
    pinta([
      item({ id: 'a', createdAt: hace(5) }),
      item({ id: 'b', createdAt: hace(3) }),
      item({ id: 'c', createdAt: hace(1) }),
    ]);
    const ids = screen.getAllByTestId('thread-item').map((e) => e.getAttribute('data-item-id'));
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('el estado vacío vive AQUÍ, no en la pantalla', () => {
    // Misma lección que MSG-01 y SRCH-01: "no hay elementos" es un estado de la
    // lista. Si lo deciden los dos, acaban discrepando.
    pinta([]);
    expect(screen.getByText('Este hilo no tiene elementos todavía.')).toBeInTheDocument();
  });

  it('distingue lo propio de lo ajeno por ESTADO, no solo por color', () => {
    // El lado de la burbuja y el fondo son CSS, y el CSS no lo lee nadie con un
    // lector de pantalla ni lo ve un test.
    pinta([item({ id: 'mio', isOwn: true }), item({ id: 'suyo', isOwn: false, senderOrgId: SUYA })]);
    const [mio, suyo] = screen.getAllByTestId('thread-item');
    expect(mio).toHaveAttribute('data-own', 'true');
    expect(suyo).toHaveAttribute('data-own', 'false');
  });

  it('cada elemento lleva su autor y su timestamp relativo', () => {
    pinta([item({ id: 'x', isOwn: false, senderOrgId: SUYA, createdAt: hace(2) })]);
    const fila = screen.getByTestId('thread-item');
    expect(within(fila).getByText(/NSK Europe Ltd/)).toBeInTheDocument();
    // Contra la función de la casa, nunca contra el literal del mock (F-024): el
    // HTML aprobado escribe "hace 2h" y el CLDR de `es` da "hace 2 h".
    expect(within(fila).getByText(new RegExp(relativeTime(hace(2), NOW)))).toBeInTheDocument();
  });
});

describe('⚠ la frontera de lo cifrado (D-07-05)', () => {
  it('sin contenido descifrado se pinta el indicador VERBATIM de la capability', () => {
    pinta([item({ content: null })]);
    expect(screen.getByText(ENCRYPTED_NOTICE)).toBeInTheDocument();
  });

  it('el indicador no trae botón: no hay dónde introducir la frase (F-027)', () => {
    pinta([item({ content: null })]);
    expect(screen.getByText(ENCRYPTED_NOTICE)).toBeInTheDocument(); // ancla — ver §"anclas"
    expect(
      screen.queryByRole('button', { name: /frase de seguridad|passphrase|descifrar/i }),
    ).not.toBeInTheDocument();
  });

  it('una tarjeta sin descifrar CONSERVA sus metadatos: no es un bloque en blanco', () => {
    // Lo que separa un hilo sin passphrase de una pantalla rota. `part_number`,
    // `brand`, el tipo y el estado van en claro en `thread_items` desde 0003.
    pinta([ofertaRecibida({ content: null })]);
    const tarjeta = screen.getByTestId('thread-item');
    expect(within(tarjeta).getByText('Oferta')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/6205-2RS/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/NSK/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Pendiente/i)).toBeInTheDocument();
  });

  it('⚠⚠ sin descifrar NO aparece NI UNA CIFRA de la oferta, ni un símbolo de moneda', () => {
    // El test más importante del fichero. `unit_price`, `quantity`, `lead_time` y
    // `shipping_cost` viven dentro del blob; que alguno se filtrara a la pantalla
    // sería la ruptura del zero-knowledge, que es el argumento entero del producto
    // (`CLAUDE.md` §4). El part_number lleva dígitos, así que se mira lo monetario.
    const { container } = pinta([ofertaRecibida({ content: null })]);
    // Ancla: la tarjeta TIENE que estar pintada. Sin esto, un componente que no
    // pinta nada pasaría este test en verde — ver la nota de las anclas.
    expect(within(screen.getByTestId('thread-item')).getByText(/6205-2RS/)).toBeInTheDocument();

    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/€|EUR|\d+[.,]\d{2}/);
    expect(texto).not.toMatch(/500|2,10|2\.10|14 días|45/);
  });

  it('con contenido descifrado se pinta el contenido y desaparece el indicador', () => {
    // La rama del día 8, cubierta hoy. Si esto falla el 8, la costura estaba mal.
    pinta([
      item({ id: 'm', content: { kind: 'MENSAJE', text: 'Gracias por la oferta.' } }),
    ]);
    expect(screen.getByText('Gracias por la oferta.')).toBeInTheDocument();
    expect(screen.queryByText(ENCRYPTED_NOTICE)).not.toBeInTheDocument();
  });

  it('el transporte informado sale como línea propia; el no informado no sale', () => {
    // `offer-card`, dos escenarios: un `0` diría "portes gratis", que es una
    // afirmación comercial que nadie hizo.
    const { unmount } = pinta([ofertaRecibida({ content: contenidoOferta })]);
    expect(screen.getByText(/transporte/i)).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
    unmount();

    const { container } = pinta([
      ofertaRecibida({ content: { ...contenidoOferta, shippingCost: null } }),
    ]);
    // Ancla: la tarjeta descifrada sigue pintada —el precio unitario sí está—, y
    // lo que falta es exactamente la línea de transporte. Sin el ancla, un
    // componente vacío daría esto por bueno.
    expect(screen.getByText(/2,10|2\.10/)).toBeInTheDocument();
    expect(screen.queryByText(/transporte/i)).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/0,00|0\.00/);
  });

  it('una oferta caducada avisa y SIGUE siendo aceptable', () => {
    // `spec.md:173`: el aviso es local y "el receptor puede aceptarla igualmente".
    // Una caducada que deshabilita el botón es una regla de negocio inventada.
    pinta([
      ofertaRecibida({
        content: { ...contenidoOferta, validUntil: '2026-07-15T00:00:00Z' },
      }),
    ]);
    expect(screen.getByText(EXPIRED_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar oferta' })).not.toBeDisabled();
  });
});

describe('las tarjetas', () => {
  it('la consulta lleva su badge y su estado', () => {
    pinta([
      item({
        id: 'co-1',
        type: 'CONSULTA',
        partNumber: '6205-2RS',
        brand: 'FAG',
        inquiryState: 'Pendiente',
      }),
    ]);
    const tarjeta = screen.getByTestId('thread-item');
    expect(within(tarjeta).getByText('Consulta')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Pendiente/i)).toBeInTheDocument();
  });

  it('la consulta respondida lo dice con el literal del esquema', () => {
    pinta([
      item({ id: 'co-2', type: 'CONSULTA', partNumber: '6205-2RS', brand: 'FAG', inquiryState: 'Respondida con oferta' }),
    ]);
    expect(screen.getByText(/Respondida con oferta/i)).toBeInTheDocument();
  });

  it('una oferta superada por contraoferta sigue en el historial', () => {
    // `offer-card`: "sin eliminarse del historial". No basta con no borrar la fila.
    pinta([
      ofertaRecibida({
        id: 'of-vieja',
        offerState: 'Superada por contraoferta',
        supersededByItemId: 'of-nueva',
      }),
    ]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument();
    expect(screen.getByText(/Superada por contraoferta/i)).toBeInTheDocument();
  });
});

describe('⚠ quién puede decidir una oferta', () => {
  it('el receptor tiene `Aceptar oferta` y `Rechazar`', async () => {
    const user = userEvent.setup();
    pinta([ofertaRecibida()]);

    await user.click(screen.getByRole('button', { name: 'Aceptar oferta' }));
    expect(onAcceptOffer).toHaveBeenCalledWith('of-1');

    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(onRejectOffer).toHaveBeenCalledWith('of-1');
  });

  it('⚠ el EMISOR no tiene ninguna de las dos, y es la regla de F-051 y F-056', () => {
    // La base ya lo impide desde 0008/0010, pero un botón que la base rechaza es
    // un error de Postgres delante del socio. Y la regla vive en `offerActions`:
    // si la pantalla la reimplementa con `isOwn`, pasa a estar en dos sitios.
    pinta([ofertaRecibida({ senderOrgId: MIA, isOwn: true })]);
    // Ancla: la tarjeta está pintada y es MÍA. Lo que falta son las acciones, no la
    // tarjeta — una oferta propia se sigue viendo entera.
    expect(screen.getByTestId('thread-item')).toHaveAttribute('data-own', 'true');
    expect(screen.queryByRole('button', { name: 'Aceptar oferta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it.each(['Aceptada', 'Rechazada', 'Superada por contraoferta'] as const)(
    'una oferta %s no ofrece acciones ni al receptor',
    (estado) => {
      pinta([ofertaRecibida({ offerState: estado })]);
      // Ancla: la tarjeta sigue en el historial con su estado terminal a la vista.
      // "sin eliminarse del historial" (`offer-card`) es la otra mitad de esto.
      expect(within(screen.getByTestId('thread-item')).getByText(new RegExp(estado, 'i')))
        .toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aceptar oferta' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    },
  );

  it('`Contra-ofertar` se pinta deshabilitada y con el motivo', async () => {
    // La contraoferta es la fila del día 10 del `Plan §3` y son dos escrituras
    // atómicas que llegarán como función en la base. Quitar el botón dejaría la
    // tarjeta sin la tercera salida que el HTML aprobado enseña (F-023 e).
    pinta([ofertaRecibida()]);
    const boton = screen.getByRole('button', { name: 'Contra-ofertar' });
    expect(boton).toBeDisabled();
    expect(screen.getByText(/día 10|fuera del MVP|no entra/i)).toBeInTheDocument();
  });

  it('un mensaje libre no tiene acciones de oferta', () => {
    pinta([item({ isOwn: false, senderOrgId: SUYA })]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Aceptar|Rechazar|Contra/i })).not.toBeInTheDocument();
  });
});
