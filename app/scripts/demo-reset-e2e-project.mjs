/**
 * Reseteo de la siembra de demo · proyecto Supabase AISLADO de e2e
 * =============================================================================
 *
 * `scripts/demo-reset.mjs` reseteia la siembra de demo, pero su entrypoint de
 * CLI lee `app/.env` con `dotenv` y usa siempre `VITE_SUPABASE_URL` /
 * `SUPABASE_SERVICE_KEY` / `VITE_DEMO_KEY_SEED` — que apuntan al proyecto
 * COMPARTIDO (`troxminloxkjwihwfevs`), nunca al aislado de e2e
 * (`bearingworld-e2e`, `ogdhyzgjjbbikjbkhxmu`, entregable 3 de Fundación V1 /
 * F-149).
 *
 * Este script es el mismo `resetDemo()` (misma lógica, un solo sitio: no hay
 * un segundo camino que pueda divergir), apuntado a las variables `SUPABASE_E2E_*`
 * en vez de a las `VITE_*`/`SUPABASE_SERVICE_KEY` de siempre. Uso:
 *
 *     node scripts/demo-reset-e2e-project.mjs
 *
 * ⚠ POR QUÉ NO USA `dotenv.config()` A SECAS SOBRE TODO EL FICHERO.
 *
 * `app/.env` tiene HOY dos bloques que declaran `SUPABASE_E2E_URL` /
 * `SUPABASE_E2E_PUBLISHABLE_KEY` / `SUPABASE_E2E_SERVICE_KEY`: uno con los
 * valores reales (añadido al crear el proyecto) y otro más abajo, puramente
 * documental, que repite las dos claves públicas pero deja
 * `SUPABASE_E2E_SERVICE_KEY` en blanco. `dotenv` resuelve una clave duplicada
 * quedándose con la ÚLTIMA aparición del fichero — que aquí es la vacía — así
 * que un `dotenv.config()` ingenuo entrega un service key vacío sin avisar y
 * el reseteo fallaría más abajo, no aquí, con un mensaje que no apunta a la
 * causa. Por eso este fichero parsea `.env` a mano y, por clave, se queda con
 * la última aparición NO VACÍA en vez de con la última a secas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { resetDemo } from './demo-reset.mjs';

function parseEnvPreferNonEmpty(path) {
  const raw = readFileSync(path, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (val.length > 0 || !(key in out)) out[key] = val;
  }
  return out;
}

const AQUI = fileURLToPath(import.meta.url);
const esComando = !!process.argv[1] && resolve(process.argv[1]) === resolve(AQUI);

if (esComando) {
  const envPath = join(dirname(AQUI), '..', '.env');
  const env = parseEnvPreferNonEmpty(envPath);

  const linea = (s) => process.stdout.write(`${s}\n`);

  try {
    linea('RESETEO DEL PROYECTO E2E AISLADO (bearingworld-e2e)');
    const estado = await resetDemo({
      url: env.SUPABASE_E2E_URL,
      serviceKey: env.SUPABASE_E2E_SERVICE_KEY,
      seed: env.VITE_DEMO_KEY_SEED,
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
    linea('La demo del proyecto e2e está en su estado congelado.');
  } catch (e) {
    process.stderr.write(`\n${e.message}\n\n`);
    process.exit(1);
  }
}
