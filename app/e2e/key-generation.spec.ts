import './env';
import { argon2id } from 'hash-wasm';
import { expect, test, type Page, type Request } from '@playwright/test';
import { ALPHA, haveCreds, NO_SESSION, rewriteProfileState, signIn } from './fixtures';

/**
 * REG-07 · Generar las claves y guardar el backup · en un navegador real. Escrito a
 * mano por Claude Code, como la pantalla (criptografía, Plan §4.3).
 *
 * **NO ESCRIBE NADA EN LA BASE.** Se llega como en REG-05/06 (el navegador reescribe
 * el `state` del perfil de ALPHA a `REGISTERED`; en la base sigue ACTIVE) y las dos
 * llamadas que escriben —`store_key_backup` y `confirm_key_backup`— las contesta el
 * propio test, que además devuelve en la relectura del paso 4 lo que el navegador
 * subió. Las funciones de la base tienen su banco en `supabase/tests` (0048).
 *
 * **Lo que solo se puede ver aquí:**
 *   · que Argon2id corre en un Web Worker (ADR-001 §9) y termina en el navegador;
 *   · que la subida lleva los cinco campos de ADR-001 §7.1 y NINGUNA petición lleva
 *     la frase;
 *   · que lo subido se abre FUERA del navegador —aquí, en Node, con otra
 *     implementación— con la frase, la sal y los parámetros de ADR-001 y el id del
 *     miembro como AAD, y que de dentro sale la privada de la pública publicada. Es
 *     la prueba de que REC-01 podrá recuperar lo que REG-07 guarda;
 *   · que la privada queda en IndexedDB, no extraíble;
 *   · que un fallo de red en el paso 3 se reintenta con el MISMO backup.
 */
if (process.env.CI && !haveCreds) {
  throw new Error('En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas REG-07 no se prueba y el verde no significa nada.');
}

const FRASE = 'mesa perro azul lluvia cobre';
const CASILLA =
  'Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente.';
const TITULO = 'Generando tus claves de seguridad';
const LISTO = '¡Todo listo! Tu cuenta está protegida.';

type Subida = {
  p_public_key: string;
  p_encrypted_key_blob: string;
  p_key_iv: string;
  p_argon2_salt: string;
  p_kdf_params: Record<string, unknown>;
  p_key_verifier: string;
};

interface Servidor {
  subidas: Subida[];
  confirmaciones: Array<{ p_public_key: string }>;
  memberId: string | null;
  /** Cuántas subidas fallan antes de aceptar una. */
  fallosDeSubida: number;
}

/** El falso servidor de REG-07 y el estado del perfil, que pasa a KEY_ACTIVE al confirmar. */
async function montarServidor(page: Page, fallosDeSubida = 0): Promise<Servidor> {
  const s: Servidor = { subidas: [], confirmaciones: [], memberId: null, fallosDeSubida };
  let estado = 'REGISTERED';

  await rewriteProfileState(page, () => estado);

  await page.route(/\/rest\/v1\/rpc\/store_key_backup/, async (route) => {
    s.subidas.push(route.request().postDataJSON() as Subida);
    if (s.fallosDeSubida > 0) {
      s.fallosDeSubida -= 1;
      await route.fulfill({ status: 503, json: { message: 'Service Unavailable' } });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  // Paso 4: la relectura del backup devuelve lo último que se subió. Desde 0052 no es un `select` de la tabla
  // (el blob ya no se lee así) sino `read_pending_key_backup`; el id del miembro, que era la AAD que el test
  // necesita, ya no va en la URL: sale del `sub` del JWT de la petición.
  await page.route(/\/rest\/v1\/rpc\/read_pending_key_backup/, async (route) => {
    const jwt = (route.request().headers().authorization ?? '').replace(/^Bearer\s+/i, '');
    try {
      s.memberId = (JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: string }).sub ?? null;
    } catch {
      s.memberId = null;
    }
    const ultima = s.subidas.at(-1);
    const fila = ultima
      ? {
          public_key: ultima.p_public_key,
          encrypted_key_blob: ultima.p_encrypted_key_blob,
          key_iv: ultima.p_key_iv,
          argon2_salt: ultima.p_argon2_salt,
          kdf_params: ultima.p_kdf_params,
        }
      : null;
    await route.fulfill({ status: 200, json: fila ? [fila] : [] });
  });

  await page.route(/\/rest\/v1\/rpc\/confirm_key_backup/, async (route) => {
    s.confirmaciones.push(route.request().postDataJSON() as { p_public_key: string });
    estado = 'KEY_ACTIVE';
    await route.fulfill({ status: 204, body: '' });
  });

  return s;
}

/** Login → REG-05 → REG-06 → REG-07. */
async function hastaReg07(page: Page) {
  await signIn(page, ALPHA);
  await page.getByRole('button', { name: 'Entendido, crear mi frase de seguridad' }).click();
  await page.getByLabel('Backup passphrase', { exact: true }).fill(FRASE);
  await expect(page.getByTestId('strength-label')).toHaveText(/^(Fuerte|Muy fuerte)$/);
  await page.getByLabel('Repetir backup passphrase', { exact: true }).fill(FRASE);
  await page.getByRole('checkbox', { name: CASILLA }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: TITULO })).toBeVisible();
}

