import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type SessionKeyPair,
  decryptContent,
  encryptContent,
  fromBytea,
  generateCek,
  generateKeyPair,
  toBytea,
  unwrapCek,
  wrapCekFor,
} from './crypto';
import {
  type InquiryLine,
  type OfferContent,
  counterOffer,
  createOffer,
  fetchThreadItems,
  sendInquiries,
  sendMessage,
} from './thread-detail';
import type { ThreadRecipient } from './keys';

/**
 * Cierre de los PARCIAL de `messaging-and-negotiation` que se pueden ejercer en Vitest (corriente C).
 * Cada `it` empieza por el id del escenario de `openspec/v1/trazabilidad.csv`; las expectativas salen
 * de `openspec/specs/messaging-and-negotiation/spec.md`, no del comportamiento del codigo.
 *
 * Escrito por Claude Code; no es contrato del arnes.
 */

const rpcLlamadas: { fn: string; args: Record<string, unknown> }[] = [];
let llavero: SessionKeyPair | null = null;
let destinatarios: ThreadRecipient[] = [];
let publicasPorOrg = new Map<string, ThreadRecipient[]>();
/** Lo que registra la consulta de `fetchThreadItems`. */
const consulta: { tabla?: string; eq?: unknown[]; order?: unknown[] } = {};
let filas: unknown[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcLlamadas.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
    from: (tabla: string) => {
      consulta.tabla = tabla;
      const api = {
        select: () => api,
        eq: (...a: unknown[]) => {
          consulta.eq = a;
          return api;
        },
        // Termina la cadena, como en PostgREST: lo que viene ya es la respuesta.
        order: (...a: unknown[]) => {
          consulta.order = a;
          return Promise.resolve({ data: filas, error: null });
        },
      };
      return api;
    },
  },
}));

vi.mock('./keys', () => ({
  currentKeyPair: () => llavero,
  fetchThreadRecipients: async () => destinatarios,
  fetchOrgRecipients: async (orgId: string) => publicasPorOrg.get(orgId) ?? [],
}));

beforeEach(async () => {
  rpcLlamadas.length = 0;
  delete consulta.tabla;
  delete consulta.eq;
  delete consulta.order;
  filas = [];
  llavero = await generateKeyPair();
  destinatarios = [{ memberId: 'yo', orgId: 'org-a', publicKey: llavero.publicKey }];
  publicasPorOrg = new Map();
});

/** Una fila de `thread_items` con su contenido de verdad cifrado para `par`. */
async function fila(
  id: string,
  tipo: 'MENSAJE' | 'CONSULTA' | 'OFERTA',
  creada: string,
  contenido: unknown,
  par: SessionKeyPair,
) {
  const cek = await generateCek();
  const { ciphertext, iv } = await encryptContent(contenido, cek);
  const w = await wrapCekFor(cek, par.publicKey);
  return {
    id,
    item_type: tipo,
    sender_org_id: id.length % 2 ? 'org-a' : 'org-b',
    created_at: creada,
    part_number: tipo === 'MENSAJE' ? null : '6207-2RS',
    brand: tipo === 'MENSAJE' ? null : 'NSK',
    estado_oferta: tipo === 'OFERTA' ? 'Pendiente' : null,
    estado_consulta: tipo === 'CONSULTA' ? 'Pendiente' : null,
    responds_to_item_id: null,
    superseded_by_item_id: null,
    content_ciphertext: toBytea(ciphertext),
    content_iv: toBytea(iv),
    thread_item_keys: [
      { wrapped_cek: toBytea(w.wrappedCek), wrap_iv: toBytea(w.wrapIv), ephemeral_pubkey: toBytea(w.ephemeralPublicKey) },
    ],
    inventory_lines: null,
  };
}

