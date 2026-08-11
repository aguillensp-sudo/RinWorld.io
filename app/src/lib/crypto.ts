/**
 * Primitivas de la rebanada E2EE · día 8.
 *
 * **Sin Supabase y sin React a propósito.** Aquí no hay ni una consulta ni un
 * hook: son funciones puras sobre WebCrypto, y por eso se pueden probar enteras
 * sin mockear nada. Lo que toca la base vive en `keys.ts`; lo que toca la
 * pantalla, en `thread-detail.ts`.
 *
 * ── QUÉ ESTÁ DECIDIDO Y NO SE ELIGE AQUÍ ────────────────────────────────────
 *
 * Nada de este fichero es una preferencia. Todo sale del esquema del día 2 o de
 * SP-2, y va con su puntero:
 *
 * - **AES-256-GCM con IV de 12 bytes.** Lo fija `0003`, no el gusto:
 *   `thread_items_iv_len_chk check (octet_length(content_iv) = 12)`. Un IV de 16
 *   lo rechaza la base, no el código.
 * - **X25519 nativo por WebCrypto.** SP-2 lo midió el día 1 y salió al revés de
 *   lo que el plan anticipaba: **no hace falta el fallback a P-256** (F-008).
 *   Si algún día un navegador de la demo no lo soporta, esto revienta con un
 *   error claro en vez de degradar en silencio a una curva distinta — degradar
 *   la curva sin decirlo sería cambiar la promesa del producto sin avisar.
 * - **Una CEK por elemento, envuelta una vez por miembro destinatario.** Es
 *   `thread_item_keys` (`0003:269`), y existe desde el día 2 exactamente para que
 *   hoy no haya que migrar datos cifrados (`0003:265`).
 * - **Un solo blob por elemento**, no una columna por campo (`0003`).
 *
 * ── LO QUE ESTE FICHERO NO HACE, Y NO ES UN OLVIDO ──────────────────────────
 *
 * No hay passphrase, ni respaldo, ni recuperación, ni rotación. `CLAUDE.md` §4:
 * en el MVP las claves viven en memoria de sesión y se pierden al recargar, y
 * **esto NO es una implementación de ADR-001**, que sí las exige en V1.
 *
 * Y el invariante de ADR-001 §8 que hay que tener delante mientras se escribe
 * aquí: **el material de clave no viaja al servidor jamás — ni en payloads, ni
 * en logs, ni en mensajes de error.** Ninguna función de este fichero mete
 * bytes de clave en el texto de una excepción. Si alguien añade un
 * `throw new Error(\`clave: ${…}\`)` para depurar, ese es el agujero.
 */

/** Lo exige `thread_items_iv_len_chk` y `thread_item_keys_wrap_iv_len_chk` (0003). */
export const IV_BYTES = 12;

/** X25519: 32 bytes. Lo exige `members_pubkey_len_chk` (0001:93). */
export const PUBLIC_KEY_BYTES = 32;

/**
 * Etiquetas de dominio de HKDF. Atan cada clave derivada a su propósito: la
 * misma entrada con otro `info` da otra clave, así que una clave de envoltura
 * nunca puede reusarse como otra cosa aunque el secreto compartido coincida.
 */
const INFO_CEK_WRAP = 'bearingworld.io/e2ee/cek-wrap/v1';
const INFO_DEMO_SEED = 'bearingworld.io/demo-keys/v1';

/**
 * Prefijo DER de una clave privada X25519 en PKCS#8 (RFC 8410). Los 32 bytes del
 * escalar van justo detrás.
 *
 * Hace falta porque **WebCrypto no importa una privada X25519 en `raw`**: solo
 * acepta `pkcs8` y `jwk`. Para derivar un par determinista a partir de 32 bytes
 * hay que vestirlos de PKCS#8, y esto es ese traje. Verificado contra la ruta
 * nativa antes de escribirlo: exportar una privada generada por
 * `generateKey`, quedarse con sus últimos 32 bytes y reimportarlos por aquí
 * devuelve la MISMA pública.
 */
const PKCS8_X25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

/**
 * El punto base de Curve25519 (u = 9), en el `raw` de 32 bytes little-endian que
 * pide WebCrypto.
 *
 * Sirve para **sacar la pública de una privada**, que WebCrypto no ofrece de
 * forma directa: la pública *es* el escalar multiplicado por el punto base, así
 * que un `deriveBits` contra este punto la calcula. Sin esto, una clave
 * determinista sería inservible — se tendría la privada y no habría forma de
 * publicar la pública que le corresponde.
 */
