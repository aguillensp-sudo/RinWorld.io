import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_KEY_BYTES, type SessionKeyPair, generateKeyPair, toBytea } from './crypto';
import { adoptKeyring, clearKeyring, currentKeyPair, demoSeed, ensureKeyring, fetchThreadRecipients } from './keys';

/**
 * El llavero. Lo que hay que verificar aquí no es la criptografía —eso es
 * `crypto.test.ts`— sino **qué se escribe en la base y qué se lee de ella**:
 * que la pública se publica de verdad, que dos sesiones concurrentes no dejan
 * dos llaveros distintos, y que un destinatario sin clave llega hasta arriba en
 * vez de desaparecer por el camino.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

const ALPHA = '0a000001-0000-0000-0000-000000000001';
const BETA = '0b000001-0000-0000-0000-000000000001';

interface Escritura {
  tabla: string;
  valores: Record<string, unknown>;
  id: string;
}

const escrituras: Escritura[] = [];
let fallaUpdate: unknown = null;
let filasRpc: unknown[] = [];
const llamadasRpc: { fn: string; args: unknown }[] = [];

/** La fila propia que lee el llavero: sin backup por defecto (miembro del MVP). */
let filaPropia: { public_key: string | null; kdf_params: unknown } | null = { public_key: null, kdf_params: null };
const lecturas: string[] = [];
/** La copia de dispositivo (`device-key.ts`), por miembro. */
const enDispositivo = new Map<string, SessionKeyPair>();

vi.mock('./device-key', () => ({
  loadDeviceKey: (id: string) => Promise.resolve(enDispositivo.get(id) ?? null),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: () => {
            lecturas.push(id);
            return Promise.resolve({ data: filaPropia, error: null });
          },
        }),
      }),
      update: (valores: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          escrituras.push({ tabla, valores, id });
          return Promise.resolve({ error: fallaUpdate });
        },
      }),
    }),
    rpc: (fn: string, args: unknown) => {
      llamadasRpc.push({ fn, args });
      return Promise.resolve({ data: filasRpc, error: null });
    },
  },
}));

beforeEach(() => {
  filaPropia = { public_key: null, kdf_params: null };
  lecturas.length = 0;
  enDispositivo.clear();
  escrituras.length = 0;
  llamadasRpc.length = 0;
  fallaUpdate = null;
  filasRpc = [];
  clearKeyring();
});

afterEach(() => {
  clearKeyring();
  delete (import.meta.env as Record<string, unknown>).VITE_DEMO_KEY_SEED;
});

function ponSemilla(valor: string | undefined) {
  if (valor === undefined) delete (import.meta.env as Record<string, unknown>).VITE_DEMO_KEY_SEED;
  else (import.meta.env as Record<string, unknown>).VITE_DEMO_KEY_SEED = valor;
}

/** Un miembro del MVP, ya ACTIVE y sin backup: el camino de siempre, que nunca da `null`. */
async function montar(id: string): Promise<SessionKeyPair> {
  const par = await ensureKeyring(id, 'ACTIVE');
  if (!par) throw new Error('el camino del MVP siempre da un par');
  return par;
}

