/**
 * La definición de la siembra de demo, en un solo sitio.
 *
 * ── POR QUÉ ESTE FICHERO EXISTE ─────────────────────────────────────────────
 *
 * Hay **dos** consumidores de estos datos y tienen que ver exactamente lo mismo:
 *
 *   1. `generate-demo-content.mjs` → emite `demo_threads.sql`, que es lo que se
 *      aplica a una base desde cero.
 *   2. `app/e2e/fixture.setup.ts` → repone la siembra **antes de cada corrida de
 *      Playwright**, para que la suite sea idempotente.
 *
 * Si cada uno llevara su propia copia, el día que alguien cambie un `part_number`
 * en uno de los dos, la suite pasaría en local y fallaría en CI —o al revés— y el
 * síntoma no apuntaría a la causa. Es el mismo razonamiento por el que el
 * generador **importa `crypto.ts`** en vez de copiar la criptografía.
 *
 * Aquí no hay ni SQL ni cliente de Supabase: solo los datos y el cifrado. Cada
 * consumidor decide cómo los escribe.
 */

const { deriveKeyPairFromSeed, encryptContent, generateCek, toHex, wrapCekFor } =
  await import('../../app/src/lib/crypto.ts');

// -----------------------------------------------------------------------------
// Quién es quién
//
// Solo Alpha y Nordwälz tienen cuenta (`dev_accounts.sql`). Las otras cuatro
// organizaciones del guion existen como filas de `organizations` y no tienen
// miembros, así que no hay a quién envolverle una CEK: sus hilos se cifran solo
// para Alpha, que es quien los va a leer en la demo.
// -----------------------------------------------------------------------------
export const ALPHA_ORG = 'a1000000-0000-4000-8000-000000000001';
export const NORDWALZ_ORG = 'b2000000-0000-4000-8000-000000000002';
export const ALPHA_MIEMBRO = 'a1000000-0000-4000-8000-00000000000a';
export const NORDWALZ_MIEMBRO = 'b2000000-0000-4000-8000-00000000000b';

export const MIEMBROS_POR_ORG = {
  [ALPHA_ORG]: [ALPHA_MIEMBRO],
  [NORDWALZ_ORG]: [NORDWALZ_MIEMBRO],
};

const dias = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

/**
 * Los cinco hilos y su único elemento.
 *
 * Los metadatos van en claro y son lo que MSG-01 pinta en la vista previa. Cada
 * hilo cubre uno de los cinco estados del CHECK de `thread-lifecycle`, y esa es
 * la razón entera de que sean cinco y no uno.
 */
