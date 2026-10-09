/**
 * Fija la contrasena de `operador@bearingworld.test` en el proyecto AISLADO
 * `bearingworld-e2e` (F-230). La pide por la terminal, oculta, dos veces: no pasa por
 * argumentos ni por variables de entorno, asi que no queda en el historial del shell.
 *
 * Que hace, y nada mas:
 *   1. Lee SUPABASE_E2E_URL y SUPABASE_E2E_SERVICE_KEY de app/.env (no los imprime).
 *   2. Se NIEGA a seguir si la URL no es la de bearingworld-e2e (ogdhyzgjjbbikjbkhxmu):
 *      nunca toca produccion.
 *   3. Cambia la contrasena del usuario por la Admin API de Auth.
 *   4. Escribe SUPABASE_E2E_OPERATOR_PASSWORD en app/.env (ignorado por git), para que
 *      `run-e2e-against-e2e-project.mjs` la use.
 *
 * Despues hay que poner ESA MISMA contrasena en el secreto E2E_OPERATOR_PASSWORD de
 * GitHub (Settings -> Secrets and variables -> Actions, y el entorno `staging`/
 * `production` si ahi tambien existe); si no, la CI deja de entrar como operador.
 *
 * Uso (desde app/):
 *     node scripts/set-e2e-operator-password.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const E2E_REF = 'ogdhyzgjjbbikjbkhxmu';
const OPERATOR_EMAIL = 'operador@bearingworld.test';
const MIN_LEN = 12;

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = join(APP_DIR, '.env');

function parseEnvPreferNonEmpty(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (val.length > 0 || !(key in out)) out[key] = val;
  }
  return out;
}

/** Lee una linea de la terminal sin hacer eco. */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Hace falta una terminal interactiva (stdin no es un TTY).'));
      return;
    }
    process.stdout.write(prompt);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

const raw = readFileSync(ENV_PATH, 'utf8');
const env = parseEnvPreferNonEmpty(raw);
const url = env.SUPABASE_E2E_URL;
const serviceKey = env.SUPABASE_E2E_SERVICE_KEY;
if (!url || !serviceKey) fail('Faltan SUPABASE_E2E_URL o SUPABASE_E2E_SERVICE_KEY en app/.env.');
if (!url.includes(E2E_REF)) {
  fail(`SUPABASE_E2E_URL no es el proyecto bearingworld-e2e (${E2E_REF}). No hago nada.`);
}

const base = url.replace(/\/+$/, '');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

console.log(`Proyecto: bearingworld-e2e (${E2E_REF})`);
console.log(`Usuario:  ${OPERATOR_EMAIL}`);
const pw1 = await askHidden(`Contraseña nueva (mínimo ${MIN_LEN} caracteres): `);
if (pw1.length < MIN_LEN) fail(`Demasiado corta (${pw1.length}); mínimo ${MIN_LEN}.`);
if (/[\s]/.test(pw1)) fail('No puede llevar espacios ni saltos de línea.');
const pw2 = await askHidden('Repítela: ');
if (pw1 !== pw2) fail('No coinciden. No se ha cambiado nada.');

// Localiza el usuario por correo.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const res = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
  if (!res.ok) fail(`No pude listar usuarios (HTTP ${res.status}).`);
  const body = await res.json();
  const users = body.users ?? [];
  user = users.find((u) => (u.email ?? '').toLowerCase() === OPERATOR_EMAIL) ?? null;
  if (users.length < 200) break;
}
if (!user) fail(`No existe ${OPERATOR_EMAIL} en bearingworld-e2e.`);

const upd = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ password: pw1 }),
});
if (!upd.ok) fail(`No se pudo cambiar la contraseña (HTTP ${upd.status}).`);
console.log('✓ Contraseña cambiada en bearingworld-e2e.');

// Guarda la misma en app/.env (una sola linea, sin duplicados).
const lines = raw.split(/\r?\n/).filter((l) => !/^SUPABASE_E2E_OPERATOR_PASSWORD=/.test(l));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(`SUPABASE_E2E_OPERATOR_PASSWORD=${pw1}`, '');
writeFileSync(ENV_PATH, lines.join(raw.includes('\r\n') ? '\r\n' : '\n'));
console.log('✓ SUPABASE_E2E_OPERATOR_PASSWORD escrita en app/.env.');
console.log('\nFalta UNA cosa: pon esa misma contraseña en el secreto E2E_OPERATOR_PASSWORD de GitHub.');
