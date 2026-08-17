/**
 * Lo que comparten la sonda y el ensayo · día 15
 * =============================================================================
 *
 * NO ES CÓDIGO DE PRODUCCIÓN y no entra en el bundle: nada de `src/` lo importa.
 * Vive aquí y no en un `.test.ts` porque lo usan **dos** ficheros de prueba
 * —`vera.probe.test.ts` y `vera.ensayo.test.ts`—, y la alternativa era copiar el
 * arranque de sesión en los dos. Este repo tiene tres hallazgos que son
 * exactamente esa forma (F-012, F-089, F-095): dos copias del mismo contrato
 * divergiendo en silencio.
 *
 * Las dos cosas que hay aquí son las dos que no se pueden improvisar:
 *
 *   1. `entrarComoAlpha()` — sesión real y `MemberProfile` armado desde la base.
 *   2. `espiar()` — envuelve el `ProxyCall` para poder ver **lo que la
 *      herramienta le devolvió al modelo**, que es la única forma de medir
 *      F-105 sin volver a caer en F-107.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from './supabase';
import type { ProxyCall } from './vera';
import type { MemberProfile } from './session';

/** Generoso: son varias vueltas de modelo con herramientas por medio. */
export const TIMEOUT = 120_000;

/** `app/.env`, que es donde §10.1 dice que viven las credenciales. */
export async function cargarEnv(): Promise<void> {
  const dotenv = await import('dotenv');
  dotenv.default.config({
    path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'),
    quiet: true,
  });
}

/**
 * Entra con la cuenta compradora y devuelve su perfil.
 *
 * El perfil se arma a mano porque `session.ts` solo lo expone por el hook de
 * React. Es pegamento de prueba, no una segunda copia de nada: las herramientas
 * siguen siendo las de producción.
 *
 * En DOS consultas y sin embed, a propósito. Con `organizations(...)` esto
 * devuelve `PGRST201` —*"more than one relationship was found"*— porque
 * `members` llega a `organizations` por más de un camino; es exactamente lo que
 * documenta `threads.ts` sobre sus tres claves ajenas (F-020). Nombrar la FK
 * funcionaría, pero aquí no se gana nada acoplándose a su nombre: dos lecturas
 * se leen mejor y no se rompen si la FK se renombra.
 */
export async function entrarComoAlpha(): Promise<MemberProfile> {
  const email = process.env.E2E_ALPHA_EMAIL;
  const password = process.env.E2E_ALPHA_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan E2E_ALPHA_EMAIL / E2E_ALPHA_PASSWORD en app/.env.');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se ha podido entrar como alpha@: ${error.message}`);

  const { data: m, error: eM } = await supabase
    .from('members')
    .select('id, org_id, email, full_name, role, state')
    .eq('email', email)
    .single();
  if (eM) throw new Error(`No se ha podido leer el miembro: ${eM.message}`);

  const fila = m as unknown as {
    id: string;
    org_id: string;
    email: string;
    full_name: string | null;
    role: 'ADMIN' | 'EDITOR';
    state: string;
  };

  const { data: o, error: eO } = await supabase
    .from('organizations')
    .select('name, country')
    .eq('id', fila.org_id)
    .single();
  if (eO) throw new Error(`No se ha podido leer la organización: ${eO.message}`);
  const org = o as unknown as { name: string; country: string };

  return {
    id: fila.id,
    email: fila.email,
    fullName: fila.full_name,
    role: fila.role,
    state: fila.state,
    orgId: fila.org_id,
    orgName: org.name,
    orgCountry: org.country,
  };
}

/** El token de acceso vigente, pedido en cada llamada porque caduca y se renueva. */
export const tokenVigente = async (): Promise<string | null> =>
  (await supabase.auth.getSession()).data.session?.access_token ?? null;

/**
 * Envuelve un `ProxyCall` para quedarse con **lo que las herramientas le
 * devolvieron al modelo**.
 *
 * ── POR QUÉ HACE FALTA, Y POR QUÉ ASÍ ──────────────────────────────────────
 *
 * `ask()` no expone los `ToolResult`: devuelve texto, vueltas y nombres de
 * herramienta. Pero el bucle **reenvía** cada resultado en el mensaje siguiente,
 * así que el `ProxyCall` los ve pasar. Espiarlos ahí no toca producción, no
 * reimplementa nada y mide lo que de verdad recibió el modelo.
 *
 * ── LO QUE ESTO ARREGLA ────────────────────────────────────────────────────
 *
 * F-107: dos versiones seguidas del aserto de F-105 pasaron en verde sin
 * comprobar nada, porque buscaban una palabra o un número en la prosa. Con el
 * retorno de la herramienta delante, el invariante deja de ser *"¿aparece un
 * 12?"* y pasa a ser **filas recibidas contra filas pintadas**, que es una
 * relación entre magnitudes y no puede acertar por casualidad.
 */