const BASEPOINT = new Uint8Array(PUBLIC_KEY_BYTES);
BASEPOINT[0] = 9;

// -----------------------------------------------------------------------------
// bytea ↔ bytes
// -----------------------------------------------------------------------------

/**
 * Bytes → el `\x…` que PostgREST acepta para una columna `bytea`.
 *
 * Va aquí y no suelto en la capa de datos porque el formato es una propiedad del
 * transporte, no de cada consulta: `thread-detail.ts` ya documenta que un
 * `bytea` llega como cadena hex, y las dos direcciones tienen que estar en el
 * mismo sitio o acaban discrepando.
 */
export function toBytea(bytes: Uint8Array): string {
  return `\\x${toHex(bytes)}`;
}

/**
 * Bytes → hexadecimal **pelado, sin el prefijo `\x`**.
 *
 * Es el otro contrato de transporte, y existe porque PostgREST no lleva `bytea`
 * dentro de un JSON: los argumentos de `create_thread_item` (0012 §5) viajan
 * como hex sin prefijo y la función los pasa por `decode(…, 'hex')`. Mandar
 * `\x…` por ahí no daría error — `decode` fallaría con un mensaje sobre dígitos
 * inválidos que no menciona el prefijo.
 */
export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * El `\x…` de PostgREST → bytes. Acepta la cadena con y sin prefijo.
 *
 * Lanza ante lo que no sea hexadecimal en vez de devolver bytes a medias: un
 * ciphertext truncado en silencio se convierte en un fallo de descifrado más
 * abajo, y ese error apunta al sitio equivocado.
 */
export function fromBytea(hex: string): Uint8Array {
  const limpio = hex.startsWith('\\x') ? hex.slice(2) : hex;
  if (limpio.length % 2 !== 0 || /[^0-9a-fA-F]/.test(limpio)) {
    throw new Error('El valor bytea no es hexadecimal válido.');
  }
  const out = new Uint8Array(limpio.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(limpio.substr(i * 2, 2), 16);
  return out;
}

// -----------------------------------------------------------------------------
// El par de claves del miembro
// -----------------------------------------------------------------------------

export interface SessionKeyPair {
  /** No extraíble en el camino aleatorio: no hay ningún motivo para sacarla. */
  privateKey: CryptoKey;
  /** Los 32 bytes que van a `members.public_key`. */
  publicKey: Uint8Array;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) {
    // Pasa en `http://` que no sea localhost: `crypto.subtle` solo existe en
    // contexto seguro. Merece un mensaje propio porque el síntoma —"no puedo
    // leer 'importKey' de undefined"— no se parece en nada a la causa.
    throw new Error(
      'Este navegador no expone WebCrypto. El cifrado extremo a extremo exige un contexto seguro (https o localhost).',
    );
  }
  return s;
}

/**
 * Copia los bytes a un `ArrayBuffer` propio.
 *
 * No es ceremonia de TypeScript, aunque lo parezca: un `Uint8Array` puede ser una
 * **vista parcial** de un buffer mayor, y pasarlo donde se espera un buffer
 * entero es la forma de acabar cifrando o importando bytes de al lado. Copiar
 * cuesta 32 bytes y quita el problema de encima. De paso, `tsc` deja de dudar
 * entre `ArrayBuffer` y `SharedArrayBuffer`.
 */
function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  return copia.buffer;
}

/** La pública que corresponde a una privada, vía punto base. */
async function publicKeyOf(privateKey: CryptoKey): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', BASEPOINT, { name: 'X25519' }, false, []);
  const bits = await subtle().deriveBits({ name: 'X25519', public: base }, privateKey, 256);
  return new Uint8Array(bits);
}

/**
 * Un par nuevo, aleatorio. **Este es el camino real del MVP**: se genera al
 * entrar y se pierde al recargar.
 */
