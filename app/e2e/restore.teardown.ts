// Igual que en `fixture.setup.ts`: el entorno primero, antes de que nadie lea
// process.env al evaluarse.
import './env';
import { test as teardown } from '@playwright/test';
import { canResetFixture } from './fixtures';
import { resetDemo } from '../scripts/demo-reset.mjs';

/**
 * Deja la base de demo como la encontró, al TERMINAR la corrida.
 *
 * ── EL HALLAZGO QUE LO TRAE (día 13) ────────────────────────────────────────
 *
 * `F-095` había dicho que el estado de demo es efímero porque la suite lo repone
 * al arrancar. Lo que faltaba por ver es la otra mitad: **reponer solo al
 * arrancar significa irse dejándolo roto**. Medido el 16-ago contra
 * `troxminloxkjwihwfevs`, antes de tocar nada: el hilo de Anadolu estaba en
 * `ABIERTO` con dos elementos en vez de en `CERRADO SIN ACUERDO` con uno.
 *
 * No lo rompió nadie. Lo dejó así `messages.spec.ts`, el test que comprueba que
 * un elemento nuevo **reabre** un hilo cerrado (`D-07-01`, `0009`) — o sea, un
 * test correcto haciendo exactamente lo que tiene que hacer. La suite se fue y
 * la base se quedó reabierta.
 *
 * Consecuencia: **MSG-01 con cuatro estados en vez de cinco**. Es la primera
 * pantalla que ve el socio y `seed/demo_threads.sql` §5 se molesta expresamente
 * en forzar el quinto. Cualquiera que abriera la demo después de una corrida
 * —sin saber que había habido una— vería un estado que no es el diseñado y no
 * tendría forma de saber por qué.
 *
 * ── POR QUÉ UN TEARDOWN Y NO "acuérdate de correr el reseteo" ───────────────
 *
 * Porque lo segundo es un ruego, y este repo tiene tres hallazgos (F-012, F-089,
 * F-095) que son todos la misma forma: un estado que alguien tenía que mantener
 * a mano y no mantuvo. El teardown lo hace la herramienta.
 *
 * ⚠ **No sustituye a `npm run demo:reset` antes del ensayo.** Esto cubre el daño
 * que hace la suite; no cubre el envejecimiento del catálogo por calendario
 * (F-094), que no lo causa nadie y pasa igual con la suite parada. El paso 0 del
 * guion de la sesión sigue en pie.
 */
teardown('devolver la siembra de demo a su estado congelado', async () => {
  teardown.skip(
    !canResetFixture,
    'sin VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY + VITE_DEMO_KEY_SEED no se puede reponer la siembra',
  );

  // `reanchor: false` por lo mismo que en el setup: el catálogo es cosa del
  // ensayo, no de la prueba.
  await resetDemo({
    url: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    seed: process.env.VITE_DEMO_KEY_SEED,
    reanchor: false,
  });
});
