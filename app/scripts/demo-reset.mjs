/**
 * Reseteo del entorno de demo · día 13
 * =============================================================================
 *
 * `Plan §5`, día 13, segunda fila: *"Entorno de demo aislado, con siembra
 * congelada y reseteable"*. Esto es la parte **reseteable**, y es un comando:
 *
 *     npm run demo:reset
 *
 * ── QUÉ PROBLEMA RESUELVE, MEDIDO Y NO SUPUESTO ────────────────────────────
 *
 * `F-095` dijo que el estado de demo es efímero porque `e2e/fixture.setup.ts`
 * repone los cinco `HILO_IDS` **al arrancar** cada corrida de Playwright. Lo que
 * el día 13 midió es la otra mitad, que era la que hacía daño de verdad:
 * **reponer al arrancar deja la base sucia al terminar.** El 16-ago, antes de
 * tocar nada, el hilo de Anadolu estaba en `ABIERTO` con dos mensajes en vez de
 * en `CERRADO SIN ACUERDO` con uno — residuo del test que comprueba que un
 * elemento nuevo reabre un hilo cerrado (`D-07-01`, `messages.spec.ts`). Nadie
 * lo había roto: la suite hizo exactamente lo que tenía que hacer y se fue.
 *
 * Consecuencia concreta: **MSG-01 enseñaba cuatro estados en vez de cinco**, que
 * es justo lo que `seed/demo_threads.sql` §5 se molesta en forzar, y lo que el
 * socio ve en la primera pantalla de la demo.
 *
 * ── POR QUÉ ES UN MÓDULO Y ADEMÁS UN COMANDO ───────────────────────────────
 *
 * Lo llaman tres sitios y **tiene que ser el mismo código en los tres**, o vuelve
 * a divergir:
 *
 *   1. `npm run demo:reset` — antes de cada ensayo y la mañana del 20-ago.
 *   2. `e2e/fixture.setup.ts` — reponer antes de la corrida.
 *   3. `e2e/restore.teardown.ts` — y **reponer también después**, que es lo nuevo.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No aísla: demo y pruebas siguen compartiendo la base `troxminloxkjwihwfevs`.
 * `Plan §5` pedía además un proyecto separado, y **se decidió no hacerlo el
 * 16-ago** con cuatro días para la reunión, la CLI en la cuenta equivocada
 * (`F-073`) y la congelación de código el día 14. Con el reseteo delante y
 * detrás, que las dos compartan base deja de tener consecuencia observable.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { HILO_IDS, buildSeed } from '../../supabase/seed/demo-content.mjs';

/** El de Anadolu, el último de la lista. Es el que hay que devolver a cerrado. */
const HILO_ANADOLU = HILO_IDS[HILO_IDS.length - 1];

/** Los cinco que `guion-demo-y-siembra.md` pide que se vean en MSG-01. */
const ESTADOS_ESPERADOS = [
  'ABIERTO',
  'ACUERDO ALCANZADO',
  'CERRADO SIN ACUERDO',
  'CON CONSULTA PENDIENTE',
  'CON OFERTA PENDIENTE',
];

/** `error` de PostgREST a excepción con el sitio dicho. */
function orLanza(paso, { error }) {
  if (error) throw new Error(`RESETEO FALLIDO en «${paso}» · ${error.message}`);
}

/** Como `orLanza`, pero devuelve las filas. */
function orLanza0(paso, { data, error }) {
  orLanza(paso, { error });
  return data ?? [];
}

/**
 * ADMIN-01 · las tres solicitudes de `supabase/seed/demo_registration_requests.sql`,
 * de vuelta a `PENDING_REVIEW` y con el reloj re-anclado: una roja (>48 h), una
 * naranja (>24 h) y una normal.
 *
 * F-169 (17-sep): la C5 de ADMIN-01 pulsó Aprobar y Rechazar sobre la base de
 * producción, la cola quedó descuadrada y el e2e local salió 3 de 4 en rojo; la
 * siguiente corrida del arnés le habría cobrado al Coder un fallo de datos.
 * Decisión del PO: se siembra antes de cada corrida. Y para que no dependa de que
 * alguien se acuerde, lo hace este reseteo, que `e2e/fixture.setup.ts` corre al
 * arrancar cada suite -y C2 corre siempre la suite entera-.
 *
 * Solo `update`: las filas las crea el `.sql`, que sigue siendo la fuente de verdad
 * de sus datos. Si falta alguna, se lanza en vez de inventarla. Pasa
 * `app.guard_registration_request` porque `service_role` está exento (0028). El
 * historial (`registration_request_events`) no se toca: es un registro.
 */
const SOLICITUDES_DEMO = [
  ['11110000-0000-4000-8000-00000000aaa1', 52],
  ['11110000-0000-4000-8000-00000000aaa2', 30],
  ['11110000-0000-4000-8000-00000000aaa3', 3],
];

