import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

/**
 * ¿Propaga Realtime de verdad, sobre las tablas del MVP y a través de RLS?
 *
 * ── POR QUÉ ESTO NO ES UN TEST DE PLAYWRIGHT ────────────────────────────────
 *
 * Un e2e de dos sesiones tendría que **escribir** en el hilo compartido para que
 * la otra lo viera, y las dos escrituras que la interfaz ofrece —aceptar una
 * oferta y cerrar el hilo— son **irreversibles**: `Aceptada` es un estado
 * terminal que la base no deja mover, y de `CERRADO SIN ACUERDO` solo se vuelve
 * escribiendo, que hoy no se puede (D-07-05). Cualquiera de las dos deja la
 * siembra de la demo tocada, y con ella los seis asertos de `messages.spec.ts`
 * que dependen de los badges y del orden.
 *
 * Un e2e de dos sesiones **necesita la siembra reseteable del día 13**
 * (`Plan §3`), no un apaño hoy a seis días de la demo. Mientras tanto, esto:
 * mismo alcance, misma base, y **se limpia solo**.
 *
 * ── QUÉ MIDE, Y QUÉ NO ──────────────────────────────────────────────────────
 *
 * SP-3 (día 1) midió que la infraestructura sirve: 20/20, media 327 ms, y
 * reconecta sola. Lo hizo sobre una tabla suya, `spike_messages`, creada desde el
 * panel — y por eso **no pudo ver que las tablas del MVP no estaban publicadas**.
 * Esto mide lo que aquello no podía:
 *
 *   1. que `threads` y `thread_items` estén en `supabase_realtime` (0011);
 *   2. que el evento **llegue a un suscriptor autenticado como usuario**, o sea
 *      a través de `threads_select_participant`, no con la llave de servicio;
 *   3. que el trigger de 0007 **también** propague — el `state` del hilo lo
 *      escribe la base, no el navegador, y esa es la fila de la que depende el
 *      badge de la cabecera.
 *
 * ── CÓMO NO DEJA RASTRO ─────────────────────────────────────────────────────
 *
 * Escribe **un** elemento y lo borra. `last_item_at` solo lo mueve un trigger de
 * `insert` (`0003:247`, `= new.created_at`), así que el elemento se inserta con
 * el `created_at` que la fila ya tenía y la columna no se entera. Y un `MENSAJE`
 * no toca la derivación de 0007, que solo mira ofertas y consultas: el estado del
 * hilo entra y sale igual. Las dos cosas se comprueban al final, no se suponen.
 *
 * Uso:  node app/scripts/check-realtime.mjs
 */

dotenv.config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), quiet: true });

const URL_SB = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const EMAIL = process.env.E2E_ALPHA_EMAIL;
const PASS = process.env.E2E_ALPHA_PASSWORD;

const faltan = Object.entries({ URL_SB, ANON, SERVICE, EMAIL, PASS })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (faltan.length) {
  console.error(`Faltan credenciales: ${faltan.join(', ')}`);
  console.error('SUPABASE_SERVICE_KEY va en el entorno de usuario; el resto salen de app/.env.');
  process.exit(2);
}

const TIMEOUT_MS = 10_000;
const fallos = [];
const ok = (m) => console.log(`  ok   ${m}`);
const mal = (m) => {
  fallos.push(m);
  console.log(`  MAL  ${m}`);
};

// ── 1 · El suscriptor: un usuario de verdad, con su RLS ──────────────────────
const suscriptor = createClient(URL_SB, ANON, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 50 } }, // F-007
});

const { error: errLogin } = await suscriptor.auth.signInWithPassword({
  email: EMAIL,
  password: PASS,
});
if (errLogin) {
  console.error(`No autentica ${EMAIL}: ${errLogin.message}`);
  process.exit(2);
}

// ── 2 · El publicador: la otra parte, con llave de servicio ─────────────────
const publicador = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

const { data: miembro } = await publicador
  .from('members')
  .select('org_id')
  .eq('email', EMAIL)
  .maybeSingle();
if (!miembro) {
  console.error(`El miembro ${EMAIL} no tiene fila en members.`);
  process.exit(2);
}
const miOrg = miembro.org_id;

// Un hilo mío que NO esté cerrado, para no despertar la reapertura de 0009.
const { data: hilo } = await publicador
  .from('threads')
  .select('id, org_low_id, org_high_id, state, last_item_at')
  .or(`org_low_id.eq.${miOrg},org_high_id.eq.${miOrg}`)
  .neq('state', 'CERRADO SIN ACUERDO')
  .order('last_item_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (!hilo) {
  console.error('No hay ningún hilo abierto de esta organización con el que probar.');
  process.exit(2);
}

