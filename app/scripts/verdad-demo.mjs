/**
 * La verdad contra la que se comprueba el interrogatorio · día 15
 * =============================================================================
 *
 *     npm run demo:verdad
 *
 * Imprime, consultado en el momento, lo que `guion-sesion-2.md` §2 lleva escrito
 * a mano desde el 16-ago: el catálogo, las líneas de `6205-2RS` que Alpha ve de
 * otras organizaciones, su inventario propio y los cinco hilos con quién envió
 * el último elemento.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * Porque una tabla transcrita envejece y nadie se entera. `F-094` ya lo midió en
 * el catálogo —la frescura la mueve el calendario, no la siembra— y `F-012`,
 * `F-089` y `F-095` son tres veces el mismo patrón: un documento afirmando un
 * estado que la base no tiene. §2 dice de sí misma *"vale mientras no corra la
 * suite e2e y se haya hecho el reseteo"*, que es otra forma de decir que su
 * validez caduca sin avisar.
 *
 * Y hace falta hoy para algo concreto: **contrastar las respuestas de VERA**.
 * Sin esto, el ensayo se contrasta contra una tabla de ayer, y entonces lo que
 * se está midiendo es si VERA coincide con un documento, no con la base.
 *
 * ── POR QUÉ NO REUTILIZA `search.ts` NI LAS HERRAMIENTAS ───────────────────
 *
 * A propósito, y es lo contrario de lo que pide el resto del repo. Aquí las
 * consultas se escriben aparte **porque el código de producción es lo que se
 * está verificando**: si la verdad de referencia saliera de `fetchResults`, una
 * respuesta de VERA construida sobre un filtro mal aplicado coincidiría con una
 * referencia construida sobre el mismo filtro mal aplicado, y las dos dirían que
 * todo está bien. Una medición que comparte el defecto con lo medido no mide.
 *
 * Va con la clave de servicio —que salta RLS—, así que el «lo que Alpha ve» se
 * reconstruye a mano excluyendo su propia organización: uno no se encuentra a sí
 * mismo en el catálogo.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

const AQUI = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(AQUI, '..', '.env'), quiet: true });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!url) throw new Error('Falta VITE_SUPABASE_URL en app/.env.');
if (!serviceKey) {
  throw new Error('Falta SUPABASE_SERVICE_KEY en el entorno de usuario (CLAUDE.md §10.1).');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/** `error` de PostgREST a excepción con el sitio dicho. */
function orLanza(paso, { data, error }) {
  if (error) throw new Error(`No se ha podido consultar «${paso}» · ${error.message}`);
  return data;
}

const dias = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

// -----------------------------------------------------------------------------

const orgs = orLanza(
  'organizaciones',
  await db.from('organizations').select('id, name, country, continent, status'),
);
const porId = new Map(orgs.map((o) => [o.id, o]));

const alphaOrgName = process.env.E2E_ALPHA_ORG;
const alpha = orgs.find((o) => o.name === alphaOrgName);
if (!alpha) throw new Error(`No existe la organización de Alpha («${alphaOrgName}»).`);

console.log(`\nLA VERDAD DE LA DEMO · medida el ${new Date().toISOString()}`);
console.log(`Alpha es «${alpha.name}» (${alpha.country} · ${alpha.continent}).\n`);

// 1 · El catálogo, por la misma función que usa el reseteo.
const estado = orLanza('demo_state', await db.rpc('demo_state'));
console.log('1 · CATÁLOGO');
console.log(
  `   ${estado.catalogo.total} líneas · ${estado.catalogo.frescas} frescas · ` +
    `${estado.catalogo.naranja} naranja · ${estado.catalogo.roja} roja · ` +
    `${estado.catalogo.futuro} en el futuro`,
);
console.log(`   organizaciones: ${orgs.length}, ${orgs.filter((o) => o.status === 'APPROVED').length} APPROVED`);
console.log(`   fuera de Europa: ${orgs.filter((o) => o.continent !== 'EU').map((o) => `${o.name} (${o.continent})`).join(', ') || 'ninguna'}`);

// 2 · Lo que Alpha ve del catálogo ajeno, sin filtros.
const ajenas = orLanza(
  'catálogo ajeno',
  await db
    .from('inventory_lines')
    .select('id, part_number, brand, quantity, lead_time_days, location_country, org_id, last_upload_at, status')
    .eq('status', 'PUBLISHED')
    .neq('org_id', alpha.id),
);
console.log(`\n2 · SIN FILTROS, ALPHA VE ${ajenas.length} LÍNEAS (el modelo solo recibe 25)`);

