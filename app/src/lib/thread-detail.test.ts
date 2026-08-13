import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asOfferCard,
  authorLabel,
  counterOffer,
  decryptItem,
  itemTypeLabel,
  sendInquiries,
  validUntilLabel,
  AGREEMENT_DISABLED_REASON,
  CREATE_OFFER_DISABLED_REASON,
  ENCRYPTED_NOTICE,
  type EncryptedBlob,
  type InquiryLine,
  type OfferContent,
  type ThreadItem,
} from './thread-detail';
import { offerActions } from './offers';
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
import type { ThreadRecipient } from './keys';

/**
 * `counterOffer` toca red (RPC + destinatarios), así que necesita los dos
 * módulos que `sendMessage` también toca: `./supabase` y `./keys`. Se mockean
 * SOLO en este fichero de test — no afecta a `decryptItem` ni al resto, que
 * siguen usando `./crypto` de verdad.
 */
const rpcLlamadas: { fn: string; args: unknown }[] = [];
let rpcError: unknown = null;
/** Errores de un solo uso, en orden: la llamada N-ésima a `rpc` consume el
 *  N-ésimo de la cola antes de caer en `rpcError`. Sirve para probar que un
 *  fallo en una línea de `sendInquiries` no bloquea a las siguientes. */
let rpcErrorQueue: unknown[] = [];
let llavero: SessionKeyPair | null = null;
let destinatarios: ThreadRecipient[] = [];
const fetchThreadRecipientsMock = vi.fn(async (_threadId: string) => destinatarios);
/** Por organización distribuidora, para los tests de `sendInquiries`. */
let publicasPorOrg = new Map<string, ThreadRecipient[]>();
const fetchOrgRecipientsMock = vi.fn(async (orgId: string) => publicasPorOrg.get(orgId) ?? []);

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      rpcLlamadas.push({ fn, args });
      const error = rpcErrorQueue.length > 0 ? rpcErrorQueue.shift() : rpcError;
      return Promise.resolve({ error: error ?? null });
    },
  },
}));

vi.mock('./keys', () => ({
  currentKeyPair: () => llavero,
  fetchThreadRecipients: (threadId: string) => fetchThreadRecipientsMock(threadId),
  fetchOrgRecipients: (orgId: string) => fetchOrgRecipientsMock(orgId),
}));

/**
 * La lógica pura de MSG-02. Igual que en `threads.test.ts`: estos tests son los
 * míos, no el contrato del arnés — el contrato vive en `screens/messages/
 * Thread*.test.tsx` y el Coder no lo ve (`CLAUDE.md` §3).
 */

const MIA = 'org-alpha';
const SUYA = 'org-beta';