export async function generateKeyPair(): Promise<SessionKeyPair> {
  const kp = (await subtle().generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  return { privateKey: kp.privateKey, publicKey: await publicKeyOf(kp.privateKey) };
}

/**
 * ⚠ EL PAR DETERMINISTA DE LA DEMO (D-08-01, opción (a)). Léelo entero antes de
 * usarlo en cualquier sitio que no sea la demo.
 *
 * **Qué se relaja y qué no.** El servidor sigue sin poder leer nada: no almacena
 * la privada, no la ve pasar y no participa en el descifrado. Lo único que se
 * relaja es **de dónde sale la clave** — en vez de aleatoria por sesión, se
 * deriva de una semilla fija del entorno, para que lo que se cifró al sembrar se
 * pueda descifrar mañana, en otro navegador y en otra sesión.
 *
 * **Por qué hace falta.** Sin esto, `demo_threads.sql` no puede llevar contenido
 * cifrado de verdad y los cinco hilos de la demo enseñan
 * `Contenido cifrado — introduce tu frase de seguridad para ver` en cada
 * elemento. El día 11 es la primera sesión con el socio y el `Plan §3` de ese día
 * pide un *"panel de vista-servidor (comprador vs. lo que almacena Postgres)"*
 * que **necesita** que arriba se lea y abajo no. Con relleno, las dos mitades
 * salen ilegibles y el panel no demuestra nada.
 *
 * **ESTO NO ES ADR-001 NI SE PARECE.** Una clave derivada de una semilla
 * compartida no es una clave de usuario: quien tenga la semilla tiene todas las
 * privadas de la demo. Es aceptable porque los datos de demo son inventados y la
 * semilla no está en el repo (`CLAUDE.md` §1: vive en el entorno). **No debe
 * existir en V1**, y está anotado como divergencia en `findings-register.md`.
 *
 * La derivación es por MIEMBRO, no por organización, porque el esquema pone la
 * clave en `members` (`0001:73`) y la CEK va envuelta por persona (`0003:263`).
 * En el MVP hay un miembro por organización, así que da lo mismo — pero el
 * código tiene que decir la verdad sobre a quién pertenece una clave.
 */
export async function deriveKeyPairFromSeed(
  seed: string,
  memberId: string,
): Promise<SessionKeyPair> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(seed),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const escalar = new Uint8Array(
    await subtle().deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        // El id del miembro va de sal: dos miembros con la misma semilla salen
        // con claves distintas, que es lo mínimo para que la demo tenga dos
        // partes de verdad y no una hablando consigo misma.
        salt: new TextEncoder().encode(memberId),
        info: new TextEncoder().encode(INFO_DEMO_SEED),
      },
      material,
      256,
    ),
  );

  const pkcs8 = new Uint8Array(PKCS8_X25519_PREFIX.length + escalar.length);
  pkcs8.set(PKCS8_X25519_PREFIX, 0);
  pkcs8.set(escalar, PKCS8_X25519_PREFIX.length);

  const privateKey = await subtle().importKey('pkcs8', pkcs8, { name: 'X25519' }, false, [
    'deriveBits',
  ]);
  return { privateKey, publicKey: await publicKeyOf(privateKey) };
}

// -----------------------------------------------------------------------------
// La CEK y su envoltura
// -----------------------------------------------------------------------------