describe('messaging-and-negotiation/single-thread-model', () => {
  /*
   * #2 GIVEN un hilo activo entre dos organizaciones
   *    WHEN  se anaden elementos de distinto tipo en momentos distintos (mensaje, consulta, oferta)
   *    THEN  todos aparecen en el historial en estricto orden cronologico
   *    AND   no existe restriccion de orden entre tipos de elemento, salvo las transiciones de estado del hilo
   */
  it('messaging-and-negotiation/single-thread-model#2 · el historial se pide ascendente por created_at y mezcla los tres tipos en ese orden, sin agruparlos por tipo', async () => {
    const t = (min: number) => `2026-10-01T10:${String(min).padStart(2, '0')}:00Z`;
    // Orden de llegada (el de la base con ORDER BY created_at ASC): tipos entreverados.
    filas = [
      await fila('i-1', 'MENSAJE', t(1), { kind: 'MENSAJE', text: 'hola' }, llavero!),
      await fila('i-2', 'CONSULTA', t(2), { kind: 'CONSULTA', quantity: 10, comment: null }, llavero!),
      await fila('i-3', 'MENSAJE', t(3), { kind: 'MENSAJE', text: 'ahora te la miro' }, llavero!),
      await fila(
        'i-4',
        'OFERTA',
        t(4),
        {
          kind: 'OFERTA', unitPrice: 2.1, currency: 'EUR', quantity: 10, leadTimeDays: 5,
          shippingCost: null, shippingCostCurrency: null, validUntil: null, notes: null,
        },
        llavero!,
      ),
      await fila('i-5', 'MENSAJE', t(5), { kind: 'MENSAJE', text: 'gracias' }, llavero!),
    ];

    const items = await fetchThreadItems('hilo-1', 'org-a');

    // La consulta es la que garantiza el orden en la base: ascendente por created_at, de ese hilo.
    expect(consulta.tabla).toBe('thread_items');
    expect(consulta.eq).toEqual(['thread_id', 'hilo-1']);
    expect(consulta.order).toEqual(['created_at', { ascending: true }]);

    // Y la capa de datos no reordena ni agrupa: tipos mezclados, mismas posiciones, fechas crecientes.
    expect(items.map((i) => i.id)).toEqual(['i-1', 'i-2', 'i-3', 'i-4', 'i-5']);
    expect(items.map((i) => i.type)).toEqual(['MENSAJE', 'CONSULTA', 'MENSAJE', 'OFERTA', 'MENSAJE']);
    const fechas = items.map((i) => Date.parse(i.createdAt));
    expect([...fechas].sort((a, b) => a - b)).toEqual(fechas);
    // Y cada uno conserva su contenido descifrado (no se ha mezclado el contenido entre elementos).
    expect(items.map((i) => i.content?.kind)).toEqual(['MENSAJE', 'CONSULTA', 'MENSAJE', 'OFERTA', 'MENSAJE']);
  });

  /*
   * #3 GIVEN un comprador que ejecuta "Consultar Seleccionados" sobre varias lineas del mismo distribuidor
   *    WHEN  el sistema procesa el envio
   *    THEN  todas las tarjetas de consulta se anaden al unico hilo existente con ese distribuidor
   *    AND   nunca se crea un hilo separado por referencia
   *
   * Cliente: el lote entero va por `create_inquiry` (que encuentra-o-crea el hilo en la base) y NUNCA
   * por `open_thread`, ni lleva un id de hilo propio por linea. Que la base acabe con UN hilo es SQL.
   */
  it('messaging-and-negotiation/single-thread-model#3 · un lote de tres lineas del mismo distribuidor son tres create_inquiry sin id de hilo y ninguna llamada a open_thread', async () => {
    const DIST = 'org-dist';
    const dist = await generateKeyPair();
    publicasPorOrg = new Map<string, ThreadRecipient[]>([
      ['org-a', [{ memberId: 'yo', orgId: 'org-a', publicKey: llavero!.publicKey }]],
      [DIST, [{ memberId: 'd-1', orgId: DIST, publicKey: dist.publicKey }]],
    ]);
    const lineas: InquiryLine[] = ['l-1', 'l-2', 'l-3'].map((lineId, i) => ({
      lineId,
      distributorOrgId: DIST,
      quantity: 100 * (i + 1),
    }));

    const res = await sendInquiries(lineas, 'org-a');

    expect(res.every((r) => r.ok)).toBe(true);
    expect(rpcLlamadas.map((c) => c.fn)).toEqual(['create_inquiry', 'create_inquiry', 'create_inquiry']);
    expect(rpcLlamadas.map((c) => c.args.p_line_id)).toEqual(['l-1', 'l-2', 'l-3']);
    for (const c of rpcLlamadas) {
      expect(Object.keys(c.args).sort()).toEqual(['p_ciphertext', 'p_iv', 'p_keys', 'p_line_id', 'p_quantity']);
    }
  });
});