function item(over: Partial<ThreadItem> = {}): ThreadItem {
  return {
    id: 'it-1',
    type: 'MENSAJE',
    senderOrgId: MIA,
    isOwn: true,
    createdAt: '2026-08-11T10:00:00Z',
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

/**
 * Cifra un contenido y devuelve el blob tal y como llegaría de la fila, con su
 * CEK envuelta para `paraQuien`. Es el laboratorio de la costura: sin esto, los
 * tests de abajo tendrían que hablar de bytes a mano.
 */
async function blobDe(
  type: 'MENSAJE' | 'CONSULTA' | 'OFERTA',
  contenido: unknown,
  paraQuien: SessionKeyPair,
): Promise<EncryptedBlob> {
  const cek = await generateCek();
  const { ciphertext, iv } = await encryptContent(contenido, cek);
  const w = await wrapCekFor(cek, paraQuien.publicKey);
  return {
    type,
    ciphertext: toBytea(ciphertext),
    iv: toBytea(iv),
    wrapped: {
      wrappedCek: toBytea(w.wrappedCek),
      wrapIv: toBytea(w.wrapIv),
      ephemeralPublicKey: toBytea(w.ephemeralPublicKey),
    },
  };
}

describe('la costura de descifrado · RELLENADA el día 8 (D-07-05 → rebanada E2EE)', () => {
  /**
   * ⚠ ESTE BLOQUE ES EL QUE CAMBIÓ HOY, Y QUE CAMBIARA ERA LA SEÑAL.
   *
   * El día 7 decía *"hoy devuelve null para los tres tipos, y es deliberado"*,
   * con la nota de que **tenía que cambiar el día 8**; que hubiera seguido verde
   * el día 9 habría sido la señal de que la costura no se rellenó
   * (`Dia-08_decisiones_e2ee.md`, "lo que hay que revisar de lo de hoy").
   *
   * `null` **sigue significando exactamente lo mismo**: "cifrado y sin clave en
   * esta sesión". Lo que cambia es que ahora hay un camino que devuelve
   * contenido, y los `null` de abajo se miden contra él.
   */
  it('ANCLA · con la clave correcta, sale exactamente lo que se cifró', async () => {
    const yo = await generateKeyPair();
    const oferta = {
      kind: 'OFERTA',
      unitPrice: 12.4,
      currency: 'EUR',
      quantity: 800,
      leadTimeDays: 5,
      shippingCost: null,
      shippingCostCurrency: null,
      validUntil: '2026-08-20T00:00:00.000Z',
      notes: null,
    };
    expect(await decryptItem(await blobDe('OFERTA', oferta, yo), yo)).toEqual(oferta);
  });

  it('sin llavero en esta sesión devuelve null', async () => {
    const yo = await generateKeyPair();
    const blob = await blobDe('MENSAJE', { kind: 'MENSAJE', text: 'Hola' }, yo);

    expect(await decryptItem(blob, yo)).toEqual({ kind: 'MENSAJE', text: 'Hola' }); // ancla
    expect(await decryptItem(blob, null)).toBeNull();
  });

  it('sin fila mía en thread_item_keys devuelve null', async () => {
    // Es el caso normal del MVP: la CEK se envolvió para la clave que yo tenía en
    // otra sesión, así que por RLS no baja ninguna fila para mí.
    const yo = await generateKeyPair();
    const blob = await blobDe('MENSAJE', { kind: 'MENSAJE', text: 'Hola' }, yo);

    expect(await decryptItem(blob, yo)).not.toBeNull(); // ancla
    expect(await decryptItem({ ...blob, wrapped: null }, yo)).toBeNull();
  });

  it('TRAS RECARGAR con claves aleatorias, lo de antes deja de abrirse', async () => {
    // Es `CLAUDE.md` §4 en un test: las claves viven en memoria de sesión y se
    // pierden al recargar. La pantalla lo dice con ENCRYPTED_NOTICE; aquí se ve
    // por qué.
    const antes = await generateKeyPair();
    const despues = await generateKeyPair();
    const blob = await blobDe('MENSAJE', { kind: 'MENSAJE', text: 'Hola' }, antes);

    expect(await decryptItem(blob, antes)).not.toBeNull(); // ancla
    expect(await decryptItem(blob, despues)).toBeNull();
  });

  it('un contenido que no cuadra con el tipo del elemento devuelve null', async () => {
    // Los metadatos van en claro y el contenido cifrado: nada obliga a que una
    // fila marcada OFERTA lleve dentro cifras de oferta. Sin esta comprobación, la
    // tarjeta pintaría campos vacíos como si fueran datos — el riesgo #1 de
    // CLAUDE.md §7 por la puerta de atrás.
    const yo = await generateKeyPair();
    const mentiroso = await blobDe('OFERTA', { kind: 'MENSAJE', text: 'Hola' }, yo);

    expect(await decryptItem(await blobDe('MENSAJE', { kind: 'MENSAJE', text: 'Hola' }, yo), yo))
      .not.toBeNull(); // ancla: el mismo contenido, en su fila correcta, sí abre
    expect(await decryptItem(mentiroso, yo)).toBeNull();
  });

  it('no intenta leer el ciphertext como si fuera texto', async () => {
    // La tentación del día que corra prisa: devolver el blob tal cual para que la
    // pantalla "enseñe algo". Enseñaría bytes cifrados como si fueran un mensaje.
    const yo = await generateKeyPair();
    const salida = await decryptItem(
      { type: 'MENSAJE', ciphertext: 'Hola', iv: 'x', wrapped: null },
      yo,
    );
    expect(salida).toBeNull();
  });

  it('un elemento sin contenido descifrado conserva TODOS sus metadatos', () => {
    // Lo que separa un hilo sin passphrase de una pantalla en blanco. Los cinco
    // campos van en claro en `thread_items` desde 0003.
    const oferta = item({
      type: 'OFERTA',
      senderOrgId: SUYA,
      isOwn: false,
      partNumber: '6205-2RS',
      brand: 'NSK',
      offerState: 'Pendiente',
      content: null,
    });
    expect(oferta.partNumber).toBe('6205-2RS');
    expect(oferta.brand).toBe('NSK');
    expect(oferta.offerState).toBe('Pendiente');
    expect(oferta.createdAt).toBeTruthy();
    expect(oferta.type).toBe('OFERTA');
  });
});

describe('los literales que ve el usuario', () => {
  it('el indicador de cifrado es VERBATIM el de la capability', () => {
    // `messaging-and-negotiation/spec.md:68`. Es contrato, no copy de la casa: se
    // compara la cadena entera, con su raya larga.
    expect(ENCRYPTED_NOTICE).toBe('Contenido cifrado — introduce tu frase de seguridad para ver');
  });

  it('el indicador no ofrece nada, solo informa (F-027)', () => {
    // Ni "pulsa", ni "haz clic": en el MVP no hay dónde introducir la frase, y un
    // imperativo accionable sin acción detrás promete recuperación de claves que
    // no existe.
    expect(ENCRYPTED_NOTICE).not.toMatch(/pulsa|haz clic|introdúcela aquí/i);
  });

  it('los motivos de deshabilitado son frases completas y sin promesas', () => {
    // Eran tres hasta el día 8. `SEND_DISABLED_REASON` se retiró con D-08-02:
    // decía *"El cifrado en cliente llega en la rebanada E2EE"* y la rebanada ya
    // está, así que el pie envía en vez de explicar por qué no.
    for (const motivo of [AGREEMENT_DISABLED_REASON, CREATE_OFFER_DISABLED_REASON]) {
      expect(motivo.length).toBeGreaterThan(20);
      expect(motivo.endsWith('.')).toBe(true);
      // "Próximamente" es una fecha que nadie se ha comprometido a cumplir.
      expect(motivo).not.toMatch(/próximamente|pronto|en breve/i);
    }
  });

  it('el motivo del acuerdo dice la causa real, no que falte una función', () => {
    // D-07-04: no es que el botón esté a medias, es que el estado lo deriva la
    // base desde la aceptación de una oferta (`0007:246`, `spec.md:195`).
    expect(AGREEMENT_DISABLED_REASON).toMatch(/aceptando una oferta/i);
  });
});

describe('validUntilLabel', () => {
  it('una fecha de validez se lee, no se pinta el ISO en crudo', () => {
    // El artefacto del Coder pintaba `content.validUntil` tal cual. Ningun check
    // lo vio porque la rama descifrada no se ejercita hasta el dia 8: es el tipo
    // de defecto que solo caza leer el codigo.
    const salida = validUntilLabel('2026-07-15T00:00:00.000Z');
    expect(salida).not.toMatch(/T\d{2}:\d{2}|Z$/);
    expect(salida).toMatch(/2026/);
    expect(salida).toMatch(/jul/i);
  });

  it('lo que no es una fecha se devuelve tal cual, sin taparlo', () => {
    // Un guion en su lugar ocultaria que el dato llego mal.
    expect(validUntilLabel('pronto')).toBe('pronto');
  });
});

describe('authorLabel', () => {
  const nombres = { ownOrgName: 'Rodamientos del Sur SL', counterpartyName: 'NSK Europe Ltd' };

  it('lo mío lo firma mi organización', () => {
    expect(authorLabel(item({ isOwn: true }), nombres)).toBe('Rodamientos del Sur SL');
  });

  it('lo suyo lo firma la contraparte', () => {
    expect(authorLabel(item({ isOwn: false }), nombres)).toBe('NSK Europe Ltd');
  });
});

describe('itemTypeLabel', () => {
  it.each([
    ['CONSULTA', 'Consulta'],
    ['OFERTA', 'Oferta'],
    ['MENSAJE', 'Mensaje'],
  ] as const)('%s → %s', (type, esperado) => {
    expect(itemTypeLabel(type)).toBe(esperado);
  });
});

describe('asOfferCard · el puente con offers.ts', () => {
  const oferta = item({
    id: 'of-1',
    type: 'OFERTA',
    senderOrgId: SUYA,
    isOwn: false,
    partNumber: '6205-2RS',
    brand: 'NSK',
    offerState: 'Pendiente',
  });

  it('un mensaje no es una tarjeta de oferta', () => {
    expect(asOfferCard(item({ type: 'MENSAJE' }), 'th-1')).toBeNull();
  });

  it('una consulta tampoco', () => {
    expect(asOfferCard(item({ type: 'CONSULTA', inquiryState: 'Pendiente' }), 'th-1')).toBeNull();
  });

  it('una oferta conserva los campos de los que depende quién puede decidirla', () => {
    const card = asOfferCard(oferta, 'th-1');
    expect(card).not.toBeNull();
    expect(card!.senderOrgId).toBe(SUYA);
    expect(card!.state).toBe('Pendiente');
    expect(card!.threadId).toBe('th-1');
  });

  it('la oferta recibida y pendiente ofrece las tres acciones al receptor', () => {
    expect(offerActions(asOfferCard(oferta, 'th-1')!, MIA)).toEqual([
      'aceptar',
      'rechazar',
      'contraofertar',
    ]);
  });

  it('⚠ la oferta PROPIA no ofrece ninguna, y es la regla que costó F-051 y F-056', () => {
    // El puente existe para que esta condición viva SOLO en `offerActions`. Si la
    // pantalla se la monta con `item.isOwn`, la regla pasa a estar en dos sitios y
    // el día que una cambie, la otra no.
    const propia = { ...oferta, senderOrgId: MIA, isOwn: true };
    expect(offerActions(asOfferCard(propia, 'th-1')!, MIA)).toEqual([]);
  });

  it('una oferta terminal no ofrece acciones aunque sea recibida', () => {
    const aceptada = { ...oferta, offerState: 'Aceptada' as const };
    expect(offerActions(asOfferCard(aceptada, 'th-1')!, MIA)).toEqual([]);
  });
});

describe('counterOffer · la fila del día 10 del Plan §3', () => {
  /**
   * CONTRATO DE ACEPTACIÓN, escrito antes que el wiring de pantalla. Mismo
   * procedimiento que `sendMessage` — destinatarios antes de cifrar, ninguna
   * clave y no se envía, una CEK por destinatario incluida la propia — pero
   * contra `counter_offer` (0013), que además supersede la anterior en la base.
   * Aquí no se prueba la base: eso vive en `supabase/tests/01_schema_smoke.sql`.
   */

  const CONTENIDO: OfferContent = {
    kind: 'OFERTA',
    unitPrice: 1.95,
    currency: 'EUR',
    quantity: 500,
    leadTimeDays: 10,
    shippingCost: null,
    shippingCostCurrency: null,
    validUntil: null,
    notes: null,
  };
  const OLD_ITEM = 'of-vieja';
  const HILO = 'hilo-1';

  beforeEach(async () => {
    rpcLlamadas.length = 0;
    rpcError = null;
    rpcErrorQueue = [];
    fetchThreadRecipientsMock.mockClear();
    llavero = await generateKeyPair();
    const otro = await generateKeyPair();
    destinatarios = [
      { memberId: 'yo', orgId: 'org-mia', publicKey: llavero.publicKey },
      { memberId: 'contraparte', orgId: 'org-suya', publicKey: otro.publicKey },
    ];
  });

  it('sin llave de sesión no llega a pedir destinatarios ni a llamar a la base', async () => {
    llavero = null;
    await expect(counterOffer(OLD_ITEM, HILO, CONTENIDO)).rejects.toThrow(/clave de cifrado/i);
    expect(fetchThreadRecipientsMock).not.toHaveBeenCalled();
    expect(rpcLlamadas).toHaveLength(0);
  });

  it('sin la clave pública de un destinatario, no se envía', async () => {
    destinatarios = [...destinatarios, { memberId: 'sin-clave', orgId: 'org-tercera', publicKey: null }];
    await expect(counterOffer(OLD_ITEM, HILO, CONTENIDO)).rejects.toThrow(/no ha.*publicado su clave|no han.*publicado su clave/i);
    expect(rpcLlamadas).toHaveLength(0);
  });

  it('sin destinatarios, no se envía', async () => {
    destinatarios = [];
    await expect(counterOffer(OLD_ITEM, HILO, CONTENIDO)).rejects.toThrow(/no tiene destinatarios/i);
    expect(rpcLlamadas).toHaveLength(0);
  });

  it('ANCLA · llama a counter_offer con el id de la anterior y una CEK por destinatario, incluida la propia', async () => {
    await counterOffer(OLD_ITEM, HILO, CONTENIDO);

    expect(fetchThreadRecipientsMock).toHaveBeenCalledWith(HILO);
    expect(rpcLlamadas).toHaveLength(1);
    expect(rpcLlamadas[0]!.fn).toBe('counter_offer');

    const args = rpcLlamadas[0]!.args as {
      p_old_item_id: string;
      p_ciphertext: string;
      p_iv: string;
      p_keys: { member_id: string; wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[];
    };
    expect(args.p_old_item_id).toBe(OLD_ITEM);
    // Hex pelado, sin el prefijo `\x` — es el contrato de 0012/0013.
    expect(args.p_ciphertext).not.toMatch(/^\\x/);
    expect(args.p_iv).not.toMatch(/^\\x/);
    expect(args.p_keys.map((k) => k.member_id).sort()).toEqual(['contraparte', 'yo'].sort());
  });

  it('lo que llega a la base descifra exactamente al contenido cifrado', async () => {
    // No se prueba con bytes a mano: se cifra de verdad y se vuelve a abrir con
    // la propia clave, igual que hace `blobDe` en la costura de arriba.
    await counterOffer(OLD_ITEM, HILO, CONTENIDO);
    const args = rpcLlamadas[0]!.args as {
      p_ciphertext: string;
      p_iv: string;
      p_keys: { member_id: string; wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[];
    };

    const propia = args.p_keys.find((k) => k.member_id === 'yo')!;
    const cek = await unwrapCek(
      {
        wrappedCek: fromBytea(propia.wrapped_cek),
        wrapIv: fromBytea(propia.wrap_iv),
        ephemeralPublicKey: fromBytea(propia.ephemeral_pubkey),
      },
      llavero!,
    );
    const contenido = await decryptContent(fromBytea(args.p_ciphertext), fromBytea(args.p_iv), cek);
    expect(contenido).toEqual(CONTENIDO);
  });

  it('un fallo de la base se propaga tal cual', async () => {
    rpcError = { message: 'La oferta ya no esta Pendiente' };
    await expect(counterOffer(OLD_ITEM, HILO, CONTENIDO)).rejects.toBeTruthy();
  });
});

describe('sendInquiries · "Consultar Seleccionados" (GAP-004, Plan §3 día 10)', () => {
  /**
   * CONTRATO DE ACEPTACIÓN. Las públicas del distribuidor se piden por
   * ORGANIZACIÓN (`fetchOrgRecipients`), no por hilo: es la diferencia con
   * `counterOffer` y `sendMessage`, que ya tienen un hilo del que partir.
   */

  const NORDWALZ = 'org-nordwalz';
  const ANADOLU = 'org-anadolu';

  beforeEach(async () => {
    rpcLlamadas.length = 0;
    rpcError = null;
    rpcErrorQueue = [];
    fetchOrgRecipientsMock.mockClear();
    llavero = await generateKeyPair();
    const nordwalz = await generateKeyPair();
    const anadolu = await generateKeyPair();
    publicasPorOrg = new Map([
      [
        NORDWALZ,
        [
          { memberId: 'yo', orgId: NORDWALZ, publicKey: llavero.publicKey },
          { memberId: 'nordwalz-1', orgId: NORDWALZ, publicKey: nordwalz.publicKey },
        ],
      ],
      [
        ANADOLU,
        [
          { memberId: 'yo', orgId: ANADOLU, publicKey: llavero.publicKey },
          { memberId: 'anadolu-1', orgId: ANADOLU, publicKey: anadolu.publicKey },
        ],
      ],
    ]);
  });

  function linea(over: Partial<InquiryLine> = {}): InquiryLine {
    return { lineId: 'linea-1', distributorOrgId: NORDWALZ, quantity: 800, ...over };
  }

  it('sin llave de sesión, ni una línea se envía', async () => {
    llavero = null;
    await expect(sendInquiries([linea()])).rejects.toThrow(/clave de cifrado/i);
    expect(fetchOrgRecipientsMock).not.toHaveBeenCalled();
    expect(rpcLlamadas).toHaveLength(0);
  });

  it('ANCLA · una línea llama a create_inquiry con su id y una CEK por destinatario, incluida la propia', async () => {
    const resultados = await sendInquiries([linea({ lineId: 'l-1' })]);

    expect(resultados).toEqual([{ lineId: 'l-1', distributorOrgId: NORDWALZ, ok: true }]);
    expect(rpcLlamadas).toHaveLength(1);
    expect(rpcLlamadas[0]!.fn).toBe('create_inquiry');

    const args = rpcLlamadas[0]!.args as {
      p_line_id: string;
      p_ciphertext: string;
      p_iv: string;
      p_keys: { member_id: string }[];
    };
    expect(args.p_line_id).toBe('l-1');
    expect(args.p_keys.map((k) => k.member_id).sort()).toEqual(['nordwalz-1', 'yo']);
  });

  it('lo que llega a la base descifra a la cantidad de la línea, sin comentario', async () => {
    await sendInquiries([linea({ lineId: 'l-1', quantity: 250 })]);
    const args = rpcLlamadas[0]!.args as {
      p_ciphertext: string;
      p_iv: string;
      p_keys: { member_id: string; wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[];
    };
    const propia = args.p_keys.find((k) => k.member_id === 'yo')!;
    const cek = await unwrapCek(
      {
        wrappedCek: fromBytea(propia.wrapped_cek),
        wrapIv: fromBytea(propia.wrap_iv),
        ephemeralPublicKey: fromBytea(propia.ephemeral_pubkey),
      },
      llavero!,
    );
    const contenido = await decryptContent(fromBytea(args.p_ciphertext), fromBytea(args.p_iv), cek);
    expect(contenido).toEqual({ kind: 'CONSULTA', quantity: 250, comment: null });
  });

  it('dos líneas del MISMO distribuidor piden sus públicas UNA sola vez', async () => {
    await sendInquiries([
      linea({ lineId: 'l-1', distributorOrgId: NORDWALZ }),
      linea({ lineId: 'l-2', distributorOrgId: NORDWALZ }),
    ]);
    expect(fetchOrgRecipientsMock).toHaveBeenCalledTimes(1);
    expect(rpcLlamadas).toHaveLength(2);
  });

  it('líneas de distribuidores DISTINTOS piden las públicas de cada uno', async () => {
    const resultados = await sendInquiries([
      linea({ lineId: 'l-1', distributorOrgId: NORDWALZ }),
      linea({ lineId: 'l-2', distributorOrgId: ANADOLU }),
    ]);
    expect(fetchOrgRecipientsMock).toHaveBeenCalledTimes(2);
    expect(resultados.filter((r) => r.ok)).toHaveLength(2);
  });

  it('sin la clave pública de un miembro del distribuidor, esa línea falla y las demás no', async () => {
    publicasPorOrg.set(ANADOLU, [
      { memberId: 'yo', orgId: ANADOLU, publicKey: llavero!.publicKey },
      { memberId: 'anadolu-1', orgId: ANADOLU, publicKey: null },
    ]);

    const resultados = await sendInquiries([
      linea({ lineId: 'l-ok', distributorOrgId: NORDWALZ }),
      linea({ lineId: 'l-falla', distributorOrgId: ANADOLU }),
    ]);

    expect(resultados).toEqual([
      { lineId: 'l-ok', distributorOrgId: NORDWALZ, ok: true },
      {
        lineId: 'l-falla',
        distributorOrgId: ANADOLU,
        ok: false,
        error: expect.stringMatching(/no ha publicado su clave/i),
      },
    ]);
    // La línea que sí pudo cifrarse SÍ llamó a la base: un fallo ajeno no la
    // bloquea (F-023 — un fallo parcial no se puede tapar con un "no se envió
    // nada" tan cómodo como falso).
    expect(rpcLlamadas).toHaveLength(1);
  });

  it('un rechazo de la base en una línea no impide que la siguiente se intente', async () => {
    // Solo la primera llamada a create_inquiry falla (p. ej. el límite diario
    // de hilos nuevos de ese distribuidor); la segunda línea, ya con el hilo
    // encontrado en vez de creado, no tiene por qué correr la misma suerte.
    rpcErrorQueue = [{ message: 'Límite diario alcanzado' }];

    const resultados = await sendInquiries([
      linea({ lineId: 'l-1', distributorOrgId: NORDWALZ }),
      linea({ lineId: 'l-2', distributorOrgId: NORDWALZ }),
    ]);

    expect(resultados[0]).toMatchObject({ lineId: 'l-1', ok: false, error: expect.stringContaining('Límite diario') });
    expect(resultados[1]).toMatchObject({ lineId: 'l-2', ok: true });
  });
});
