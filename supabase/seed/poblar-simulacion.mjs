#!/usr/bin/env node
/**
 * Puebla la base compartida con hilos, consultas y ofertas SIMULADOS entre las organizaciones
 * de demo, para poder probar en el frontend cómo se busca y se encuentra con volumen.
 *
 * ── QUÉ HACE ────────────────────────────────────────────────────────────────
 *
 * Entre las siete organizaciones del universo de demo (las dos con cuenta de `dev_accounts.sql`
 * y las cinco sin miembros) crea un hilo por pareja (21) y, en cada hilo, DIEZ consultas de cada
 * lado con referencias distintas que la contraparte tiene de verdad publicadas. Una parte de las
 * consultas recibe oferta (Pendiente / Aceptada / Rechazada), otra queda "Sin stock" y el resto
 * Pendiente, para que cada usuario aparezca comprando y vendiendo a la vez. Las cinco
 * organizaciones sin miembros reciben uno (sin contraseña conocida: nadie entra con él) y
 * Suministros Industriales Levante recibe veinte líneas publicadas.
 *
 * ── LO QUE NO TOCA ──────────────────────────────────────────────────────────
 *
 * JULSA, Fulano, Nakishita, Rey Transmisiones y Jose Bearings quedan fuera: tienen claves y
 * datos propios que este script no puede verificar. Los hilos de demo existentes (los cinco
 * `HILO_IDS`) tampoco se tocan.
 *
 * ── CÓMO SE RETIRA ──────────────────────────────────────────────────────────
 *
 * Todo lo que crea lleva un id con prefijo `5eed000N-` (miembros 1, líneas 2, hilos 3, elementos
 * 4). `supabase/seed/retirar_simulacion.sql` borra exactamente eso y nada más.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   node supabase/seed/poblar-simulacion.mjs            # en seco: calcula, verifica y cuenta
 *   node supabase/seed/poblar-simulacion.mjs --apply    # escribe
 *   node supabase/seed/poblar-simulacion.mjs --apply --solo-un-hilo   # escribe una pareja
 *
 * Lee VITE_SUPABASE_URL y VITE_DEMO_KEY_SEED de app/.env y SUPABASE_SERVICE_KEY del entorno de
 * usuario. Nada de eso se imprime. Es contenido cifrado de verdad con la semilla de demo
 * (D-08-01, F-067): vale para datos inventados y para nada más.
 */

import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const require = createRequire(new URL('../../app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../../app/.env', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), quiet: true });

const { deriveKeyPairFromSeed, encryptContent, decryptContent, generateCek, toHex, wrapCekFor, unwrapCek } =
  await import('../../app/src/lib/crypto.ts');

const APLICAR = process.argv.includes('--apply');
const SOLO_UNO = process.argv.includes('--solo-un-hilo');
const SOLO_EXISTENTES = process.argv.includes('--solo-hilos-existentes');

const URL_BASE = process.env.VITE_SUPABASE_URL;
const SERVICIO = process.env.SUPABASE_SERVICE_KEY;
const SEMILLA = process.env.VITE_DEMO_KEY_SEED;
if (!URL_BASE || !SERVICIO || !SEMILLA) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_DEMO_KEY_SEED (app/.env) o SUPABASE_SERVICE_KEY (entorno de usuario).');
  process.exit(1);
}
if (!URL_BASE.includes('troxminloxkjwihwfevs')) {
  console.error('Este script está pensado para el proyecto compartido de desarrollo. Revisa VITE_SUPABASE_URL.');
  process.exit(1);
}
const db = createClient(URL_BASE, SERVICIO, { auth: { persistSession: false } });

