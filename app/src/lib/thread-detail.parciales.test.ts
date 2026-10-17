import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contactOrganization, decryptItem, sendInquiries } from './thread-detail';
import { generateKeyPair, type SessionKeyPair } from './crypto';
import type { ThreadRecipient } from './keys';

/**
 * PARCIALES · conversational-search/results-row-actions#4 y #5, escrito desde la spec.
 * Se mockean solo `./supabase` (un registro de llamadas RPC) y `./keys`; el cifrado es el de verdad.
 */

const rpcLlamadas: { fn: string; args: Record<string, unknown> }[] = [];
let llavero: SessionKeyPair | null = null;
let publicasPorOrg = new Map<string, ThreadRecipient[]>();

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcLlamadas.push({ fn, args });
      return Promise.resolve({ data: fn === 'open_thread' ? 'hilo-nuevo' : [{ ok: true }], error: null });
    },
    from: (tabla: string) => {
      rpcLlamadas.push({ fn: `from:${tabla}`, args: {} });
      throw new Error(`escritura directa no esperada: ${tabla}`);
    },
  },
}));
vi.mock('./keys', () => ({
  currentKeyPair: () => llavero,
  fetchThreadRecipients: async () => [],
  fetchOrgRecipients: async (orgId: string) => publicasPorOrg.get(orgId) ?? [],
}));

const MI_ORG = 'org-mia';
const NORDWALZ = 'org-nordwalz';
const ANADOLU = 'org-anadolu';

let destinatario: SessionKeyPair;

beforeEach(async () => {
  rpcLlamadas.length = 0;
  llavero = await generateKeyPair();
  destinatario = await generateKeyPair();
  publicasPorOrg = new Map([
    [MI_ORG, [{ memberId: 'yo', orgId: MI_ORG, publicKey: llavero.publicKey }]],
    [NORDWALZ, [{ memberId: 'nw-1', orgId: NORDWALZ, publicKey: destinatario.publicKey }]],
    [ANADOLU, [{ memberId: 'an-1', orgId: ANADOLU, publicKey: destinatario.publicKey }]],
  ]);
});

describe('conversational-search/results-row-actions', () => {
  /*
   * Escenario «contactar distribuidor sin hilo previo (hilo libre)» (#4)
   *   ...
   *   AND al enviar el primer mensaje se crea el hilo libre con ese distribuidor y se abre en MSG-02
   *   AND no se requiere cantidad ni referencia
   * (El cuadro «Primer mensaje» desplegado, la creación y la apertura del hilo están probados en
   * OrganizationProfile.test.tsx; aquí, que lo que se envía no lleva ni cantidad ni referencia.)
   */
  it('conversational-search/results-row-actions#4 · el primer mensaje crea el hilo con SOLO texto: sin cantidad, sin referencia, sin línea', async () => {
    const hilo = await contactOrganization(NORDWALZ, MI_ORG, '  Hola, somos Alpha  ');
    expect(hilo).toBe('hilo-nuevo');

    // Una única llamada, a open_thread, y su única información de negocio es el cifrado
    expect(rpcLlamadas.map((l) => l.fn)).toEqual(['open_thread']);
    const args = rpcLlamadas[0]!.args as {
      p_org_id: string;
      p_ciphertext: string;
      p_iv: string;
      p_keys: { member_id: string; wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[];
    };
    expect(Object.keys(args).sort()).toEqual(['p_ciphertext', 'p_iv', 'p_keys', 'p_org_id']);
    expect(args.p_org_id).toBe(NORDWALZ);

    // Y lo cifrado, abierto con la clave del distribuidor, es un MENSAJE con el texto y nada más
    const suya = args.p_keys.find((k) => k.member_id === 'nw-1')!;
    const contenido = await decryptItem(
      {
        type: 'MENSAJE',
        ciphertext: args.p_ciphertext,
        iv: args.p_iv,
        wrapped: { wrappedCek: suya.wrapped_cek, wrapIv: suya.wrap_iv, ephemeralPublicKey: suya.ephemeral_pubkey },
      },
      destinatario,
    );
    expect(contenido).toEqual({ kind: 'MENSAJE', text: 'Hola, somos Alpha' });
  });

  /*
   * Escenario «consultar seleccionados en lote» (#5)
   *   ...
   *   THEN  el sistema envía una tarjeta de consulta a cada distribuidor de las líneas seleccionadas
   *         sin abrir ningún hilo en pantalla
   *   AND   las filas de un mismo distribuidor se agrupan en su único hilo existente (nunca un hilo por referencia)
   * Parte de cliente de la agrupación: un lote de varias líneas se envía SOLO como tarjetas de consulta
   * por línea (`create_inquiry`, que encuentra el hilo del distribuidor); el cliente nunca abre ni crea un hilo
   * por su cuenta, ni pasa un hilo propio por referencia.
   */
  it('conversational-search/results-row-actions#5 · un lote de tres líneas de dos distribuidores son tres create_inquiry por línea y ninguna creación de hilo desde el cliente', async () => {
    const resultados = await sendInquiries(
      [
        { lineId: 'l-1', distributorOrgId: NORDWALZ, quantity: 10 },
        { lineId: 'l-2', distributorOrgId: NORDWALZ, quantity: 20 },
        { lineId: 'l-3', distributorOrgId: ANADOLU, quantity: 30 },
      ],
      MI_ORG,
    );
    expect(resultados.map((r) => r.ok)).toEqual([true, true, true]);

    expect(rpcLlamadas.map((l) => l.fn)).toEqual(['create_inquiry', 'create_inquiry', 'create_inquiry']);
    expect(rpcLlamadas.map((l) => l.args.p_line_id)).toEqual(['l-1', 'l-2', 'l-3']);
    // la agrupación en hilo la decide la base a partir de la línea: el cliente no envía ningún id/destino de hilo
    for (const l of rpcLlamadas) {
      expect(Object.keys(l.args).some((k) => /thread|org_id/i.test(k))).toBe(false);
    }
    expect(rpcLlamadas.some((l) => l.fn === 'open_thread' || l.fn.startsWith('from:'))).toBe(false);
  });
});