describe('ANCLA · montar el llavero publica la clave pública', () => {
  it('escribe los 32 bytes en members.public_key del miembro que entra', async () => {
    const par = await montar(ALPHA);

    expect(par.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toEqual({
      tabla: 'members',
      valores: { public_key: toBytea(par.publicKey) },
      id: ALPHA,
    });
  });

  it('sin publicar, la otra parte no podría escribirle: por eso NO se calla el fallo', async () => {
    fallaUpdate = { message: 'permission denied for table members' };
    await expect(montar(ALPHA)).rejects.toBeTruthy();
    expect(currentKeyPair()).toBeNull();
  });

  it('tras un fallo se puede reintentar entero, no se queda pegado', async () => {
    fallaUpdate = { message: 'red caída' };
    await expect(montar(ALPHA)).rejects.toBeTruthy();

    fallaUpdate = null;
    const par = await montar(ALPHA);
    expect(par.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
    expect(currentKeyPair()).not.toBeNull();
  });
});

describe('concurrencia', () => {
  it('dos llamadas a la vez dan UN par y UNA escritura', async () => {
    // `useSession` resuelve dos veces casi a la vez —`getSession()` y
    // `onAuthStateChange`—. Con el camino aleatorio, dos derivaciones en paralelo
    // darían dos pares distintos: el segundo pisaría la pública del primero y lo
    // cifrado con la primera dejaría de abrirse sin que nadie se enterara.
    const [a, b] = await Promise.all([montar(ALPHA), montar(ALPHA)]);

    expect(toBytea(a.publicKey)).toBe(toBytea(b.publicKey));
    expect(escrituras).toHaveLength(1);
  });

  it('cerrar sesión tira el llavero', async () => {
    await montar(ALPHA);
    expect(currentKeyPair()).not.toBeNull();
    clearKeyring();
    expect(currentKeyPair()).toBeNull();
  });
});

describe('la semilla de demo (D-08-01 a)', () => {
  it('sin semilla, `demoSeed()` es null y recargar da otra clave', async () => {
    ponSemilla(undefined);
    expect(demoSeed()).toBeNull();

    const antes = await montar(ALPHA);
    clearKeyring(); // ≡ recargar la página
    const despues = await montar(ALPHA);

    // Es el comportamiento correcto del MVP (CLAUDE.md §4), no un fallo: lo
    // cifrado para la clave anterior deja de abrirse y la pantalla lo dice.
    expect(toBytea(antes.publicKey)).not.toBe(toBytea(despues.publicKey));
  });

  it('con semilla, recargar devuelve LA MISMA clave', async () => {
    ponSemilla('semilla-de-pruebas');

    const antes = await montar(ALPHA);
    clearKeyring();
    const despues = await montar(ALPHA);

    expect(toBytea(antes.publicKey)).toBe(toBytea(despues.publicKey));
  });

  it('con la misma semilla, dos miembros siguen siendo dos partes distintas', async () => {
    ponSemilla('semilla-de-pruebas');
    const a = await montar(ALPHA);
    clearKeyring();
    const b = await montar(BETA);

    expect(toBytea(a.publicKey)).not.toBe(toBytea(b.publicKey));
  });

  it('una semilla vacía cuenta como ausente', () => {
    ponSemilla('');
    expect(demoSeed()).toBeNull();
  });
});

describe('REG-07 (ADR-001): quien tiene backup no estrena par en cada sesión', () => {
  it('ANCLA · un miembro REGISTERED no publica nada ni lee nada: su par lo da REG-07', async () => {
    expect(await ensureKeyring(ALPHA, 'REGISTERED')).toBeNull();
    expect(escrituras).toHaveLength(0);
    expect(lecturas).toHaveLength(0);
    expect(currentKeyPair()).toBeNull();
  });

  it('ANCLA · con backup y la copia de este dispositivo: usa esa copia y NO publica', async () => {
    const par = await generateKeyPair();
    enDispositivo.set(ALPHA, par);
    filaPropia = { public_key: toBytea(par.publicKey), kdf_params: { algo: 'argon2id' } };

    expect(await ensureKeyring(ALPHA, 'ACTIVE')).toBe(par);
    expect(currentKeyPair()).toBe(par);
    expect(escrituras).toHaveLength(0);
  });

  it('con backup y sin copia en este dispositivo: sin llavero (REC-01) y sin publicar otra', async () => {
    ponSemilla('semilla-de-pruebas');
    filaPropia = { public_key: toBytea(new Uint8Array(32).fill(5)), kdf_params: { algo: 'argon2id' } };

    expect(await ensureKeyring(ALPHA, 'ACTIVE')).toBeNull();
    expect(currentKeyPair()).toBeNull();
    expect(escrituras).toHaveLength(0);
  });

  it('una copia de dispositivo que no es la pública publicada no se usa', async () => {
    enDispositivo.set(ALPHA, await generateKeyPair());
    filaPropia = { public_key: toBytea(new Uint8Array(32).fill(5)), kdf_params: { algo: 'argon2id' } };

    expect(await ensureKeyring(ALPHA, 'KEY_ACTIVE')).toBeNull();
    expect(escrituras).toHaveLength(0);
  });

  it('el par que adopta REG-07 es el llavero de la sesión, sin volver a la base', async () => {
    const par = await generateKeyPair();
    adoptKeyring(ALPHA, par);
    expect(await ensureKeyring(ALPHA, 'KEY_ACTIVE')).toBe(par);
    expect(lecturas).toHaveLength(0);
    expect(escrituras).toHaveLength(0);
  });
});

describe('las públicas de la contraparte', () => {
  it('van por el RPC de 0012, no por una consulta a members', async () => {
    filasRpc = [];
    await fetchThreadRecipients('11110000-0000-0000-0000-000000000001');

    // Si esto pasara a ser un `from('members')`, alguien habría relajado
    // `members_select_own_org` (0001:207) y con ella se irían `email` y los
    // cuatro campos del respaldo de clave (ADR-001 §8).
    expect(llamadasRpc).toEqual([
      { fn: 'thread_public_keys', args: { t_id: '11110000-0000-0000-0000-000000000001' } },
    ]);
  });

  it('ANCLA · una clave publicada llega como 32 bytes', async () => {
    filasRpc = [{ member_id: BETA, org_id: 'org-beta', public_key: `\\x${'ab'.repeat(32)}` }];

    const [uno] = await fetchThreadRecipients('hilo-1');
    expect(uno!.memberId).toBe(BETA);
    expect(uno!.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
  });

  it('y quien NO la ha publicado llega igualmente, con la clave a null', async () => {
    // ÁMBITO: la misma llamada devuelve los dos, así que "llega null" se mide
    // contra una fila que sí trae clave, no contra una lista vacía.
    filasRpc = [
      { member_id: ALPHA, org_id: 'org-alpha', public_key: `\\x${'ab'.repeat(32)}` },
      { member_id: BETA, org_id: 'org-beta', public_key: null },
    ];

    const filas = await fetchThreadRecipients('hilo-1');
    expect(filas).toHaveLength(2);
    expect(filas[0]!.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
    expect(filas[1]!.publicKey).toBeNull();
  });
});
