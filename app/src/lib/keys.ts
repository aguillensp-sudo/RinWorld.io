import { supabase } from './supabase';
import {
  type SessionKeyPair,
  deriveKeyPairFromSeed,
  fromBytea,
  generateKeyPair,
  toBytea,
} from './crypto';

/**
 * El llavero de la sesión · rebanada E2EE, día 8.
 *
 * Es la única pieza que junta las primitivas de `crypto.ts` con la base. Dos
 * responsabilidades y ninguna más:
 *
 *   1. **tener el par de claves de quien está dentro**, y publicar su pública;
 *   2. **traer las públicas de la contraparte** para poder envolver la CEK.
 *
 * ── EL LLAVERO VIVE EN MEMORIA Y SE PIERDE AL RECARGAR ──────────────────────
 *
 * No es un descuido ni un "ya lo haremos": `CLAUDE.md` §4 lo fija para el MVP —
 * sin backup, sin recuperación, sin passphrase y sin rotación— y avisa de que
 * **esto no debe confundirse con una implementación de ADR-001**.
 *
 * No hay `localStorage` a propósito. Guardar ahí la privada sería el atajo obvio
 * y convertiría un XSS en pérdida total de la confidencialidad de todo el
 * historial, a cambio de una comodidad que el MVP no necesita. Cuando entre
 * ADR-001 completo, la privada se guarda **envuelta** con una clave derivada de
 * la passphrase (los cuatro campos de `members` ya existen desde `0001:78`),
 * que no es lo mismo que guardarla.
 *
 * La consecuencia visible, y es la costura de D-07-05: al recargar, lo que se
 * cifró para la clave anterior deja de abrirse y `decryptItem` devuelve `null`,
 * o sea `Contenido cifrado — introduce tu frase de seguridad para ver`. Eso es
 * el comportamiento correcto del MVP, no un fallo. Con la semilla de demo puesta
 * no ocurre, porque la clave vuelve a salir igual.
 */

/** Un destinatario posible de la CEK de un elemento del hilo. */
export interface ThreadRecipient {
  memberId: string;
  orgId: string;
  /**
   * `null` = ese miembro **no ha publicado su clave** todavía.
   *
   * Llega hasta aquí a propósito; 0012 §3 explica por qué no se filtra en la
   * base. Quien envía tiene que poder negarse y decir de quién falta la clave,
   * en vez de escribir un elemento que esa persona no podrá abrir nunca.
   */
  publicKey: Uint8Array | null;
}

interface RecipientRow {
  member_id: string;
  org_id: string;
  public_key: string | null;
}

let llavero: SessionKeyPair | null = null;
let llaveroDe: string | null = null;
let enCurso: Promise<SessionKeyPair> | null = null;

/**
 * La semilla de las claves deterministas de la demo (D-08-01, opción (a)).
 *
 * **Ausente = camino real del MVP**: par aleatorio por sesión. Presente = claves
 * estables, que es lo que hace que la siembra del día 11 se pueda leer y que el
 * panel de vista-servidor tenga dos mitades distintas que enseñar.
 *
 * No está en el repo y no puede estarlo (`CLAUDE.md` §1). Va en `.env`, y
 * `.env.example` la documenta con este mismo aviso: **quien tenga la semilla
 * tiene todas las privadas de la demo**, así que sirve para datos inventados y
 * para nada más.
 */
export function demoSeed(): string | null {
  const s = import.meta.env.VITE_DEMO_KEY_SEED;
  return typeof s === 'string' && s.length > 0 ? s : null;
}

/**
 * Deja el llavero listo para este miembro y **publica su clave pública**.
 *
 * La publicación no es un extra: sin ella, la contraparte no tiene con qué
 * envolver la CEK y no puede escribirle. Por eso va aquí, al establecerse la
 * sesión, y no la primera vez que alguien abre un hilo — para entonces ya
 * podrían haber intentado escribirle y haber fallado.
 *
 * Escribe con un `update` normal, sin función ni RPC: `members_update_self`
 * (`0001:214`) ya lo permite y `app.guard_member_privileges` (`0001:224`) solo
 * bloquea `role`, `state` y `org_id`. Comprobado leyendo el trigger.
 *
 * Es idempotente y aguanta llamadas concurrentes: `useSession` puede resolver
 * dos veces —`getSession()` y `onAuthStateChange` llegan casi a la vez— y dos
 * derivaciones en paralelo darían dos pares distintos por el camino aleatorio,
 * o sea un llavero que cambia debajo de una escritura a medias.
 */
