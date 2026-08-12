// Primero el entorno, por lo mismo que en `fixtures.ts`: este módulo lee
// process.env en cuanto se evalúa.
import './env';
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { canResetFixture } from './fixtures';
import { HILO_IDS, buildSeed } from '../../supabase/seed/demo-content.mjs';

/**
 * Repone la siembra de demo ANTES de cada corrida de Playwright.
 *
 * ── POR QUÉ HACÍA FALTA, Y QUÉ DESBLOQUEA ───────────────────────────────────
 *
 * Hasta el 12-ago la suite **no sabía reponer nada**, y eso tenía una
 * consecuencia concreta: no se podía escribir un e2e que **enviara un mensaje de
 * verdad**. Enviar mueve el hilo al principio de la lista y cambia la vista
 * previa de MSG-01, así que rompía otros dos tests que ya existían — un test así
 * solo pasaba la primera vez.
 *
 * O sea que lo que faltaba no era el test: era esto. Y sin ello, **la reapertura
 * del hilo cerrado de D-07-01 no se observaba de punta a punta**, que es
 * justamente el argumento con el que D-08-02 metió el envío en el día 8.
 *
 * ── POR QUÉ POR `service_role` Y NO POR SQL ─────────────────────────────────
 *
 * No hay `psql` en la máquina de desarrollo ni en el runner, y montar uno para
 * esto sería más frágil que el problema. `service_role` salta RLS, que es lo que
 * hace falta para borrar filas ajenas y para escribir `members.public_key` de las
 * dos cuentas.
 *
 * ⚠ **Esta clave NO existe en la aplicación ni puede existir.** Vive solo aquí,
 * en el arranque de la suite, y nunca la ve el navegador: `supabase.ts` usa la
 * publicable y lo que protege los datos es RLS (`CLAUDE.md` §1 y §4).
 *
 * ── EL BORRADO ESTÁ ACOTADO A LOS CINCO HILOS DE DEMO ───────────────────────
 *
 * `HILO_IDS` son cinco UUID fijos de `demo-content.mjs`. **Un `delete` sin ese
 * filtro, con `service_role`, vaciaría la tabla entera** — y esta suite corre
 * contra el Supabase real, no contra una base desechable.
 */

const URL = process.env.VITE_SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_KEY ?? '';
const SEMILLA = process.env.VITE_DEMO_KEY_SEED ?? '';

setup('reponer la siembra de demo', async () => {
  /**
   * ⚠ SE SALTA CON MOTIVO A LA VISTA, NO EN SILENCIO.
   *
   * Es el mismo criterio que `haveCreds` en `fixtures.ts`, y viene del mismo
   * susto: un skip mudo hizo que la suite dijera *"3 passed"* sin haber probado
   * nada de lo que el día 2 tenía que demostrar. Los tests que dependen de la
   * siembra repuesta se saltan también, y lo dicen.
   *
   * Falta `SUPABASE_SERVICE_KEY` en los secrets de la CI: hasta que esté, el
   * test de envío no corre allí. Anotado en `PENDIENTE-PO.md`.
   */
  setup.skip(
    !canResetFixture,
    'sin VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY + VITE_DEMO_KEY_SEED no se puede reponer la siembra',
  );

  const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // `buildSeed` cifra y **comprueba que lo cifrado se abre con un par derivado de
  // nuevo**. Si eso falla lanza, y aquí no se borra nada: mejor una suite que no
  // arranca que una base de demo vaciada y rellenada con blobs ilegibles.
  const { publicKeys, items, wrapped } = await buildSeed(SEMILLA);

  for (const p of publicKeys) {
    const { error } = await db
      .from('members')
      .update({ public_key: `\\x${p.publicKeyHex}` })
      .eq('id', p.id);
    expect(error, `publicando la clave de ${p.id}`).toBeNull();
  }

  // Acotado a los cinco. El `cascade` de `0003:270` se lleva sus claves envueltas.
  const borrado = await db.from('thread_items').delete().in('thread_id', HILO_IDS);
  expect(borrado.error, 'borrando los elementos de demo').toBeNull();

  const ahora = Date.now();
  const insertado = await db.from('thread_items').insert(
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
  );
  expect(insertado.error, 'insertando los elementos de demo').toBeNull();

  const claves = await db.from('thread_item_keys').insert(
    wrapped.map((w) => ({
      item_id: w.item_id,
      recipient_member_id: w.recipient_member_id,
      wrapped_cek: `\\x${w.wrappedCekHex}`,
      wrap_iv: `\\x${w.wrapIvHex}`,
      ephemeral_pubkey: `\\x${w.ephemeralPubkeyHex}`,
    })),
  );
  expect(claves.error, 'depositando las CEK envueltas').toBeNull();

  /**
   * ⚠ Y EL HILO DE ANADOLU VUELVE A `CERRADO SIN ACUERDO`.
   *
   * El `insert` de arriba disparó `app.sync_thread_state`, y desde `0009` **un
   * elemento nuevo reabre un hilo cerrado** (D-07-01, F-045). Sin esta línea, la
   * suite empezaría cada corrida con cuatro estados en vez de cinco y el test de
   * "el campo de mensaje sigue en un hilo CERRADO SIN ACUERDO" no tendría hilo
   * cerrado que mirar.
   *
   * Pasa porque `service_role` está exento en `app.guard_thread_state`
   * (`0007:241`). Desde el cliente no se podría, y así debe ser.
   */
  const cerrado = await db
    .from('threads')
    .update({ state: 'CERRADO SIN ACUERDO' })
    .eq('id', HILO_IDS[HILO_IDS.length - 1]);
  expect(cerrado.error, 'devolviendo el hilo de Anadolu a cerrado').toBeNull();
});
