import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { relativeTime } from '../../lib/threads';
import { EXPIRED_NOTICE } from '../../lib/offers';
import { ENCRYPTED_NOTICE, type ItemContent, type ThreadItem } from '../../lib/thread-detail';
import { ThreadHistory } from './ThreadHistory';

/**
 * `OfferCounterForm` no se mockea aquí abajo: es el mismo criterio que
 * `offerActions` en el fichero de arriba — es lógica real, y mockearla
 * convertiría el contrato en una comprobación de los mocks.
 */

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
const onCounterOffer = vi.fn<(itemId: string, threadId: string, content: ItemContent) => Promise<boolean>>();

beforeEach(() => {
  onAcceptOffer.mockReset();
  onRejectOffer.mockReset();
  onCounterOffer.mockReset();
  onCounterOffer.mockResolvedValue(true);
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
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
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
      onCounterOffer={onCounterOffer}
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
    // ⚠ LA REFERENCIA ENTERA EN UN SOLO ASERTO, y el fallo era MÍO: `/NSK/` a
    // secas casaba con dos nodos —la referencia `6205-2RS · NSK` y el autor
    // `NSK Europe Ltd`, que también va dentro del elemento—. Pedir las dos
    // partes juntas es inequívoco y además no fija el separador, que el
    // contrato dejó libre a propósito.
    expect(within(tarjeta).getByText(/6205-2RS.*NSK/)).toBeInTheDocument();
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

describe('el panel de vista-servidor (Plan §3, día 11)', () => {
  const filaCifrada = {
    ciphertext: '\\x4a2f3c9de1a0b7f5238899aabbccddee',
    iv: '\\xaabbccddeeff001122334455',
    wrappedKeyCount: 1,
  };

  it('empieza cerrado: ningún byte cifrado en el DOM antes de pulsar el toggle', () => {
    // Es el mismo aserto que `messages.spec.ts` hace contra la app real —"NO se
    // escapa un byte cifrado al DOM"— pero aquí contra el componente que acaba
    // de aprender a pintarlo: sin este test, "colapsado por defecto" sería una
    // intención del código, no algo que un rojo pudiera cazar si se rompiera.
    const { container } = pinta([ofertaRecibida({ raw: filaCifrada })]);
    expect(screen.getByRole('button', { name: 'Ver lo que ve el servidor' })).toBeInTheDocument(); // ancla
    expect(container.textContent ?? '').not.toContain('4a2f3c9de1a0b7f5');
  });

  it('al abrirlo, enseña content_ciphertext y content_iv tal cual, sin reformatear', async () => {
    const user = userEvent.setup();
    pinta([ofertaRecibida({ raw: filaCifrada })]);

    await user.click(screen.getByRole('button', { name: 'Ver lo que ve el servidor' }));

    expect(screen.getByText(filaCifrada.ciphertext)).toBeInTheDocument();
    expect(screen.getByText(filaCifrada.iv)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar lo que ve el servidor' })).toBeInTheDocument();
  });

  it('el conteo de thread_item_keys visibles se enseña literal — 0 o 1, nunca un total inventado', async () => {
    // `wrappedKeyCount` es lo que RLS deja ver para MÍ, no cuántos destinatarios
    // tiene el elemento en total (`item_keys_select_own`, 0003:353). Enseñar
    // "2 destinatarios" aquí sería afirmar un dato que este componente no tiene.
    const user = userEvent.setup();
    pinta([ofertaRecibida({ raw: { ...filaCifrada, wrappedKeyCount: 0 } })]);

    await user.click(screen.getByRole('button', { name: 'Ver lo que ve el servidor' }));
    expect(within(screen.getByTestId('thread-item')).getByText('0')).toBeInTheDocument();
  });

  it('cerrarlo vuelve a ocultar el ciphertext', async () => {
    const user = userEvent.setup();
    const { container } = pinta([ofertaRecibida({ raw: filaCifrada })]);

    await user.click(screen.getByRole('button', { name: 'Ver lo que ve el servidor' }));
    expect(screen.getByText(filaCifrada.ciphertext)).toBeInTheDocument(); // ancla

    await user.click(screen.getByRole('button', { name: 'Ocultar lo que ve el servidor' }));
    expect(container.textContent ?? '').not.toContain('4a2f3c9de1a0b7f5');
  });

  it('con contenido descifrado, el toggle enseña las DOS mitades a la vez: arriba legible, abajo no', async () => {
    // El argumento entero del producto en un solo test: la tarjeta ya pinta el
    // texto legible y el toggle, al lado, pinta lo que Postgres de verdad tiene
    // para esa misma fila.
    const user = userEvent.setup();
    pinta([item({ id: 'm', content: { kind: 'MENSAJE', text: 'Gracias por la oferta.' }, raw: filaCifrada })]);

    expect(screen.getByText('Gracias por la oferta.')).toBeInTheDocument(); // ancla: lo legible sigue ahí
    await user.click(screen.getByRole('button', { name: 'Ver lo que ve el servidor' }));
    expect(screen.getByText(filaCifrada.ciphertext)).toBeInTheDocument();
    expect(screen.getByText('Gracias por la oferta.')).toBeInTheDocument(); // sigue ahí tras abrir
  });

  it('un mensaje libre también tiene su toggle: la costura no es exclusiva de las tarjetas', () => {
    // `e2ee-content-encryption` habla de "cualquier elemento del hilo", no solo
    // de ofertas y consultas — de ahí que el toggle viva a nivel de `<li>`.
    pinta([item({ isOwn: false, senderOrgId: SUYA, raw: filaCifrada })]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument(); // ancla
    expect(screen.getByRole('button', { name: 'Ver lo que ve el servidor' })).toBeInTheDocument();
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

  it('sin contenido descifrado, `Contra-ofertar` se pinta deshabilitada y con el motivo', () => {
    // Sin la oferta original legible no hay con qué prerellenar el formulario
    // (D-07-05): no es "fuera del MVP", es que esta sesión no puede leerla.
    pinta([ofertaRecibida({ content: null })]);
    const boton = screen.getByRole('button', { name: 'Contra-ofertar' });
    expect(boton).toBeDisabled();
    expect(screen.getByText(/no se puede leer/i)).toBeInTheDocument();
  });

  it('con contenido descifrado, `Contra-ofertar` abre el formulario prerelleno', async () => {
    const user = userEvent.setup();
    pinta([ofertaRecibida({ content: contenidoOferta })]);

    const boton = screen.getByRole('button', { name: 'Contra-ofertar' });
    expect(boton).not.toBeDisabled();
    await user.click(boton);

    expect(screen.getByRole('dialog', { name: 'Contra-oferta' })).toBeInTheDocument();
    // ANCLA: viene prerelleno con la oferta que se está superando, no en blanco.
    expect(screen.getByLabelText('Precio unitario')).toHaveValue('2.1');
    expect(screen.getByLabelText('Cantidad')).toHaveValue('500');
    expect(screen.getByLabelText('Coste de transporte')).toHaveValue('45');
  });

  it('enviar la contraoferta llama a onCounterOffer con el elemento, el hilo y el contenido nuevo, y cierra el formulario', async () => {
    const user = userEvent.setup();
    pinta([ofertaRecibida({ content: contenidoOferta })]);

    await user.click(screen.getByRole('button', { name: 'Contra-ofertar' }));
    await user.clear(screen.getByLabelText('Precio unitario'));
    await user.type(screen.getByLabelText('Precio unitario'), '1.80');
    await user.click(screen.getByRole('button', { name: 'Enviar contraoferta' }));

    await vi.waitFor(() => expect(onCounterOffer).toHaveBeenCalledTimes(1));
    expect(onCounterOffer).toHaveBeenCalledWith(
      'of-1',
      HILO,
      expect.objectContaining({ kind: 'OFERTA', unitPrice: 1.8, quantity: 500 }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Contra-oferta' })).not.toBeInTheDocument(),
    );
  });

  it('cancelar cierra el formulario sin llamar a onCounterOffer', async () => {
    const user = userEvent.setup();
    pinta([ofertaRecibida({ content: contenidoOferta })]);

    await user.click(screen.getByRole('button', { name: 'Contra-ofertar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: 'Contra-oferta' })).not.toBeInTheDocument();
    expect(onCounterOffer).not.toHaveBeenCalled();
  });

  it('un mensaje libre no tiene acciones de oferta', () => {
    pinta([item({ isOwn: false, senderOrgId: SUYA })]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Aceptar|Rechazar|Contra/i })).not.toBeInTheDocument();
  });
});