async function reponerSolicitudes(db, log) {
  const ahora = Date.now();
  for (const [id, horas] of SOLICITUDES_DEMO) {
    const { data, error } = await db
      .from('registration_requests')
      .update({
        state: 'PENDING_REVIEW',
        rejection_reason: null,
        decided_by: null,
        decided_at: null,
        submitted_at: new Date(ahora - horas * 3_600_000).toISOString(),
      })
      .eq('id', id)
      .select('id');
    orLanza(`reponiendo la solicitud de registro ${id}`, { error });
    if (!data?.length) {
      throw new Error(
        `RESETEO FALLIDO · la solicitud ${id} no existe en esta base. ` +
          'Siémbrala una vez con supabase/seed/demo_registration_requests.sql.',
      );
    }
  }
  log('· tres solicitudes de registro de ADMIN-01 en cola · 52 h, 30 h y 3 h');
}

/**
 * INVT-01 · las invitaciones de Nordwälz Lager (la organización de BETA).
 *
 * Tiene un ADMIN y un Editor, o sea que con las tres invitaciones de abajo la
 * pantalla enseña justo el ejemplo del HTML aprobado: `2/5 · 1 invitación pendiente
 * · 2 plazas libres`, una Pendiente, una Aceptada y una Expirada con su `Reenviar`.
 * **Las fechas son relativas a AHORA** porque la pendiente caduca y la expirada no
 * puede caducar de nuevo: una siembra con fechas fijas envejece igual que el
 * catálogo (F-094). Repone también al Editor a ACTIVO, por si alguien lo revocó en
 * un ensayo (`remove_member` lo deja CANCELLED y no se puede deshacer desde la app).
 */
const ORG_NORDWALZ = 'b2000000-0000-4000-8000-000000000002';
/**
 * F-178 · las reacciones del foro vuelven a su siembra.
 *
 * Un e2e que reacciona y desreacciona en la misma corrida deja la reacción puesta
 * si la corrida se cancela a medias (F-171), y el foro no entraba en el reseteo.
 * Solo se tocan las reacciones (las publicaciones no se escriben desde el cliente
 * en los e2e) y solo las de los hilos de demo. Las cinco reproducen las de
 * `supabase/seed/demo_forum.sql` §3: c003 → 👍 3, c004 → 👍 1, c001 → 👍 1.
 */
const HILOS_FORO = [
  '44440000-0000-4000-8000-00000000c001',
  '44440000-0000-4000-8000-00000000c003',
  '44440000-0000-4000-8000-00000000c004',
];
const MIEMBRO_A = 'a1000000-0000-4000-8000-00000000000a';
const MIEMBRO_B = 'b2000000-0000-4000-8000-00000000000b';
/** [hilo, n-ésima publicación por orden de fecha, quién reacciona] */
const REACCIONES_FORO = [
  [HILOS_FORO[1], 1, MIEMBRO_A],
  [HILOS_FORO[1], 1, MIEMBRO_B],
  [HILOS_FORO[1], 2, MIEMBRO_B],
  [HILOS_FORO[2], 1, MIEMBRO_B],
  [HILOS_FORO[0], 1, MIEMBRO_B],
];

async function reponerReaccionesForo(db, log) {
  const posts = orLanza0(
    'leyendo las publicaciones del foro',
    await db
      .from('forum_posts')
      .select('id, thread_id, created_at')
      .in('thread_id', HILOS_FORO)
      .order('created_at', { ascending: true }),
  );
  const ids = posts.map((p) => p.id);
  if (!ids.length) {
    log('· foro sin publicaciones sembradas: reacciones no repuestas');
    return;
  }
  orLanza('borrando las reacciones del foro', await db.from('forum_reactions').delete().in('post_id', ids));

  const filas = REACCIONES_FORO.flatMap(([hilo, n, member_id]) => {
    const post = posts.filter((p) => p.thread_id === hilo)[n - 1];
    return post ? [{ post_id: post.id, member_id }] : [];
  });
  orLanza('insertando las reacciones del foro', await db.from('forum_reactions').insert(filas));
  log(`· foro: ${filas.length} reacciones repuestas`);
}

const EMAIL_EDITOR_NORDWALZ = 'editor@bearingworld.test';

