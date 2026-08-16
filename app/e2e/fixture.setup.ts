// Primero el entorno, por lo mismo que en `fixtures.ts`: este módulo lee
// process.env en cuanto se evalúa.
import './env';
import { test as setup } from '@playwright/test';
import { canResetFixture } from './fixtures';
import { resetDemo } from '../scripts/demo-reset.mjs';

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
 * ── EL CUERPO SE MUDÓ A `scripts/demo-reset.mjs` EL DÍA 13, Y NO ES ORDEN ────
 *
 * Reponer **al arrancar** deja la base sucia **al terminar**, y eso se midió:
 * el 16-ago el hilo de Anadolu estaba en `ABIERTO` con dos mensajes en vez de en
 * `CERRADO SIN ACUERDO` con uno, residuo de esta misma suite. MSG-01 enseñaba
 * cuatro estados en vez de cinco, que es la primera pantalla de la demo.
 *
 * El arreglo es `restore.teardown.ts`, que repone también al final. Y para que
 * el "antes" y el "después" no puedan divergir, los dos —y `npm run demo:reset`,
 * que es el que se corre a mano antes de cada ensayo— llaman **al mismo código**.
 * Lo que queda aquí es la puerta de entrada de Playwright, no la lógica.
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
 */
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

  await resetDemo({
    url: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    seed: process.env.VITE_DEMO_KEY_SEED,
    /*
     * ⚠ AQUÍ NO SE RE-ANCLA LA FRESCURA, Y ES DELIBERADO.
     *
     * Desplazar las fechas del catálogo a mitad de suite cambiaría lo que ve
     * SRCH-01 sin que ningún test lo haya pedido, y —peor— taparía la
     * degradación por calendario que `supabase/tests/05_freshness_asserts.sql`
     * existe para cazar (F-094). El re-anclaje es cosa del ensayo, no de la
     * prueba: lo hace `npm run demo:reset`.
     */
    reanchor: false,
  });
});