// -----------------------------------------------------------------------------
// El universo
// -----------------------------------------------------------------------------
const id = (prefijo, n) => `5eed000${prefijo}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const ORGS = [
  { clave: 'IBERICOS', id: 'a1000000-0000-4000-8000-000000000001', nombre: 'Rodamientos Ibéricos', miembroFijo: 'a1000000-0000-4000-8000-00000000000a' },
  { clave: 'NORDWALZ', id: 'b2000000-0000-4000-8000-000000000002', nombre: 'Nordwälz Lager', miembroFijo: 'b2000000-0000-4000-8000-00000000000b' },
  { clave: 'CUSCINETTI', id: 'c3000000-0000-4000-8000-000000000003', nombre: 'Cuscinetti Padana', nuevo: 1, email: 'sim-cuscinetti@bearingworld.test' },
  { clave: 'LOZYSKA', id: 'd4000000-0000-4000-8000-000000000004', nombre: 'Łożyska Wschód', nuevo: 2, email: 'sim-lozyska@bearingworld.test' },
  { clave: 'RHONE', id: 'e5000000-0000-4000-8000-000000000005', nombre: 'Roulements Rhône', nuevo: 3, email: 'sim-rhone@bearingworld.test' },
  { clave: 'ANADOLU', id: 'f6000000-0000-4000-8000-000000000006', nombre: 'Anadolu Rulman', nuevo: 4, email: 'sim-anadolu@bearingworld.test' },
  { clave: 'LEVANTE', id: 'a9000000-0000-4000-8000-000000000009', nombre: 'Suministros Industriales Levante', nuevo: 5, email: 'sim-levante@bearingworld.test' },
];
for (const o of ORGS) if (o.nuevo) o.miembroFijo = id(1, o.nuevo);

// Generador pseudoaleatorio con semilla: dos pasadas dan lo mismo.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261101);
const entre = (a, b) => a + rnd() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const elige = (xs) => xs[Math.floor(rnd() * xs.length)];
const baraja = (xs) => {
  const c = [...xs];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};

const hexBytea = (b) => `\\x${toHex(b)}`;
const deBytea = (s) => Uint8Array.from(Buffer.from(String(s).replace(/^\\x/, ''), 'hex'));

// -----------------------------------------------------------------------------
// Lo que ya hay en la base
// -----------------------------------------------------------------------------
async function leer(consulta, etiqueta) {
  const { data, error } = await consulta;
  if (error) throw new Error(`${etiqueta}: ${error.message}`);
  return data;
}

const yaSimulados = await leer(
  db.from('thread_items').select('id').gte('id', '5eed0004-0000-0000-0000-000000000000').lte('id', '5eed0004-ffff-ffff-ffff-ffffffffffff').limit(1),
  'elementos ya simulados',
);
if (yaSimulados.length > 0 && !SOLO_EXISTENTES) {
  console.error('Ya hay elementos simulados. Ejecuta supabase/seed/retirar_simulacion.sql antes de volver a poblar (o usa --solo-hilos-existentes para reponer solo los hilos de demo).');
  process.exit(1);
}

// La base admite un hilo por pareja (threads_pair_uniq): si la pareja ya tiene uno (los cinco
// HILO_IDS de la demo), los elementos simulados van dentro de ese hilo.
const idsUniverso = ORGS.map((o) => o.id);
const hilosPrevios = await leer(
  db.from('threads').select('id,org_low_id,org_high_id').in('org_low_id', idsUniverso).in('org_high_id', idsUniverso),
  'hilos previos del universo',
);
const hiloDePareja = new Map(hilosPrevios.map((t) => [`${t.org_low_id}|${t.org_high_id}`, t.id]));
const clavePareja = (x, y) => (x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`);

const orgsBd = await leer(db.from('organizations').select('id,name,status').in('id', ORGS.map((o) => o.id)), 'organizaciones');
for (const o of ORGS) {
  const f = orgsBd.find((x) => x.id === o.id);
  if (!f || f.status !== 'APPROVED') throw new Error(`La organización ${o.nombre} no está APPROVED en la base.`);
}