async function reponerInvitaciones(db, log) {
  const ahora = Date.now();
  const dia = 86_400_000;
  const iso = (dias) => new Date(ahora + dias * dia).toISOString();

  orLanza(
    'borrando las invitaciones de demo',
    await db.from('member_invitations').delete().eq('org_id', ORG_NORDWALZ),
  );
  orLanza(
    'reponiendo al Editor de Nordwälz a ACTIVE',
    await db.from('members').update({ state: 'ACTIVE' }).eq('email', EMAIL_EDITOR_NORDWALZ),
  );
  orLanza(
    'sembrando las invitaciones de demo',
    await db.from('member_invitations').insert([
      { org_id: ORG_NORDWALZ, email: 'carlos.m@aceroindustrial.com', sent_at: iso(-2), expires_at: iso(5) },
      {
        org_id: ORG_NORDWALZ,
        email: EMAIL_EDITOR_NORDWALZ,
        sent_at: iso(-6),
        expires_at: iso(1),
        accepted_at: iso(-5),
      },
      { org_id: ORG_NORDWALZ, email: 'm.sanchez@aceroindustrial.com', sent_at: iso(-24), expires_at: iso(-17) },
    ]),
  );
  log('· tres invitaciones de INVT-01 en Nordwälz · Pendiente 5 días, Aceptada y Expirada');
}

/**
 * Repone la siembra congelada y devuelve el estado **consultado**, no el supuesto.
 *
 * @param {object}   o
 * @param {string}   o.url         `VITE_SUPABASE_URL`
 * @param {string}   o.serviceKey  `SUPABASE_SERVICE_KEY` — la única que salta RLS
 * @param {string}   o.seed        `VITE_DEMO_KEY_SEED`
 * @param {boolean} [o.reanchor]   Re-anclar además la frescura del catálogo (F-094)
 * @param {(s: string) => void} [o.log]
 * @returns {Promise<object>} lo que devuelve `public.demo_state()`
 */