function bytes(bytea: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(bytea.replace(/^\\x/, ''), 'hex'));
}

/** La pública X25519 de 32 bytes de privada, con la WebCrypto de Node. */
async function publicaDe(privada: Uint8Array): Promise<Uint8Array> {
  const prefijo = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
  const pkcs8 = new Uint8Array([...prefijo, ...privada]);
  const clave = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, true, ['deriveBits']);
  const jwk = await crypto.subtle.exportKey('jwk', clave);
  return Uint8Array.from(Buffer.from(jwk.x ?? '', 'base64url'));
}

test.describe('REG-07 · generar las claves y guardar el backup · ADMIN en REGISTERED', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('ANCLA · los cuatro pasos en el navegador, la subida es la de ADR-001 y se abre fuera con la frase', async ({
    page,
  }) => {
    const filtradas: string[] = [];
    const vigilar = (req: Request) => {
      const cuerpo = req.postData() ?? '';
      const hex = Buffer.from(FRASE, 'utf8').toString('hex');
      if (req.url().includes(encodeURIComponent(FRASE)) || cuerpo.includes(FRASE) || cuerpo.includes(hex)) {
        filtradas.push(`${req.method()} ${req.url()}`);
      }
    };
    page.on('request', vigilar);
    const workers: string[] = [];
    page.on('worker', (w) => workers.push(w.url()));

    const servidor = await montarServidor(page);
    await hastaReg07(page);
    await expect(page.getByText(LISTO)).toBeVisible({ timeout: 30_000 });

    // Argon2id, fuera del hilo principal.
    expect(workers.some((u) => u.includes('argon2'))).toBe(true);

    // La subida: los cinco campos y el verificador de la frase (0053), con sus tamaños.
    expect(servidor.subidas).toHaveLength(1);
    const subida = servidor.subidas[0]!;
    expect(Object.keys(subida).sort()).toEqual(
      ['p_argon2_salt', 'p_encrypted_key_blob', 'p_key_iv', 'p_kdf_params', 'p_key_verifier', 'p_public_key'].sort(),
    );
    expect(bytes(subida.p_public_key)).toHaveLength(32);
    expect(bytes(subida.p_encrypted_key_blob)).toHaveLength(48);
    expect(bytes(subida.p_key_iv)).toHaveLength(12);
    expect(bytes(subida.p_argon2_salt)).toHaveLength(32);
    expect(bytes(subida.p_key_verifier)).toHaveLength(32);
    expect(subida.p_kdf_params).toEqual({ algo: 'argon2id', m: 65536, t: 3, p: 4, v: 19 });
    expect(servidor.confirmaciones).toEqual([{ p_public_key: subida.p_public_key }]);
    expect(filtradas).toEqual([]);

    // Se abre FUERA del navegador: Argon2id de hash-wasm en Node + AES-GCM de Node.
    expect(servidor.memberId).not.toBeNull();
    const envoltura = await argon2id({
      password: FRASE.normalize('NFC'),
      salt: bytes(subida.p_argon2_salt),
      memorySize: 65536,
      iterations: 3,
      parallelism: 4,
      hashLength: 32,
      outputType: 'binary',
    });
    const clave = await crypto.subtle.importKey('raw', new Uint8Array(envoltura), 'AES-GCM', false, ['decrypt']);
    const privada = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(subida.p_key_iv), additionalData: new TextEncoder().encode(servidor.memberId!) },
        clave,
        bytes(subida.p_encrypted_key_blob),
      ),
    );
    expect(privada).toHaveLength(32);
    expect(Buffer.from(await publicaDe(privada)).toString('hex')).toBe(
      Buffer.from(bytes(subida.p_public_key)).toString('hex'),
    );

    // Con OTRA frase no se abre.
    const otra = await argon2id({
      password: 'otra frase distinta de la buena',
      salt: bytes(subida.p_argon2_salt),
      memorySize: 65536,
      iterations: 3,
      parallelism: 4,
      hashLength: 32,
      outputType: 'binary',
    });
    const claveMala = await crypto.subtle.importKey('raw', new Uint8Array(otra), 'AES-GCM', false, ['decrypt']);
    await expect(
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(subida.p_key_iv), additionalData: new TextEncoder().encode(servidor.memberId!) },
        claveMala,
        bytes(subida.p_encrypted_key_blob),
      ),
    ).rejects.toThrow();

    // La privada se queda en este dispositivo, no extraíble y con la pública subida.
    const guardada = await page.evaluate(
      (id) =>
        new Promise<{ extractable: boolean; publicHex: string } | null>((resolve) => {
          const open = indexedDB.open('bearingworld-keys');
          open.onsuccess = () => {
            const get = open.result.transaction('device-keys').objectStore('device-keys').get(id);
            get.onsuccess = () => {
              const v = get.result as { privateKey: CryptoKey; publicKey: Uint8Array } | undefined;
              resolve(
                v
                  ? {
                      extractable: v.privateKey.extractable,
                      publicHex: Array.from(v.publicKey, (b) => b.toString(16).padStart(2, '0')).join(''),
                    }
                  : null,
              );
            };
          };
          open.onerror = () => resolve(null);
        }),
      servidor.memberId!,
    );
    expect(guardada).toEqual({ extractable: false, publicHex: subida.p_public_key.replace(/^\\x/, '') });

    // «Continuar» relee el perfil (ya KEY_ACTIVE) y lleva a REG-09.
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toHaveCount(0);
    await expect(page.getByText(/ya está activa/)).toBeVisible();
  });

  test('un fallo de red en el paso 3: el aviso de la spec, y «Reintentar» sube el MISMO backup', async ({ page }) => {
    const servidor = await montarServidor(page, 1);
    await hastaReg07(page);

    await expect(page.getByRole('alert')).toContainText(
      'No hemos podido guardar el backup. Comprueba tu conexión e inténtalo de nuevo.',
      { timeout: 30_000 },
    );
    await expect(page.getByText('Error de conexión')).toBeVisible();
    expect(servidor.confirmaciones).toHaveLength(0);

    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText(LISTO)).toBeVisible({ timeout: 30_000 });
    expect(servidor.subidas).toHaveLength(2);
    expect(servidor.subidas[1]).toEqual(servidor.subidas[0]);
    expect(servidor.confirmaciones).toHaveLength(1);
  });

  test('la pantalla tiene scroll propio: en una ventana baja «Continuar» se alcanza con la rueda', async ({ page }) => {
    await montarServidor(page);
    await page.setViewportSize({ width: 1280, height: 480 });
    await hastaReg07(page);
    const boton = page.getByRole('button', { name: 'Continuar' });
    await expect(boton).toBeAttached({ timeout: 30_000 });
    await expect(boton).not.toBeInViewport();
    await page.getByRole('heading', { level: 1, name: TITULO }).hover();
    await page.mouse.wheel(0, 2000);
    await expect(boton).toBeInViewport();
  });
});