const miembrosBd = await leer(
  db.from('members').select('id,org_id,state,public_key,email').in('org_id', ORGS.map((o) => o.id)),
  'miembros',
);

// Miembros del universo: los existentes activos con clave + los nuevos (planificados).
const miembros = new Map(); // id → { id, orgId, publicKey(Uint8Array), derivable, par? , nuevo }
const planNuevos = [];
for (const o of ORGS) {
  if (!o.nuevo) continue;
  if (!miembrosBd.some((m) => m.id === o.miembroFijo)) planNuevos.push(o);
}
for (const m of miembrosBd) {
  if (m.state !== 'ACTIVE' || !m.public_key) continue;
  miembros.set(m.id, { id: m.id, orgId: m.org_id, publicKey: deBytea(m.public_key), nuevo: false });
}
for (const o of planNuevos) {
  const par = await deriveKeyPairFromSeed(SEMILLA, o.miembroFijo);
  miembros.set(o.miembroFijo, { id: o.miembroFijo, orgId: o.id, publicKey: par.publicKey, par, nuevo: true });
}
// ¿Esa clave pública es la que da la semilla? Solo entonces se puede comprobar el descifrado.
for (const m of miembros.values()) {
  if (!m.par) m.par = await deriveKeyPairFromSeed(SEMILLA, m.id);
  m.derivable = toHex(m.par.publicKey) === toHex(m.publicKey);
}
for (const o of ORGS) {
  if (!miembros.has(o.miembroFijo)) throw new Error(`El remitente de ${o.nombre} no está activo con clave.`);
  if (!miembros.get(o.miembroFijo).derivable) {
    throw new Error(`La clave de ${o.miembroFijo} no coincide con la que da la semilla: no se podría comprobar el descifrado.`);
  }
}

// Stock publicado de cada organización (Ibéricos tiene miles: basta una muestra).
const stock = new Map();
for (const o of ORGS) {
  const lineas = await leer(
    db.from('inventory_lines')
      .select('id,part_number,brand,quantity,lead_time_days,location_country,product_family')
      .eq('org_id', o.id).eq('status', 'PUBLISHED').order('id').range(0, 1999),
    `stock de ${o.nombre}`,
  );
  stock.set(o.id, lineas);
}