export async function ensureKeyring(memberId: string): Promise<SessionKeyPair> {
  if (llavero && llaveroDe === memberId) return llavero;
  if (enCurso && llaveroDe === memberId) return enCurso;

  llaveroDe = memberId;
  enCurso = (async () => {
    const semilla = demoSeed();
    const par = semilla
      ? await deriveKeyPairFromSeed(semilla, memberId)
      : await generateKeyPair();

    const { error } = await supabase
      .from('members')
      .update({ public_key: toBytea(par.publicKey) })
      .eq('id', memberId);

    // Se lanza en vez de seguir en silencio. Un llavero sin publicar deja a
    // quien entra localizable para leer pero **imposible de escribir**, y ese es
    // justo el fallo que no se nota hasta que la otra parte se queja de que "no
    // le llega nada". Quien llama decide qué enseñar; lo que no puede es no
    // enterarse.
    if (error) throw error;

    llavero = par;
    return par;
  })();

  try {
    return await enCurso;
  } catch (e) {
    // El fallo no deja el llavero medio puesto: el siguiente intento reintenta
    // entero en vez de quedarse pegado a una promesa rechazada.
    llaveroDe = null;
    enCurso = null;
    throw e;
  }
}

/** El par de esta sesión, o `null` si aún no hay. No deriva nada por su cuenta. */
export function currentKeyPair(): SessionKeyPair | null {
  return llavero;
}

/**
 * Tira el llavero. Se llama al cerrar sesión, y es lo que hace que cerrar
 * sesión signifique algo: sin esto, la privada del miembro anterior seguiría en
 * memoria mientras la pestaña siguiera abierta.
 */
export function clearKeyring(): void {
  llavero = null;
  llaveroDe = null;
  enCurso = null;
}

/**
 * Las claves públicas de todos los miembros de las dos organizaciones del hilo,
 * incluida la propia.
 *
 * Va por el RPC de `0012` y no por una consulta a `members` porque
 * `members_select_own_org` (`0001:207`) sigue cerrada, y tiene que seguirlo: la
 * fila de `members` lleva `email` y los cuatro campos del respaldo de clave, y
 * abrirla para leer 32 bytes sería abrir todo lo demás. Ver el §1 de 0012.
 *
 * Incluye al emisor porque la CEK va envuelta **por persona** (`0003:263`): sin
 * su propia copia, quien escribe no puede releer lo que escribió.
 */
export async function fetchThreadRecipients(threadId: string): Promise<ThreadRecipient[]> {
  const { data, error } = await supabase.rpc('thread_public_keys', { t_id: threadId });
  if (error) throw error;

  return ((data ?? []) as RecipientRow[]).map((r) => ({
    memberId: r.member_id,
    orgId: r.org_id,
    publicKey: r.public_key ? fromBytea(r.public_key) : null,
  }));
}

interface OrgRecipientRow {
  member_id: string;
  public_key: string | null;
}

/**
 * Las públicas de los miembros de UNA organización, sin que exista ningún
 * hilo con ella todavía (GAP-004, día 10).
 *
 * `fetchThreadRecipients` no sirve para el primer contacto: `thread_public_
 * keys` (0012) exige un hilo, y "Consultar" desde SRCH-01 es exactamente el
 * caso en el que ese hilo **todavía no existe** — se crea, si hace falta,
 * dentro de `create_inquiry` (0014) DESPUÉS de que el cliente ya haya cifrado.
 * Va por `org_public_keys`, con la misma condición que ya deja ver esa
 * organización en la búsqueda (`organizations_select_approved`, 0001).
 */
export async function fetchOrgRecipients(orgId: string): Promise<ThreadRecipient[]> {
  const { data, error } = await supabase.rpc('org_public_keys', { p_org_id: orgId });
  if (error) throw error;

  return ((data ?? []) as OrgRecipientRow[]).map((r) => ({
    memberId: r.member_id,
    orgId,
    publicKey: r.public_key ? fromBytea(r.public_key) : null,
  }));
}