export interface Espia {
  call: ProxyCall;
  /** Los `content` de cada `tool_result` reenviado, en orden. */
  retornos: string[];
  reiniciar: () => void;
}

export function espiar(call: ProxyCall): Espia {
  const retornos: string[] = [];

  const envuelto: ProxyCall = async (body) => {
    for (const mensaje of body.messages) {
      const m = mensaje as { role?: string; content?: unknown };
      if (m.role !== 'user' || !Array.isArray(m.content)) continue;
      for (const bloque of m.content) {
        const b = bloque as { type?: string; content?: unknown };
        if (b.type === 'tool_result' && typeof b.content === 'string') {
          // El bucle reenvía el historial entero cada vuelta: sin esto, un
          // retorno se contaría tantas veces como vueltas queden por delante.
          if (!retornos.includes(b.content)) retornos.push(b.content);
        }
      }
    }
    return call(body);
  };

  return {
    call: envuelto,
    retornos,
    reiniciar: () => {
      retornos.length = 0;
    },
  };
}

/**
 * Cuántas filas de catálogo hay en un texto.
 *
 * Una fila de `buscar_en_catalogo` es `ref · marca · N u · plazo · país · org`:
 * lleva separador `·` **y** una cantidad en unidades. Se piden las dos cosas a
 * la vez porque una frase de prosa puede tener una de ellas, pero no las dos.
 * La misma regla se aplica al retorno de la herramienta y a la respuesta del
 * modelo, que es lo que hace que los dos números sean comparables.
 *
 * ⚠ **LA UNIDAD SE ACEPTA EN SUS TRES FORMAS, Y ESO LO ENSEÑÓ UNA MEDICIÓN
 * FALSA.** La primera versión exigía `\d+\s*u\b`, y en la pasada del día 15 la
 * respuesta de A6 —correcta, con su única línea— escribió *"55 **unidades**"* en
 * vez de *"55 u"*. El contador devolvió **0 filas pintadas** sobre 1 recibida, o
 * sea un recorte que no existía. El modelo reformatea el retorno al redactar; un
 * contador que solo entiende el formato de origen mide el formato, no el
 * contenido. Es `F-107` otra vez y esta vez en el instrumento de medida.
 */
export function contarFilas(texto: string): number {
  return texto
    .split('\n')
    .filter((l) => l.includes('·') && /\b\d[\d.,]*\s*(?:u|uds?|unidades)\b/i.test(l)).length;
}

/**
 * El invariante de `F-105`, en un solo sitio porque lo comprueban dos ficheros.
 *
 * Devuelve **tres booleanos**, no uno, porque las tres condiciones fallan por
 * motivos distintos y confundirlas es cómo se fabrica un verde vacío:
 *
 *   · `huboRecorte`  — pintó menos de las que recibió Y pintó alguna.
 *     **Las dos mitades hacen falta.** Cero filas pintadas no es un recorte, es
 *     no haber listado: con solo `pintadas < recibidas`, una respuesta que no
 *     lista nada entra en la rama del recorte y pasa. Pasó, el 17-ago.
 *   · `declaraTotal` — el número de filas recibidas aparece **pegado a un
 *     sustantivo de recuento**. Un número suelto es la trampa de `F-107`: con 6
 *     recibidas, `\b6\b` casaría con «6 días» de plazo. «6 líneas» no es un plazo.
 *   · `listoTodo`    — no recortó, así que no hay nada que declarar.
 *
 * Lo que NO devuelve: si el criterio declarado es razonable. Eso es juicio, dos
 * pasadas seguidas lo dijeron de dos formas que ningún patrón razonable reúne, y
 * ensanchar el patrón hasta que casen ambas es exactamente `F-107`.
 *
 * ⚠ Presupone que **lo recibido es el total**, o sea que la búsqueda no pasa de
 * `MAX_FILAS`. Con una que lo pasara, el total sería mayor que lo recibido y
 * `declaraTotal` estaría buscando el número equivocado.
 */
export function invarianteDeRecorte(
  recibidas: number,
  pintadas: number,
  texto: string,
): { huboRecorte: boolean; declaraTotal: boolean; listoTodo: boolean } {
  return {
    huboRecorte: pintadas > 0 && pintadas < recibidas,
    declaraTotal: new RegExp(
      `\\b${recibidas}\\s+(coincidencias|l[íi]neas|resultados|filas|opciones|referencias|proveedores)\\b`,
      'i',
    ).test(texto),
    listoTodo: pintadas === recibidas,
  };
}