// 3 · `6205-2RS`, la referencia de la demo.
const ref = ajenas
  .filter((l) => l.part_number === '6205-2RS')
  .sort((a, b) => porId.get(a.org_id).name.localeCompare(porId.get(b.org_id).name));
console.log(`\n3 · 6205-2RS QUE ALPHA VE DE OTRAS: ${ref.length} líneas`);
for (const l of ref) {
  const o = porId.get(l.org_id);
  console.log(
    `   ${o.name.padEnd(20)} ${o.country}  ${String(l.brand).padEnd(6)} ` +
      `${String(l.quantity).padStart(5)} u  ${String(l.lead_time_days).padStart(3)} d  ` +
      `${dias(l.last_upload_at)} d sin actualizar`,
  );
}
const conFiltro = ref.filter((l) => l.quantity >= 500 && porId.get(l.org_id).continent === 'EU');
console.log(`   → con cantidad ≥ 500 y zona EU: ${conFiltro.length} líneas`);
const fuera = ref.filter((l) => l.quantity >= 500 && porId.get(l.org_id).continent !== 'EU');
console.log(
  `   → quedan fuera por zona pese a tener ≥ 500: ` +
    `${fuera.map((l) => `${porId.get(l.org_id).name} (${l.quantity} u)`).join(', ') || 'ninguna'}`,
);
console.log(`   → marcas presentes: ${[...new Set(ref.map((l) => l.brand))].sort().join(', ')}`);

// 4 · El inventario propio de Alpha.
const mio = orLanza(
  'inventario de Alpha',
  await db
    .from('inventory_lines')
    .select('part_number, brand, quantity, status, last_upload_at')
    .eq('org_id', alpha.id),
);
const publicadas = mio.filter((l) => l.status === 'PUBLISHED');
const viejas = publicadas.filter((l) => dias(l.last_upload_at) > 7);
console.log(`\n4 · INVENTARIO DE ALPHA: ${mio.length} líneas`);
for (const e of ['PUBLISHED', 'DRAFT', 'ARCHIVED', 'DELETED']) {
  const n = mio.filter((l) => l.status === e).length;
  if (n) console.log(`   ${e}: ${n}`);
}
console.log(`   desactualizadas (> 7 días) entre las publicadas: ${viejas.length}`);
for (const l of viejas) {
  console.log(`      ${l.part_number} · ${l.brand} · ${l.quantity} u · ${dias(l.last_upload_at)} días`);
}
const propias6205 = mio.filter((l) => l.part_number === '6205-2RS');
console.log(
  `   propias de 6205-2RS (NO salen en la búsqueda de catálogo): ` +
    `${propias6205.map((l) => `${l.brand} ${l.quantity}`).join(', ') || 'ninguna'}`,
);

// 5 · Los cinco hilos, con quién envió el último elemento.
const hilos = orLanza(
  'hilos',
  await db
    .from('threads')
    .select('id, org_low_id, org_high_id, state')
    .or(`org_low_id.eq.${alpha.id},org_high_id.eq.${alpha.id}`),
);
console.log(`\n5 · HILOS DE ALPHA: ${hilos.length}`);
for (const h of hilos) {
  const otra = porId.get(h.org_low_id === alpha.id ? h.org_high_id : h.org_low_id);
  const items = orLanza(
    'elementos del hilo',
    await db
      .from('thread_items')
      .select('item_type, part_number, brand, sender_org_id, estado_oferta, estado_consulta, created_at')
      .eq('thread_id', h.id)
      .order('created_at', { ascending: false })
      .limit(1),
  );
  const ultimo = items[0];
  const quien = ultimo ? (ultimo.sender_org_id === alpha.id ? 'ALPHA' : otra.name) : '—';
  console.log(
    `   ${otra.name.padEnd(20)} ${otra.country}  ${String(h.state).padEnd(23)} ` +
      `último: ${ultimo ? ultimo.item_type : '—'}` +
      `${ultimo?.part_number ? ` sobre ${ultimo.part_number}` : ''}` +
      `${ultimo?.brand ? ` · ${ultimo.brand}` : ''}` +
      `${ultimo?.estado_oferta ? ` · ${ultimo.estado_oferta}` : ''}` +
      ` · lo envió ${quien}`,
  );
}

const estados = new Set(hilos.map((h) => h.state));
console.log(`\n   estados distintos: ${estados.size} — ${[...estados].sort().join(' · ')}`);
if (estados.size !== 5) {
  console.log('   ⚠ NO son cinco estados distintos. Corre `npm run demo:reset` antes de seguir.');
}
console.log('');
