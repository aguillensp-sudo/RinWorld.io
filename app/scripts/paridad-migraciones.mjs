#!/usr/bin/env node
/**
 * Paridad de migraciones (F-277) · lo que corre la CI antes del e2e.
 *
 * Por qué existe: el 20-oct-2026 `bearingworld-e2e` no tenía `0061`–`0064` ni `0068`,
 * que producción sí tenía, y la CI llevaba días pasando la suite contra un esquema
 * que no era el real. La base de ensayo se migra a mano por el MCP, igual que
 * producción, y nadie comparaba las dos listas. Un verde contra una base desfasada
 * no significa nada; por eso el job `e2e` depende de este.
 *
 * SOLO COMPARA. No aplica nada a ninguna base (CLAUDE.md §10.2): si falta algo, lo
 * dice y falla, y la migración se aplica a mano por el MCP, revisada.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=… node scripts/paridad-migraciones.mjs
 *   node scripts/paridad-migraciones.mjs --de-fichero registradas.json
 *     (registradas.json = { "produccion": [{version,name}…], "e2e": […] },
 *      p. ej. sacado por el MCP con `select version, name from
 *      supabase_migrations.schema_migrations`; para comprobar sin token)
 *
 * El token es el secreto `SUPABASE_TOKEN` (scopeado a la org de las dos bases). No
 * se imprime nunca: ni él ni las cabeceras.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobarParidad, mensajes } from './paridad-migraciones-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

/** Los refs no son secretos: están en CLAUDE.md §10.2 y en `entornos.md`. */
const BASES = {
  produccion: 'troxminloxkjwihwfevs',
  e2e: 'ogdhyzgjjbbikjbkhxmu',
};

const API = 'https://api.supabase.com/v1/projects';
const SQL = 'select version, name from supabase_migrations.schema_migrations order by version';

async function pedir(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  return res;
}

/**
 * Primero el endpoint de migraciones de la Management API (el que usa
 * `list_migrations` del MCP); si no existe para este token o este proyecto, la
 * misma consulta por `database/query`. Las dos leen la misma tabla.
 */
async function registradasDe(nombre, ref, token) {
  let res = await pedir(`${API}/${ref}/database/migrations`, token);
  if (res.ok) return { filas: await res.json(), via: 'database/migrations' };
  const primero = res.status;
  if (primero === 401) {
    throw new Error(`${nombre} (${ref}): 401, el token no vale. Revisa el secreto SUPABASE_TOKEN.`);
  }
  res = await pedir(`${API}/${ref}/database/query`, token, {
    method: 'POST',
    body: JSON.stringify({ query: SQL }),
  });
  if (res.ok) return { filas: await res.json(), via: `database/query (database/migrations dio ${primero})` };
  throw new Error(
    `${nombre} (${ref}): la Management API respondió ${primero} y ${res.status}. ` +
      'Si es 403, el token no tiene permiso de lectura de base en ese proyecto.',
  );
}

function ficherosDelRepo() {
  return readdirSync(join(repo, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'));
}

function excepciones() {
  const json = JSON.parse(readFileSync(join(repo, 'supabase', 'paridad-migraciones.json'), 'utf8'));
  return json.excepciones;
}

async function main() {
  const i = process.argv.indexOf('--de-fichero');
  let registradas = {};
  if (i > 0) {
    registradas = JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));
    console.log(`Listas registradas leídas de ${process.argv[i + 1]} (sin red).`);
  } else {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) {
      // Sin token no hay comprobación, y un verde sin comprobar es el fallo que esto evita.
      console.error('::error::F-277 · falta SUPABASE_ACCESS_TOKEN (secreto SUPABASE_TOKEN): no se puede comparar.');
      process.exit(1);
    }
    for (const [nombre, ref] of Object.entries(BASES)) {
      const { filas, via } = await registradasDe(nombre, ref, token);
      registradas[nombre] = filas;
      console.log(`${nombre} (${ref}): ${filas.length} migraciones registradas, vía ${via}.`);
    }
  }

  const ficheros = ficherosDelRepo();
  const bases = Object.keys(BASES).map((nombre) => ({ nombre, registradas: registradas[nombre] ?? [] }));
  const r = comprobarParidad({ ficheros, bases, excepciones: excepciones() });

  console.log(`Repo: ${ficheros.length} ficheros. Diferencias conocidas y aceptadas: ${r.aceptadas}.`);
  if (r.ok) {
    console.log('Paridad de migraciones: repo, producción y bearingworld-e2e cuadran.');
    return;
  }
  for (const l of mensajes(r, BASES)) console.error(`::error::F-277 · ${l}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(`::error::F-277 · ${e.message}`);
  process.exit(1);
});