export const HILOS = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    orgAlta: NORDWALZ_ORG,
    estado: 'CON OFERTA PENDIENTE',
    hace: '2 hours',
    horas: 2,
    comentario: 'Alpha ↔ Nordwälz Lager · el vendedor con quien se negocia en vivo en la demo',
    item: {
      id: '12111111-0000-4000-8000-000000000001',
      senderOrg: NORDWALZ_ORG,
      senderMember: NORDWALZ_MIEMBRO,
      tipo: 'OFERTA',
      partNumber: '6205-2RS',
      brand: 'NSK',
      estadoConsulta: null,
      estadoOferta: 'Pendiente',
      // La línea que el guion llama "la más atractiva": 1250 unidades en 2 días,
      // de Nordwälz. `shippingCost` va a `null` y no a `0` a propósito: un cero
      // dice "portes gratis" (`offer-card`).
      contenido: {
        kind: 'OFERTA',
        unitPrice: 4.82,
        currency: 'EUR',
        quantity: 1250,
        leadTimeDays: 2,
        shippingCost: null,
        shippingCostCurrency: null,
        validUntil: dias(30),
        notes: 'Precio por unidad para el lote completo. Portes por confirmar.',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    orgAlta: 'c3000000-0000-4000-8000-000000000003',
    estado: 'CON CONSULTA PENDIENTE',
    hace: '5 hours',
    horas: 5,
    comentario: 'Alpha ↔ Cuscinetti Padana',
    item: {
      id: '12111111-0000-4000-8000-000000000002',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'CONSULTA',
      partNumber: 'NU2210-E-TVP2',
      brand: 'INA',
      estadoConsulta: 'Pendiente',
      estadoOferta: null,
      contenido: {
        kind: 'CONSULTA',
        quantity: 240,
        comment: '¿Podríais servirlas en dos entregas, mitad ahora y mitad en octubre?',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    orgAlta: 'd4000000-0000-4000-8000-000000000004',
    estado: 'ABIERTO',
    hace: '1 day',
    horas: 24,
    creadoPor: 'd4000000-0000-4000-8000-000000000004',
    comentario: 'Alpha ↔ Łożyska Wschód',
    item: {
      id: '12111111-0000-4000-8000-000000000003',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'MENSAJE',
      partNumber: null,
      brand: null,
      estadoConsulta: null,
      estadoOferta: null,
      contenido: {
        kind: 'MENSAJE',
        text: 'Buenos días: ¿seguís trabajando la serie NU2200? Preguntamos por volumen recurrente.',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000004',
    orgAlta: 'e5000000-0000-4000-8000-000000000005',
    estado: 'ACUERDO ALCANZADO',
    hace: '3 days',
    horas: 72,
    comentario: 'Alpha ↔ Roulements Rhône',
    item: {
      id: '12111111-0000-4000-8000-000000000004',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'OFERTA',
      partNumber: '22316-E',
      brand: 'Timken',
      estadoConsulta: null,
      estadoOferta: 'Aceptada',
      // Esta sí lleva portes informados, para que el panel del día 11 enseñe el
      // contraste con el `null` del hilo 1: son dos cosas distintas y la pantalla
      // las pinta distinto.
      contenido: {
        kind: 'OFERTA',
        unitPrice: 88.5,
        currency: 'EUR',
        quantity: 60,
        leadTimeDays: 12,
        shippingCost: 145,
        shippingCostCurrency: 'EUR',
        validUntil: dias(-4),
        notes: null,
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000005',
    orgAlta: 'f6000000-0000-4000-8000-000000000006',
    estado: 'CERRADO SIN ACUERDO',
    hace: '7 days',
    horas: 168,
    comentario: 'Alpha ↔ Anadolu Rulman · el hilo cerrado de D-07-01',
    item: {
      id: '12111111-0000-4000-8000-000000000005',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'MENSAJE',
      partNumber: null,
      brand: null,
      estadoConsulta: null,
      estadoOferta: null,
      contenido: {
        kind: 'MENSAJE',
        text: 'Gracias por la información. De momento lo dejamos aquí; si cambian los plazos, os escribimos.',
      },
    },
  },
];

export const HILO_IDS = HILOS.map((h) => h.id);

/**
 * Cifra la siembra entera con la semilla dada.
 *
 * ⚠ **Comprueba que lo que acaba de cifrar se abre con un par derivado DE NUEVO**,
 * y lanza si no. Descifrar con el mismo objeto que cifró no probaría lo que
 * decide D-08-01: que la semilla vuelva a dar la misma clave **en otra sesión**.
 * Si esto falla, el consumidor no debe escribir nada — una siembra que no se
 * descifra es lo que había antes del día 8, y encima con pinta de arreglada.
 */
export async function buildSeed(semilla) {
  const { decryptContent, unwrapCek } = await import('../../app/src/lib/crypto.ts');

  const claves = new Map();
  for (const miembro of [ALPHA_MIEMBRO, NORDWALZ_MIEMBRO]) {
    claves.set(miembro, await deriveKeyPairFromSeed(semilla, miembro));
  }

  const items = [];
  const wrapped = [];

  for (const hilo of HILOS) {
    const destinatarios = [
      ...(MIEMBROS_POR_ORG[ALPHA_ORG] ?? []),
      ...(MIEMBROS_POR_ORG[hilo.orgAlta] ?? []),
    ];

    const cek = await generateCek();
    const { ciphertext, iv } = await encryptContent(hilo.item.contenido, cek);

    items.push({
      id: hilo.item.id,
      thread_id: hilo.id,
      sender_org_id: hilo.item.senderOrg,
      sender_member_id: hilo.item.senderMember,
      item_type: hilo.item.tipo,
      part_number: hilo.item.partNumber,
      brand: hilo.item.brand,
      estado_consulta: hilo.item.estadoConsulta,
      estado_oferta: hilo.item.estadoOferta,
      ciphertextHex: toHex(ciphertext),
      ivHex: toHex(iv),
      horas: hilo.horas,
    });

    for (const miembro of destinatarios) {
      const w = await wrapCekFor(cek, claves.get(miembro).publicKey);

      const otraSesion = await deriveKeyPairFromSeed(semilla, miembro);
      const abierta = await unwrapCek(w, otraSesion);
      const leido = await decryptContent(ciphertext, iv, abierta);
      if (JSON.stringify(leido) !== JSON.stringify(hilo.item.contenido)) {
        throw new Error(
          `El contenido de ${hilo.item.id} no se recupera igual para ${miembro}. ` +
            'La siembra no se escribe: sería opaca en la demo.',
        );
      }

      wrapped.push({
        item_id: hilo.item.id,
        recipient_member_id: miembro,
        wrappedCekHex: toHex(w.wrappedCek),
        wrapIvHex: toHex(w.wrapIv),
        ephemeralPubkeyHex: toHex(w.ephemeralPublicKey),
      });
    }
  }

  return {
    publicKeys: [...claves.entries()].map(([miembro, par]) => ({
      id: miembro,
      publicKeyHex: toHex(par.publicKey),
    })),
    items,
    wrapped,
  };
}