// Levante no tiene ninguna línea publicada: se le dan veinte, tomadas de referencias reales de otras.
const lineasNuevas = [];
if (stock.get(ORGS.find((o) => o.clave === 'LEVANTE').id).length === 0) {
  const pool = baraja([
    ...stock.get(ORGS.find((o) => o.clave === 'CUSCINETTI').id),
    ...stock.get(ORGS.find((o) => o.clave === 'RHONE').id),
  ]);
  const vistas = new Set();
  for (const l of pool) {
    const k = `${l.part_number}|${l.brand}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    const n = lineasNuevas.length + 1;
    lineasNuevas.push({
      id: id(2, n),
      org_id: ORGS.find((o) => o.clave === 'LEVANTE').id,
      part_number: l.part_number,
      brand: l.brand,
      quantity: entero(20, 900),
      location_country: 'ES',
      product_family: l.product_family,
      status: 'PUBLISHED',
      lead_time_days: entero(2, 14),
      last_upload_at: new Date(Date.now() - entero(1, 6) * 86_400_000).toISOString(),
    });
    if (lineasNuevas.length === 20) break;
  }
  stock.set(ORGS.find((o) => o.clave === 'LEVANTE').id, lineasNuevas);
}

// -----------------------------------------------------------------------------
// Los hilos
// -----------------------------------------------------------------------------
const COMENTARIOS = [
  'Necesitamos reponer stock esta semana, ¿cuál es vuestra disponibilidad?',
  '¿Podéis servirlas en dos entregas?',
  'Consulta para un cliente de automoción; ¿tenéis certificado de origen?',
  '¿Admitís pedido con recogida en vuestro almacén?',
  'Es para un lote recurrente. ¿Hay descuento por volumen?',
  'Urgente: ¿plazo real de entrega a nuestro almacén?',
  '¿Mantenéis precio si cerramos en los próximos 15 días?',
  'Ref. para sustitución. ¿Hay equivalente de otra marca?',
  'Pedimos cantidad inicial; si encaja, ampliamos.',
  '¿Tenéis la serie completa o solo esta referencia?',
];
const NOTAS_OFERTA = [
  'Precio por unidad para el lote completo.',
  'Portes a cargo del comprador.',
  'Entrega desde nuestro almacén, embalaje incluido.',
  'Válida salvo venta previa.',
  'Posible mejora de precio por encima de 500 unidades.',
];

const pares = [];
for (let i = 0; i < ORGS.length; i++) for (let j = i + 1; j < ORGS.length; j++) pares.push([ORGS[i], ORGS[j]]);
const paresUsados = SOLO_UNO ? pares.slice(0, 1) : SOLO_EXISTENTES ? pares.filter(([x, y]) => hiloDePareja.has(clavePareja(x, y))) : pares;

const hilos = [];
const items = [];
const claves = [];
let nItem = 0;
let nHilo = 0;
const estadisticas = { consultas: 0, ofertas: 0, ofPend: 0, ofAcep: 0, ofRech: 0, sinStock: 0, conPend: 0, resp: 0, verificadas: 0 };

for (const [a, b] of paresUsados) {
  // Quien abre el hilo se sortea; las consultas son 10 de cada lado.
  const [primero, segundo] = rnd() < 0.5 ? [a, b] : [b, a];
  const secuencia = [];
  const eleccion = (emisor, receptor) => {
    const vistas = new Set();
    const lineas = [];
    for (const l of baraja(stock.get(receptor.id))) {
      const k = `${l.part_number}|${l.brand}`;
      if (vistas.has(k)) continue;
      vistas.add(k);
      lineas.push(l);
      if (lineas.length === 10) break;
    }
    if (lineas.length < 10) throw new Error(`${receptor.nombre} tiene menos de 10 referencias distintas publicadas.`);
    return lineas.map((l) => ({ emisor, receptor, linea: l }));
  };
  const deP = eleccion(primero, segundo);
  const deS = eleccion(segundo, primero);
  for (let k = 0; k < 10; k++) secuencia.push(deP[k], deS[k]);

  // Línea de tiempo: se reparte entre 15 y 55 días y termina entre 1 y 72 horas antes de ahora.
  const eventos = [];
  for (const c of secuencia) {
    eventos.push({ tipo: 'CONSULTA', c });
    const r = rnd();
    if (r < 0.4) eventos.push({ tipo: 'OFERTA', c });
    else if (r < 0.5) c.sinStock = true;
  }
  const pesos = eventos.map(() => entre(0.3, 1.7));
  const total = pesos.reduce((s, x) => s + x, 0);
  const span = entre(15, 55) * 86_400_000;
  const fin = Date.now() - entre(1, 72) * 3_600_000;
  let acum = 0;
  const hiloExistente = hiloDePareja.get(clavePareja(a, b));
  const hiloId = hiloExistente ?? id(3, ++nHilo);
  const instante = (k) => new Date(fin - span + (span * (acum += pesos[k])) / total);

  if (!hiloExistente) {
    hilos.push({
      id: hiloId,
      org_low_id: a.id < b.id ? a.id : b.id,
      org_high_id: a.id < b.id ? b.id : a.id,
      created_by_org_id: primero.id,
      state: 'ABIERTO',
      created_at: new Date(fin - span).toISOString(),
    });
  }

  const idConsulta = new Map();
  eventos.forEach((e, k) => {
    const cuando = instante(k).toISOString();
    const itemId = id(4, ++nItem);
    const c = e.c;
    const emisor = e.tipo === 'CONSULTA' ? c.emisor : c.receptor;
    const otro = e.tipo === 'CONSULTA' ? c.receptor : c.emisor;
    const l = c.linea;
    let contenido, fila;
    if (e.tipo === 'CONSULTA') {
      const cantidad = Math.max(1, Math.min(l.quantity, entero(10, 600)));
      contenido = { kind: 'CONSULTA', quantity: cantidad, comment: elige(COMENTARIOS) };
      idConsulta.set(c, itemId);
      c.cantidad = cantidad;
      estadisticas.consultas++;
      fila = {
        id: itemId, thread_id: hiloId, sender_org_id: emisor.id, sender_member_id: emisor.miembroFijo,
        item_type: 'CONSULTA', created_at: cuando, part_number: l.part_number, brand: l.brand,
        inventory_line_id: String(l.id).startsWith('5eed0002-') ? null : l.id,
        estado_consulta: null, estado_oferta: null, quantity: cantidad,
      };
      c.fila = fila;
    } else {
      const precio = Math.round(entre(1.5, 48) * 100) / 100;
      const r = rnd();
      const estado = r < 0.4 ? 'Pendiente' : r < 0.75 ? 'Aceptada' : 'Rechazada';
      contenido = {
        kind: 'OFERTA', unitPrice: precio, currency: 'EUR', quantity: c.cantidad,
        leadTimeDays: l.lead_time_days ?? entero(2, 12), shippingCost: null, shippingCostCurrency: null,
        validUntil: new Date(new Date(cuando).getTime() + 30 * 86_400_000).toISOString(), notes: elige(NOTAS_OFERTA),
      };
      estadisticas.ofertas++;
      if (estado === 'Pendiente') estadisticas.ofPend++; else if (estado === 'Aceptada') estadisticas.ofAcep++; else estadisticas.ofRech++;
      c.fila.estado_consulta = 'Respondida con oferta';
      fila = {
        id: itemId, thread_id: hiloId, sender_org_id: emisor.id, sender_member_id: emisor.miembroFijo,
        item_type: 'OFERTA', created_at: cuando, part_number: l.part_number, brand: l.brand,
        inventory_line_id: null, estado_consulta: null, estado_oferta: estado,
        responds_to_item_id: idConsulta.get(c), quantity: c.cantidad,
      };
    }
    items.push({ fila, contenido, emisor, otro });
  });
  for (const c of secuencia) {
    if (c.fila.estado_consulta === null) {
      c.fila.estado_consulta = c.sinStock ? 'Sin stock' : 'Pendiente';
      if (c.sinStock) estadisticas.sinStock++; else estadisticas.conPend++;
    } else estadisticas.resp++;
  }
}

// Cifrado: una CEK por elemento, envuelta para todos los miembros de las dos organizaciones.
for (const it of items) {
  const cek = await generateCek();
  const { ciphertext, iv } = await encryptContent(it.contenido, cek);
  it.fila.content_ciphertext = hexBytea(ciphertext);
  it.fila.content_iv = hexBytea(iv);
  const destinatarios = [...miembros.values()].filter((m) => m.orgId === it.emisor.id || m.orgId === it.otro.id);
  for (const m of destinatarios) {
    const w = await wrapCekFor(cek, m.publicKey);
    // Descifrado comprobado con un par derivado de nuevo, solo donde la semilla es la clave real.
    if (m.derivable) {
      const abierta = await unwrapCek(w, await deriveKeyPairFromSeed(SEMILLA, m.id));
      const leido = await decryptContent(ciphertext, iv, abierta);
      if (JSON.stringify(leido) !== JSON.stringify(it.contenido)) {
        throw new Error(`El elemento ${it.fila.id} no se recupera igual para ${m.id}. No se escribe nada.`);
      }
      estadisticas.verificadas++;
    }
    claves.push({
      item_id: it.fila.id,
      recipient_member_id: m.id,
      wrapped_cek: hexBytea(w.wrappedCek),
      wrap_iv: hexBytea(w.wrapIv),
      ephemeral_pubkey: hexBytea(w.ephemeralPublicKey),
    });
  }
}

// -----------------------------------------------------------------------------
// Informe (con y sin --apply)
// -----------------------------------------------------------------------------
const lineaInf = (s) => process.stdout.write(`${s}\n`);
lineaInf(`MODO: ${APLICAR ? 'ESCRITURA' : 'EN SECO (no se escribe nada)'}${SOLO_UNO ? ' · solo un hilo' : ''}`);
lineaInf(`Organizaciones: ${ORGS.length} · parejas/hilos: ${hilos.length}`);
lineaInf(`Miembros nuevos: ${planNuevos.length} · líneas nuevas (Levante): ${lineasNuevas.length}`);
lineaInf(`Elementos: ${items.length} (consultas ${estadisticas.consultas}, ofertas ${estadisticas.ofertas}) · claves envueltas: ${claves.length}`);
lineaInf(`Consultas: respondidas con oferta ${estadisticas.resp} · sin stock ${estadisticas.sinStock} · pendientes ${estadisticas.conPend}`);
lineaInf(`Ofertas: pendientes ${estadisticas.ofPend} · aceptadas ${estadisticas.ofAcep} · rechazadas ${estadisticas.ofRech}`);
lineaInf(`Descifrados verificados con par derivado de nuevo: ${estadisticas.verificadas}`);
const idsHilos = [...new Set(items.map((i) => i.fila.thread_id))];
const porHilo = idsHilos.map((h) => items.filter((i) => i.fila.thread_id === h).length);
lineaInf(`Hilos con elementos simulados: ${idsHilos.length} (${hilos.length} nuevos, ${idsHilos.length - hilos.length} de demo ya existentes)`);
lineaInf(`Elementos por hilo: mín ${Math.min(...porHilo)} · máx ${Math.max(...porHilo)}`);

if (!APLICAR) process.exit(0);

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------
async function insertar(tabla, filas, tam) {
  for (let i = 0; i < filas.length; i += tam) {
    const { error } = await db.from(tabla).insert(filas.slice(i, i + tam));
    if (error) throw new Error(`insert en ${tabla} (filas ${i}-${i + tam}): ${error.message}`);
  }
}

for (const o of planNuevos) {
  // La contraseña es aleatoria y se descarta: nadie entra con estas cuentas.
  const { error } = await db.auth.admin.createUser({
    id: o.miembroFijo,
    email: o.email,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: `Sim ${o.nombre}` },
  });
  if (error) throw new Error(`createUser ${o.email}: ${error.message}`);
  const m = miembros.get(o.miembroFijo);
  const { error: e2 } = await db.from('members').insert({
    id: o.miembroFijo, org_id: o.id, email: o.email, full_name: `Sim ${o.nombre}`, role: 'EDITOR', state: 'ACTIVE',
    public_key: hexBytea(m.publicKey),
  });
  if (e2) throw new Error(`members ${o.email}: ${e2.message}`);
}
if (lineasNuevas.length) await insertar('inventory_lines', lineasNuevas, 100);
if (hilos.length) await insertar('threads', hilos, 50);
// Un hilo por petición, en orden de tiempo: los disparadores derivan el estado del hilo elemento a elemento.
for (const h of idsHilos) {
  const delHilo = items.filter((i) => i.fila.thread_id === h).map((i) => i.fila);
  await insertar('thread_items', delHilo, 100);
}
await insertar('thread_item_keys', claves, 500);

const estados = await leer(db.from('threads').select('state').in('id', idsHilos), 'estados de hilo');
const cuenta = {};
for (const e of estados) cuenta[e.state] = (cuenta[e.state] ?? 0) + 1;
lineaInf(`ESCRITO. Estados de los hilos simulados: ${JSON.stringify(cuenta)}`);