/** Lo que va a una fila de `thread_item_keys`. */
export interface WrappedCek {
  wrappedCek: Uint8Array;
  wrapIv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

/**
 * Una clave de contenido nueva. **Extraíble a propósito**: hay que poder
 * exportarla en `raw` para envolverla una vez por destinatario. Nunca sale de
 * aquí sin envolver.
 */
export async function generateCek(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * El secreto compartido, pasado por HKDF.
 *
 * ⚠ **El secreto X25519 en crudo NO se usa como clave AES**, aunque WebCrypto
 * deje hacerlo y SP-2 lo hiciera así: un spike mide si el navegador puede, no
 * cómo se hace bien. La salida de X25519 no está uniformemente distribuida y
 * usarla directa es el error clásico de este montaje.
 *
 * La sal ata la clave derivada a **este** par de interlocutores: efímera del
 * emisor y pública del destinatario. Las dos partes la reconstruyen sin
 * transmitirla —la efímera viaja en la fila, la propia la conoce cada uno— y una
 * envoltura hecha para otro destinatario no puede abrirse aquí ni por accidente.
 */
async function deriveWrapKey(
  shared: ArrayBuffer,
  ephemeralPublicKey: Uint8Array,
  recipientPublicKey: Uint8Array,
): Promise<CryptoKey> {
  const salt = new Uint8Array(ephemeralPublicKey.length + recipientPublicKey.length);
  salt.set(ephemeralPublicKey, 0);
  salt.set(recipientPublicKey, ephemeralPublicKey.length);

  const material = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(INFO_CEK_WRAP) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Envuelve la CEK para un destinatario con un par efímero de un solo uso.
 *
 * El par efímero es por envoltura, no por sesión ni por elemento: dos
 * destinatarios del mismo elemento reciben dos efímeras distintas. Cuesta lo
 * mismo y evita que la envoltura de A diga algo de la de B.
 */
export async function wrapCekFor(
  cek: CryptoKey,
  recipientPublicKey: Uint8Array,
): Promise<WrappedCek> {
  if (recipientPublicKey.length !== PUBLIC_KEY_BYTES) {
    throw new Error(
      `Una clave pública X25519 tiene ${PUBLIC_KEY_BYTES} bytes y esta tiene ${recipientPublicKey.length}.`,
    );
  }

  const efimero = (await subtle().generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const efimeraPublica = await publicKeyOf(efimero.privateKey);

  const destino = await subtle().importKey('raw', asBuffer(recipientPublicKey), { name: 'X25519' }, false, []);
  const shared = await subtle().deriveBits(
    { name: 'X25519', public: destino },
    efimero.privateKey,
    256,
  );

  const wrapKey = await deriveWrapKey(shared, efimeraPublica, recipientPublicKey);
  const wrapIv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const raw = await subtle().exportKey('raw', cek);
  const wrapped = await subtle().encrypt({ name: 'AES-GCM', iv: wrapIv }, wrapKey, raw);

  return { wrappedCek: new Uint8Array(wrapped), wrapIv, ephemeralPublicKey: efimeraPublica };
}

/**
 * Abre una envoltura con la privada de la sesión.
 *
 * Recibe el par entero y no solo la privada porque **la pública entra en la sal**
 * de HKDF: es lo que ata la envoltura a este destinatario. Pedirla aparte
 * invitaría a pasarla mal.
 */
export async function unwrapCek(w: WrappedCek, keyPair: SessionKeyPair): Promise<CryptoKey> {
  const efimera = await subtle().importKey('raw', asBuffer(w.ephemeralPublicKey), { name: 'X25519' }, false, []);
  const shared = await subtle().deriveBits(
    { name: 'X25519', public: efimera },
    keyPair.privateKey,
    256,
  );

  const wrapKey = await deriveWrapKey(shared, w.ephemeralPublicKey, keyPair.publicKey);
  const raw = await subtle().decrypt(
    { name: 'AES-GCM', iv: asBuffer(w.wrapIv) },
    wrapKey,
    asBuffer(w.wrappedCek),
  );
  return subtle().importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

// -----------------------------------------------------------------------------
// El contenido
// -----------------------------------------------------------------------------

export interface EncryptedContent {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

/**
 * Serializa y cifra el contenido de un elemento.
 *
 * Es JSON y no un formato propio porque lo que va dentro lo declara `0003` como
 * *"el texto del mensaje libre, o la cantidad de la consulta, o todas las cifras
 * de la oferta"* — tres formas distintas en la misma columna. Un formato binario
 * a medida ahorraría bytes que a nadie le sobran y costaría una versión.
 */
export async function encryptContent(value: unknown, cek: CryptoKey): Promise<EncryptedContent> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, cek, bytes);
  return { ciphertext: new Uint8Array(ct), iv };
}

/**
 * Descifra y deserializa. **Lanza si el contenido no abre**, y quien llame decide
 * qué hacer con eso.
 *
 * No devuelve `null` en el catch porque `null` ya significa otra cosa muy
 * concreta en esta pantalla —"cifrado y sin clave en esta sesión" (D-07-05)— y
 * confundir "no tengo la clave" con "la clave no abre esto" taparía justo el
 * fallo que interesa ver: GCM autentica, así que un descifrado que falla es un
 * blob manipulado o una clave equivocada, no un caso normal.
 */
export async function decryptContent(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  cek: CryptoKey,
): Promise<unknown> {
  const plano = await subtle().decrypt(
    { name: 'AES-GCM', iv: asBuffer(iv) },
    cek,
    asBuffer(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plano));
}