describe('messaging-and-negotiation/e2ee-content-encryption', () => {
  /*
   * #1 GIVEN cualquier elemento almacenado en el hilo
   *    WHEN  se inspecciona directamente la base de datos del servidor
   *    THEN  no es posible reconstruir el texto plano de un mensaje libre, la cantidad de una tarjeta
   *          de consulta, ni ninguna cifra de una tarjeta de oferta
   *
   * Se inspecciona lo REAL que se envia a `supabase.rpc` (lo que acaba en las columnas). Las cifras de
   * la oferta y el texto no aparecen en ninguna forma; el contenido enviado, descifrado con la clave
   * del destinatario, devuelve exactamente lo que se escribio (asi el aserto negativo mide algo).
   * La cantidad NO entra aqui: viaja ademas en claro (`p_quantity`, ADR-002 D-3); ver la fila DIVERGE.
   */
  const TEXTO = 'SENTINELA-mensaje-secreto-x91';
  const NOTA = 'SENTINELA-nota-de-oferta-k27';
  const PRECIO = 3.7183;
  const OFERTA: OfferContent = {
    kind: 'OFERTA',
    unitPrice: PRECIO,
    currency: 'CHF',
    quantity: 7351,
    leadTimeDays: 17,
    shippingCost: 41.9,
    shippingCostCurrency: 'CHF',
    validUntil: '2031-02-03T00:00:00.000Z',
    notes: NOTA,
  };

  async function abrir(llamada: { args: Record<string, unknown> }) {
    const k = (llamada.args.p_keys as { wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[])[0]!;
    const cek = await unwrapCek(
      { wrappedCek: fromBytea(k.wrapped_cek), wrapIv: fromBytea(k.wrap_iv), ephemeralPublicKey: fromBytea(k.ephemeral_pubkey) },
      llavero!,
    );
    return decryptContent(fromBytea(llamada.args.p_ciphertext as string), fromBytea(llamada.args.p_iv as string), cek);
  }

  function sinTexto(llamada: { args: Record<string, unknown> }, prohibidos: string[]) {
    const wire = JSON.stringify(llamada);
    for (const p of prohibidos) expect(wire).not.toContain(p);
  }

  it('messaging-and-negotiation/e2ee-content-encryption#1 · mensaje, oferta directa y contraoferta: ni el texto ni las cifras de la oferta viajan en claro', async () => {
    await sendMessage('hilo-1', TEXTO);
    expect(rpcLlamadas).toHaveLength(1);
    expect(await abrir(rpcLlamadas[0]!)).toEqual({ kind: 'MENSAJE', text: TEXTO });
    sinTexto(rpcLlamadas[0]!, [TEXTO, 'SENTINELA']);

    rpcLlamadas.length = 0;
    await createOffer('hilo-1', null, { partNumber: '6207-2RS', brand: 'NSK' }, OFERTA);
    expect(await abrir(rpcLlamadas[0]!)).toEqual(OFERTA);
    sinTexto(rpcLlamadas[0]!, [NOTA, String(PRECIO), '3,7183', 'CHF', '"unitPrice"', '41.9', '2031-02-03']);

    rpcLlamadas.length = 0;
    await counterOffer('item-viejo', 'hilo-1', OFERTA);
    expect(rpcLlamadas[0]!.fn).toBe('counter_offer');
    expect(await abrir(rpcLlamadas[0]!)).toEqual(OFERTA);
    sinTexto(rpcLlamadas[0]!, [NOTA, String(PRECIO), '3,7183', 'CHF', '41.9', '2031-02-03']);
  });

  it('messaging-and-negotiation/e2ee-content-encryption#1 · la consulta: la nota viaja cifrada, no en claro', async () => {
    const dist = await generateKeyPair();
    publicasPorOrg = new Map<string, ThreadRecipient[]>([
      ['org-a', [{ memberId: 'yo', orgId: 'org-a', publicKey: llavero!.publicKey }]],
      ['org-dist', [{ memberId: 'd-1', orgId: 'org-dist', publicKey: dist.publicKey }]],
    ]);
    const NOTA_CONSULTA = 'SENTINELA-nota-de-consulta-q58';
    await sendInquiries([{ lineId: 'l-1', distributorOrgId: 'org-dist', quantity: 7351, notes: NOTA_CONSULTA }], 'org-a');
    const c = rpcLlamadas[0]!;
    expect(c.fn).toBe('create_inquiry');
    // El primer destinatario envuelto es el propio (`propias` va primero): abre y trae la nota.
    expect(await abrir(c)).toMatchObject({ kind: 'CONSULTA', comment: NOTA_CONSULTA });
    sinTexto(c, [NOTA_CONSULTA, 'SENTINELA']);
  });
});