const otraOrg = hilo.org_low_id === miOrg ? hilo.org_high_id : hilo.org_low_id;
const { data: otroMiembro } = await publicador
  .from('members')
  .select('id')
  .eq('org_id', otraOrg)
  .limit(1)
  .maybeSingle();
if (!otroMiembro) {
  console.error('La contraparte no tiene miembros con los que firmar el elemento.');
  process.exit(2);
}

const estadoAntes = hilo.state;
const ultimoAntes = hilo.last_item_at;

console.log(`\nHilo de prueba: ${hilo.id}  ·  estado ${estadoAntes}`);
console.log(`Suscriptor: ${EMAIL} (org ${miOrg})  ·  publica: org ${otraOrg}\n`);

// ── 3 · La suscripción, igual que la de `lib/realtime.ts` ───────────────────
let recibido = null;
let t0 = 0;

const canal = suscriptor
  .channel('check-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_items' }, (p) => {
    if (recibido === null) recibido = { ms: performance.now() - t0, tabla: 'thread_items', ev: p.eventType };
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {});

const suscrito = await new Promise((resolve) => {
  const t = setTimeout(() => resolve('TIMEOUT'), TIMEOUT_MS);
  canal.subscribe((estado) => {
    if (estado === 'SUBSCRIBED' || estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
      clearTimeout(t);
      resolve(estado);
    }
  });
});

if (suscrito === 'SUBSCRIBED') ok('el canal se suscribe como usuario autenticado');
else mal(`el canal no se suscribe: ${suscrito}`);

// ── 4 · La otra parte escribe ───────────────────────────────────────────────
// `created_at` = el `last_item_at` que la fila ya tenía: el trigger de 0003 lo
// reescribe con ese mismo valor y la columna no se mueve.
t0 = performance.now();
const { data: nuevo, error: errIns } = await publicador
  .from('thread_items')
  .insert({
    thread_id: hilo.id,
    sender_org_id: otraOrg,
    sender_member_id: otroMiembro.id,
    item_type: 'MENSAJE',
    created_at: ultimoAntes,
    content_ciphertext: `\\x${'ab'.repeat(24)}`,
    content_iv: `\\x${'cd'.repeat(12)}`,
  })
  .select('id')
  .single();

if (errIns) {
  mal(`la escritura de la contraparte falla: ${errIns.message}`);
} else {
  await new Promise((r) => {
    const t = setTimeout(r, TIMEOUT_MS);
    const i = setInterval(() => {
      if (recibido !== null) {
        clearInterval(i);
        clearTimeout(t);
        r();
      }
    }, 10);
  });

  if (recibido) ok(`el elemento nuevo llega al suscriptor en ${Math.round(recibido.ms)} ms (${recibido.ev})`);
  else mal('el elemento nuevo NO llega: el canal conecta y no entrega (¿publicación?)');
}

// ── 5 · Limpieza, y comprobar que no queda rastro ───────────────────────────
if (nuevo) {
  const { error: errDel } = await publicador.from('thread_items').delete().eq('id', nuevo.id);
  if (errDel) mal(`NO se pudo borrar el elemento de prueba ${nuevo.id}: ${errDel.message}`);
}

const { data: despues } = await publicador
  .from('threads')
  .select('state, last_item_at')
  .eq('id', hilo.id)
  .single();

if (despues.state === estadoAntes) ok(`el estado del hilo no se movió (${estadoAntes})`);
else mal(`el estado cambió: ${estadoAntes} -> ${despues.state}`);

if (despues.last_item_at === ultimoAntes) ok('`last_item_at` intacto: el orden de MSG-01 no se toca');
else mal(`\`last_item_at\` cambió: ${ultimoAntes} -> ${despues.last_item_at}`);

const { count } = await publicador
  .from('thread_items')
  .select('id', { count: 'exact', head: true })
  .eq('thread_id', hilo.id)
  .eq('item_type', 'MENSAJE')
  .eq('sender_member_id', otroMiembro.id)
  .eq('created_at', ultimoAntes);
if ((count ?? 0) === 0) ok('no queda ningún elemento de prueba en la base');
else mal(`quedan ${count} elemento(s) de prueba sin borrar`);

await suscriptor.removeChannel(canal);
await suscriptor.auth.signOut();

console.log('');
if (fallos.length === 0) {
  console.log('REALTIME EN VERDE: propaga a través de RLS y no deja rastro.');
  process.exit(0);
}
console.log(`REALTIME EN ROJO: ${fallos.length} comprobación(es) fallan.`);
process.exit(1);
