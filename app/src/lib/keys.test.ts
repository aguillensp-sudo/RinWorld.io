import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_KEY_BYTES, toBytea } from './crypto';
import { clearKeyring, currentKeyPair, demoSeed, ensureKeyring, fetchThreadRecipients } from './keys';

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

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
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

describe('ANCLA · montar el llavero publica la clave pública', () => {
  it('escribe los 32 bytes en members.public_key del miembro que entra', async () => {
    const par = await ensureKeyring(ALPHA);

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
    await expect(ensureKeyring(ALPHA)).rejects.toBeTruthy();
    expect(currentKeyPair()).toBeNull();
  });

  it('tras un fallo se puede reintentar entero, no se queda pegado', async () => {
    fallaUpdate = { message: 'red caída' };
    await expect(ensureKeyring(ALPHA)).rejects.toBeTruthy();

    fallaUpdate = null;
    const par = await ensureKeyring(ALPHA);
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
    const [a, b] = await Promise.all([ensureKeyring(ALPHA), ensureKeyring(ALPHA)]);

    expect(toBytea(a.publicKey)).toBe(toBytea(b.publicKey));
    expect(escrituras).toHaveLength(1);
  });

  it('cerrar sesión tira el llavero', async () => {
    await ensureKeyring(ALPHA);
    expect(currentKeyPair()).not.toBeNull();
    clearKeyring();
    expect(currentKeyPair()).toBeNull();
  });
});

describe('la semilla de demo (D-08-01 a)', () => {
  it('sin semilla, `demoSeed()` es null y recargar da otra clave', async () => {
    ponSemilla(undefined);
    expect(demoSeed()).toBeNull();

    const antes = await ensureKeyring(ALPHA);
    clearKeyring(); // ≡ recargar la página
    const despues = await ensureKeyring(ALPHA);

    // Es el comportamiento correcto del MVP (CLAUDE.md §4), no un fallo: lo
    // cifrado para la clave anterior deja de abrirse y la pantalla lo dice.
    expect(toBytea(antes.publicKey)).not.toBe(toBytea(despues.publicKey));
  });

  it('con semilla, recargar devuelve LA MISMA clave', async () => {
    ponSemilla('semilla-de-pruebas');

    const antes = await ensureKeyring(ALPHA);
    clearKeyring();
    const despues = await ensureKeyring(ALPHA);

    expect(toBytea(antes.publicKey)).toBe(toBytea(despues.publicKey));
  });

  it('con la misma semilla, dos miembros siguen siendo dos partes distintas', async () => {
    ponSemilla('semilla-de-pruebas');
    const a = await ensureKeyring(ALPHA);
    clearKeyring();
    const b = await ensureKeyring(BETA);

    expect(toBytea(a.publicKey)).not.toBe(toBytea(b.publicKey));
  });

  it('una semilla vacía cuenta como ausente', () => {
    ponSemilla('');
    expect(demoSeed()).toBeNull();
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
