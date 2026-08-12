/**
 * Tipos de `demo-content.mjs`.
 *
 * El módulo se queda en `.mjs` a propósito: lo consume `node` directamente desde
 * el generador de la siembra, y ahí ya funciona. Lo que le faltaba era poder
 * importarse desde TypeScript sin `any` — el reseteo de fixture del e2een es
 * TypeScript y con `noImplicitAny` un `any` implícito ahí significaría que nadie
 * comprueba las claves que se escriben en la base.
 *
 * Si el `.mjs` gana un campo y esto no, `tsc` lo dice en el consumidor.
 */

export declare const ALPHA_ORG: string;
export declare const NORDWALZ_ORG: string;
export declare const ALPHA_MIEMBRO: string;
export declare const NORDWALZ_MIEMBRO: string;
export declare const MIEMBROS_POR_ORG: Record<string, string[]>;

export interface HiloDemo {
  id: string;
  orgAlta: string;
  estado: string;
  hace: string;
  horas: number;
  creadoPor?: string;
  comentario: string;
  item: {
    id: string;
    senderOrg: string;
    senderMember: string;
    tipo: 'MENSAJE' | 'CONSULTA' | 'OFERTA';
    partNumber: string | null;
    brand: string | null;
    estadoConsulta: string | null;
    estadoOferta: string | null;
    contenido: unknown;
  };
}

export declare const HILOS: HiloDemo[];
export declare const HILO_IDS: string[];

/** Una fila de `thread_items`, con el contenido ya cifrado en hex pelado. */
export interface ItemSembrado {
  id: string;
  thread_id: string;
  sender_org_id: string;
  sender_member_id: string;
  item_type: string;
  part_number: string | null;
  brand: string | null;
  estado_consulta: string | null;
  estado_oferta: string | null;
  ciphertextHex: string;
  ivHex: string;
  /** Antigüedad del elemento. Se convierte a timestamp en cada consumidor. */
  horas: number;
}

/** Una fila de `thread_item_keys`: la CEK envuelta para un miembro. */
export interface ClaveEnvuelta {
  item_id: string;
  recipient_member_id: string;
  wrappedCekHex: string;
  wrapIvHex: string;
  ephemeralPubkeyHex: string;
}

export interface SiembraCifrada {
  publicKeys: { id: string; publicKeyHex: string }[];
  items: ItemSembrado[];
  wrapped: ClaveEnvuelta[];
}

/**
 * Cifra la siembra entera con la semilla dada.
 *
 * **Lanza si lo que acaba de cifrar no se abre con un par derivado de nuevo**,
 * que es lo único que comprueba de verdad lo que decide D-08-01: que la semilla
 * vuelva a dar la misma clave en otra sesión.
 */
export declare function buildSeed(semilla: string): Promise<SiembraCifrada>;
