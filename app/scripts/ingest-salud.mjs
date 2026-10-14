/**
 * Salud del canal de ingestión por correo (INV-04) · día 40
 * =============================================================================
 *
 *     npm run ingest:salud            # últimos 7 días
 *     npm run ingest:salud -- 30      # últimos 30 días
 *
 * Resume `ingest_events` por día y resultado, desglosa los rechazos y los errores por
 * motivo, y dice cuándo fue el último correo. Es la «monitorización» de la fase 4 en su
 * versión mínima, decidida por el PO el 14-oct-2026: una consulta que se mira al abrir
 * sesión, sin alertas, mientras JULSA sea el único cliente real.
 *
 * Qué mirar: `ERROR` (siempre es un fallo nuestro), `RECHAZADO` por `AUTENTICACION`
 * (un dominio sin DMARC ni DKIM, F-252) o por `LIMITE_HORARIO`, y que el último correo
 * no sea de hace semanas si el cliente dice que envía.
 *
 * No imprime remitentes ni nombres de fichero: son datos de un socio y esto sale por
 * pantalla. Va con la clave de servicio (salta RLS), así que lee todas las organizaciones.
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

const dias = Number(process.argv[2] ?? 7);
if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
  throw new Error('El número de días tiene que ser un entero entre 1 y 365.');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

const { data: eventos, error } = await db
  .from('ingest_events')
  .select('org_id, received_at, result, reason, rows_imported')
  .gte('received_at', desde)
  .order('received_at', { ascending: false })
  .limit(5000);
if (error) throw new Error(`No se ha podido consultar «ingest_events» · ${error.message}`);

const { data: ultimo, error: errUltimo } = await db
  .from('ingest_events')
  .select('received_at, result')
  .order('received_at', { ascending: false })
  .limit(1);
if (errUltimo) throw new Error(`No se ha podido consultar el último correo · ${errUltimo.message}`);

const { data: orgs, error: errOrgs } = await db.from('organizations').select('id, name');
if (errOrgs) throw new Error(`No se ha podido consultar «organizations» · ${errOrgs.message}`);
const nombre = new Map(orgs.map((o) => [o.id, o.name]));

const porDia = new Map();
const porMotivo = new Map();
const porOrg = new Map();
let filas = 0;
for (const e of eventos) {
  const dia = e.received_at.slice(0, 10);
  const d = porDia.get(dia) ?? { PROCESADO: 0, RECHAZADO: 0, ERROR: 0 };
  d[e.result] += 1;
  porDia.set(dia, d);
  if (e.result !== 'PROCESADO') {
    const clave = `${e.result} · ${e.reason ?? 'sin motivo'}`;
    porMotivo.set(clave, (porMotivo.get(clave) ?? 0) + 1);
  }
  const org = e.org_id ? (nombre.get(e.org_id) ?? e.org_id) : '(dirección inexistente)';
  porOrg.set(org, (porOrg.get(org) ?? 0) + 1);
  filas += e.rows_imported ?? 0;
}

console.log(`Canal de ingestión por correo · últimos ${dias} días · ${eventos.length} eventos · ${filas} líneas importadas\n`);
console.log('Por día (más reciente primero)');
for (const [dia, d] of [...porDia.entries()].sort().reverse()) {
  console.log(`  ${dia}  PROCESADO ${d.PROCESADO} · RECHAZADO ${d.RECHAZADO} · ERROR ${d.ERROR}`);
}
console.log('\nRechazos y errores por motivo');
if (porMotivo.size === 0) console.log('  ninguno');
for (const [clave, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${clave}`);
}
console.log('\nPor organización');
if (porOrg.size === 0) console.log('  ninguna');
for (const [org, n] of [...porOrg.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${org}`);
}
console.log(
  '\nÚltimo correo recibido: ' +
    (ultimo.length > 0 ? `${ultimo[0].received_at} (${ultimo[0].result})` : 'ninguno nunca'),
);
const errores = eventos.filter((e) => e.result === 'ERROR').length;
if (errores > 0) {
  console.log(`\n⚠ Hay ${errores} evento(s) en ERROR: es un fallo del sistema, no del remitente. Mirar los logs de la función \`ingest-email\`.`);
}
if (eventos.length === 5000) {
  console.log('\n⚠ Se ha llegado al límite de 5000 eventos: el resumen no es completo. Reducir los días.');
}