export async function resetDemo({ url, serviceKey, seed, reanchor = true, log = () => {} }) {
  const faltan = [
    !url && 'VITE_SUPABASE_URL',
    !serviceKey && 'SUPABASE_SERVICE_KEY',
    !seed && 'VITE_DEMO_KEY_SEED',
  ].filter(Boolean);
  if (faltan.length) {
    throw new Error(
      `RESETEO ABORTADO · faltan ${faltan.join(', ')}. ` +
        'Las dos VITE_ están en app/.env; SUPABASE_SERVICE_KEY vive en el entorno de usuario ' +
        '(CLAUDE.md §10.1).',
    );
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  /*
   * Primero cifrar, y solo si el cifrado se abre, borrar. `buildSeed` descifra lo
   * que acaba de cifrar con un par derivado DE NUEVO y lanza si no cuadra
   * (D-08-01). Si lanza aquí, la base sigue intacta: mejor un reseteo que no
   * arranca que una demo llena de blobs ilegibles media hora antes de la reunión.
   */
  const { publicKeys, items, wrapped } = await buildSeed(seed);
  log(`· siembra cifrada y comprobada · ${items.length} elementos`);

  for (const p of publicKeys) {
    orLanza(
      `publicando la clave de ${p.id}`,
      await db.from('members').update({ public_key: `\\x${p.publicKeyHex}` }).eq('id', p.id),
    );
  }

  /*
   * ⚠ ACOTADO A LOS CINCO. `HILO_IDS` son UUID fijos de `demo-content.mjs`. Un
   * `delete` sin ese filtro, con `service_role`, vaciaría la tabla entera — y
   * esto corre contra el Supabase real, no contra una base desechable.
   */
  orLanza('borrando los elementos de demo', await db.from('thread_items').delete().in('thread_id', HILO_IDS));

  const ahora = Date.now();
  orLanza(
    'insertando los elementos de demo',
    await db.from('thread_items').insert(
      items.map((i) => ({
        id: i.id,
        thread_id: i.thread_id,
        sender_org_id: i.sender_org_id,
        sender_member_id: i.sender_member_id,
        item_type: i.item_type,
        created_at: new Date(ahora - i.horas * 3_600_000).toISOString(),
        part_number: i.part_number,
        brand: i.brand,
        estado_consulta: i.estado_consulta,
        estado_oferta: i.estado_oferta,
        content_ciphertext: `\\x${i.ciphertextHex}`,
        content_iv: `\\x${i.ivHex}`,
      })),
    ),
  );

  orLanza(
    'depositando las CEK envueltas',
    await db.from('thread_item_keys').insert(
      wrapped.map((w) => ({
        item_id: w.item_id,
        recipient_member_id: w.recipient_member_id,
        wrapped_cek: `\\x${w.wrappedCekHex}`,
        wrap_iv: `\\x${w.wrapIvHex}`,
        ephemeral_pubkey: `\\x${w.ephemeralPubkeyHex}`,
      })),
    ),
  );

  /*
   * Y Anadolu vuelve a cerrado. El `insert` de arriba disparó
   * `app.sync_thread_state`, y desde `0009` un elemento nuevo reabre un hilo
   * cerrado (D-07-01, F-045). Sin esta línea la demo empieza con cuatro estados.
   * Pasa porque `service_role` está exento en `app.guard_thread_state` (0007:241);
   * desde el cliente no se podría, y así debe ser.
   */
  orLanza(
    'devolviendo el hilo de Anadolu a cerrado',
    await db.from('threads').update({ state: 'CERRADO SIN ACUERDO' }).eq('id', HILO_ANADOLU),
  );
  log('· cinco hilos repuestos · Anadolu devuelto a CERRADO SIN ACUERDO');

  await reponerSolicitudes(db, log);
  await reponerInvitaciones(db, log);
  await reponerReaccionesForo(db, log);

  if (reanchor) {
    const { data, error } = await db.rpc('demo_reanchor_freshness');
    if (error) throw new Error(`RESETEO FALLIDO en «re-anclando la frescura» · ${error.message}`);
    log(
      data.movidas > 0
        ? `· catálogo re-anclado · ${data.movidas} líneas desplazadas +${data.desfase}`
        : `· catálogo ya anclado · desfase de solo ${data.desfase}`,
    );
  }

  // ── Y ahora se comprueba, que es la mitad que faltaba ────────────────────
  const { data: estado, error } = await db.rpc('demo_state');
  if (error) throw new Error(`RESETEO FALLIDO al consultar el estado · ${error.message}`);

  const estados = estado.hilos.map((h) => h.estado).sort();
  const distintos = [...new Set(estados)].sort();

  if (estado.hilos.length !== ESTADOS_ESPERADOS.length) {
    throw new Error(
      `RESETEO FALLIDO · hay ${estado.hilos.length} hilos y tienen que ser ${ESTADOS_ESPERADOS.length}. ` +
        `Encontrados: ${estado.hilos.map((h) => `${h.contraparte} (${h.estado})`).join(' · ')}`,
    );
  }

  if (distintos.join('|') !== ESTADOS_ESPERADOS.join('|')) {
    throw new Error(
      'RESETEO FALLIDO · MSG-01 no tiene sus cinco estados, que es lo primero que ve el socio.\n' +
        `  esperados: ${ESTADOS_ESPERADOS.join(' · ')}\n` +
        `  hay:       ${distintos.join(' · ')}`,
    );
  }

  const conDeMas = estado.hilos.filter((h) => h.elementos !== 1);
  if (conDeMas.length) {
    throw new Error(
      'RESETEO FALLIDO · algún hilo no tiene exactamente un elemento: ' +
        conDeMas.map((h) => `${h.contraparte} (${h.elementos})`).join(' · '),
    );
  }

  if (estado.catalogo.futuro > 0) {
    throw new Error(
      `RESETEO FALLIDO · ${estado.catalogo.futuro} líneas con fecha en el futuro. ` +
        'La columna Antigüedad enseñaría un valor imposible.',
    );
  }

  return estado;
}

// -----------------------------------------------------------------------------
// Como comando
// -----------------------------------------------------------------------------

/**
 * Solo cuando se ejecuta directo, no cuando lo importa la suite. Se comparan
 * rutas resueltas y no cadenas: en Windows `process.argv[1]` viene con barras
 * invertidas y `import.meta.url` es un `file://`, y compararlas en crudo falla
 * de la peor manera — en silencio y solo en una plataforma.
 */
const AQUI = fileURLToPath(import.meta.url);
const esComando = !!process.argv[1] && resolve(process.argv[1]) === resolve(AQUI);

if (esComando) {
  const dotenv = await import('dotenv');

  // Explícito y no por `cwd`: así funciona igual desde `app/` y desde la raíz.
  dotenv.default.config({ path: join(dirname(AQUI), '..', '.env'), quiet: true });

  const linea = (s) => process.stdout.write(`${s}\n`);

  try {
    linea('RESETEO DEL ENTORNO DE DEMO');
    const estado = await resetDemo({
      url: process.env.VITE_SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_KEY,
      seed: process.env.VITE_DEMO_KEY_SEED,
      reanchor: true,
      log: linea,
    });

    const { catalogo: c, referencia: r } = estado;
    linea('');
    linea(`VERIFICADO · ${estado.medido_en}`);
    linea(`  catálogo    · ${c.total} líneas · ${c.frescas} frescas · ${c.naranja} naranja · ${c.roja} roja · ${c.futuro} en el futuro`);
    linea(`  6205-2RS    · ${r.total} líneas · ${r.frescas} frescas · ${r.naranja} naranja · ${r.roja} roja`);
    linea('  hilos       · cinco, con cinco estados distintos:');
    for (const h of estado.hilos) linea(`      ${h.contraparte.padEnd(20)} ${h.estado}`);
    linea('');
    linea('La demo está en su estado congelado. No corras la suite e2e hasta que termines.');
  } catch (e) {
    process.stderr.write(`\n${e.message}\n\n`);
    process.exit(1);
  }
}
