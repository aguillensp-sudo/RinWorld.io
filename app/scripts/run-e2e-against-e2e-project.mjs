/**
 * Corre la suite real de Playwright (`npm run e2e`) contra el proyecto
 * Supabase AISLADO de e2e (`bearingworld-e2e`, `ogdhyzgjjbbikjbkhxmu`),
 * entregable 3 de Fundación V1 (F-149) — sin tocar `app/.env` ni el proyecto
 * compartido (`troxminloxkjwihwfevs`).
 *
 * `playwright.config.ts` construye la app con `npm run build` (Vite inlina
 * `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` en el bundle) y luego
 * `npm run preview` la sirve; `e2e/fixture.setup.ts`/`restore.teardown.ts`
 * usan `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + `VITE_DEMO_KEY_SEED` de
 * `process.env` para reponer la siembra antes/después de cada corrida. Ninguno
 * de los dos sabe de `SUPABASE_E2E_*` — son nombres de este repo, no de Vite
 * ni de Playwright — así que este script traduce: lee las claves `E2E_*`/
 * `SUPABASE_E2E_*` de `app/.env` (con el mismo parseo tolerante a duplicados
 * que `demo-reset-e2e-project.mjs` — ver ahí el porqué) y lanza
 * `npm run e2e` con esas tres variables SOBRESCRITAS en el entorno del hijo.
 * Vite, como Node, da prioridad a un `process.env` ya puesto por encima de lo
 * que lea de `.env`, así que el build apunta de verdad al proyecto aislado.
 *
 * `E2E_ALPHA_*`/`E2E_BETA_*` (credenciales, no endpoint) NO se tocan: son las
 * mismas cuentas por email/password en los dos proyectos (Supabase Auth es por
 * proyecto, sin colisión), así que dotenv las coge tal cual de `app/.env`.
 *
 * Uso:
 *     node scripts/run-e2e-against-e2e-project.mjs [-- <args de playwright>]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

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
const APP_DIR = join(dirname(AQUI), '..');
const env = parseEnvPreferNonEmpty(join(APP_DIR, '.env'));

function need(key) {
  const v = env[key];
  if (!v) throw new Error(`Falta ${key} en app/.env`);
  return v;
}

const childEnv = {
  ...process.env,
  VITE_SUPABASE_URL: need('SUPABASE_E2E_URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: need('SUPABASE_E2E_PUBLISHABLE_KEY'),
  SUPABASE_SERVICE_KEY: need('SUPABASE_E2E_SERVICE_KEY'),
  VITE_DEMO_KEY_SEED: need('VITE_DEMO_KEY_SEED'),
  // E2E_ALPHA_*/E2E_BETA_*/E2E_EDITOR_* se heredan de process.env tal cual;
  // si no están ya puestas, dotenv (e2e/env.ts) las coge de app/.env.
};

const extra = process.argv.slice(2);
const args = extra[0] === '--' ? extra.slice(1) : extra;

const child = spawn('npm', ['run', 'e2e', ...(args.length ? ['--', ...args] : [])], {
  cwd: APP_DIR,
  env: childEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 1));
