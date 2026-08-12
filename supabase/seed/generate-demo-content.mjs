#!/usr/bin/env node
/**
 * Genera `supabase/seed/demo_threads.sql` con contenido CIFRADO DE VERDAD.
 *
 * ── POR QUÉ EXISTE (D-08-01, opción (a)) ────────────────────────────────────
 *
 * Hasta el día 8, `demo_threads.sql` llevaba `decode('a1b2c3d4e5f6','hex')` en
 * los cinco elementos y lo decía sin rodeos: *"EL CONTENIDO CIFRADO ES RELLENO A
 * PROPÓSITO"*. Daba igual mientras MSG-01 nunca descifrara. Con la rebanada E2EE
 * dejó de dar igual: los cinco hilos de la demo enseñarían `Contenido cifrado —
 * introduce tu frase de seguridad para ver` en cada elemento, y el día 11 es la
 * primera sesión con el socio. El `Plan §3` de ese día pide además un *"panel de
 * vista-servidor"* que **necesita** que arriba se lea y abajo no.
 *
 * ── LO QUE SE RELAJA, DICHO ENTERO ──────────────────────────────────────────
 *
 * Las privadas de la demo se derivan de una semilla fija del entorno en vez de
 * ser aleatorias por sesión. **El servidor sigue sin ver nada**: no almacena
 * ninguna privada, no la ve pasar y no participa en el descifrado. Lo único que
 * cambia es de dónde sale la clave.
 *
 * ⚠ **QUIEN TENGA LA SEMILLA TIENE TODAS LAS PRIVADAS DE LA DEMO.** Vale para
 * datos inventados y para nada más. NO es una implementación de ADR-001 y no debe
 * existir en V1 — anotado como divergencia en `findings-register.md` (F-067).
 *
 * ── DÓNDE VIVEN LOS DATOS Y POR QUÉ NO AQUÍ ─────────────────────────────────
 *
 * En `demo-content.mjs`, porque hay **dos** consumidores: este generador y el
 * reseteo de fixture del e2e (`app/e2e/fixture.setup.ts`). Dos copias derivarían,
 * y el síntoma —la suite pasa en local y falla en CI— no apuntaría a la causa.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs
 *
 * La misma semilla tiene que estar en `app/.env` o el navegador derivará otras
 * claves y no abrirá nada de esto.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ALPHA_ORG, HILOS, buildSeed } from './demo-content.mjs';

const SEMILLA = process.env.VITE_DEMO_KEY_SEED;
if (!SEMILLA) {
  // Sin semilla no se genera nada a medias: un fichero con relleno y pinta de
  // generado sería peor que el de ayer, que al menos lo decía en la cabecera.
  console.error(
    'Falta VITE_DEMO_KEY_SEED. Es la semilla de las claves deterministas de la demo\n' +
      '(D-08-01 a). Tiene que ser la MISMA que use app/.env, o el navegador derivará\n' +
      'otras claves y no abrirá nada de lo que se siembre aquí.\n\n' +
      '  VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs',
  );
  process.exit(1);
}

// `buildSeed` cifra y **comprueba que lo cifrado se abre con un par derivado de
// nuevo**; si no, lanza y aquí no se escribe nada.
const { publicKeys, items, wrapped } = await buildSeed(SEMILLA);

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const filasPublica = publicKeys
  .map(
    (p) =>
      `update public.members set public_key = decode('${p.publicKeyHex}', 'hex')\n` +
      ` where id = '${p.id}';`,
  )
  .join('\n\n');

const filasHilo = HILOS.map(
  (h) =>
    `  -- ${h.comentario}\n` +
    `  ('${h.id}'::uuid,\n` +
    `   '${ALPHA_ORG}'::uuid, '${h.orgAlta}'::uuid,\n` +
    `   '${h.creadoPor ?? ALPHA_ORG}'::uuid, '${h.estado}', now() - interval '${h.hace}')`,
).join(',\n');

const filasItem = items
  .map(
    (i) =>
      `  ('${i.id}'::uuid, '${i.thread_id}'::uuid,\n` +
      `   '${i.sender_org_id}'::uuid, '${i.sender_member_id}'::uuid,\n` +
      `   '${i.item_type}', now() - interval '${i.horas} hours',\n` +
      `   ${q(i.part_number)}, ${q(i.brand)}, ${q(i.estado_consulta)}, ${q(i.estado_oferta)},\n` +
      `   decode('${i.ciphertextHex}', 'hex'), decode('${i.ivHex}', 'hex'))`,
  )
  .join(',\n');

const filasClave = wrapped
  .map(
    (w) =>
      `  ('${w.item_id}'::uuid, '${w.recipient_member_id}'::uuid,\n` +
      `   decode('${w.wrappedCekHex}', 'hex'), decode('${w.wrapIvHex}', 'hex'),\n` +
      `   decode('${w.ephemeralPubkeyHex}', 'hex'))`,
  )
  .join(',\n');

const cerrado = HILOS.find((h) => h.estado === 'CERRADO SIN ACUERDO');

const sql = `\\encoding UTF8
-- ---------------------------------------------------------------------------
-- Siembra de hilos de demo · MSG-01 · Lista de Hilos · MSG-02 · Vista de un Hilo
--
-- ⚠ FICHERO GENERADO. No se edita a mano: se regenera con
--
--     VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs
--
-- porque el contenido va CIFRADO y a mano no se puede escribir. Los datos viven
-- en \`supabase/seed/demo-content.mjs\`, que comparte con el reseteo de fixture
-- del e2e. Los metadatos (tipo, referencia, marca, estados, fechas) sí se leen
-- aquí: van en claro en \`thread_items\` desde 0003 y son lo que MSG-01 pinta en
-- la vista previa.
--
-- ── QUÉ CAMBIÓ EL DÍA 8 (D-08-01, opción (a)) ──────────────────────────────
--
-- Hasta entonces esta siembra decía *"EL CONTENIDO CIFRADO ES RELLENO A
-- PROPÓSITO"*. Con la rebanada E2EE los cinco hilos habrían enseñado
-- \`Contenido cifrado — introduce tu frase de seguridad para ver\` en cada
-- elemento, el día 11, delante del socio.
--
-- Ahora el contenido es real. **El servidor sigue sin poder leerlo**: lo único
-- que se relaja es de dónde sale la clave. Quien tenga la semilla tiene todas
-- las privadas de la demo — NO es ADR-001 y no debe existir en V1 (F-067).
-- ---------------------------------------------------------------------------

\\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1 · Las claves públicas de las dos cuentas
--
-- Sin esto, la contraparte no tiene con qué envolver una CEK y no puede
-- escribirle a nadie: el envío de MSG-02 se niega y dice de quién falta la
-- clave (0012 §3). La app las vuelve a publicar en cada arranque de sesión
-- (\`keys.ts\`); aquí se ponen para que la siembra se pueda abrir desde el primer
-- minuto, sin depender de que alguien haya entrado antes.
-- ---------------------------------------------------------------------------
${filasPublica}

-- ---------------------------------------------------------------------------
-- 2 · Los cinco hilos, uno por estado del CHECK de \`thread-lifecycle\`
-- ---------------------------------------------------------------------------
insert into public.threads (id, org_low_id, org_high_id, created_by_org_id, state, last_item_at)
values
${filasHilo}
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3 · El elemento de cada hilo, con contenido cifrado de verdad
--
-- ⚠ SE BORRA ANTES DE INSERTAR, y el borrado está acotado a estos cinco hilos.
-- Las instalaciones que corrieron la siembra anterior tienen los elementos de
-- relleno con ids aleatorios, así que un \`on conflict (id)\` no los alcanzaría y
-- quedarían los dos juegos —el viejo opaco y el nuevo legible— en el mismo
-- historial. Las filas de \`thread_item_keys\` se van solas por
-- \`on delete cascade\` (0003:270).
-- ---------------------------------------------------------------------------
delete from public.thread_items
 where thread_id in (
${HILOS.map((h) => `   '${h.id}'::uuid`).join(',\n')}
 );

insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type, created_at,
   part_number, brand, estado_consulta, estado_oferta,
   content_ciphertext, content_iv)
values
${filasItem};

-- ---------------------------------------------------------------------------
-- 4 · La CEK de cada elemento, envuelta una vez por miembro que debe leerla
--
-- Los cuatro hilos con organizaciones sin cuenta llevan UNA sola fila: esas
-- cuatro no tienen miembros en el MVP, así que no hay a quién envolvérsela.
-- El hilo de Nordwälz lleva dos, una por cada parte.
-- ---------------------------------------------------------------------------
insert into public.thread_item_keys
  (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
values
${filasClave}
on conflict (item_id, recipient_member_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5 · Devolver el hilo de Anadolu a CERRADO SIN ACUERDO
--
-- ⚠ ESTO NO ES REDUNDANTE Y CUESTA UN ESTADO DE LA DEMO SI SE QUITA.
--
-- El \`insert\` de arriba dispara \`app.sync_thread_state\`, y desde 0009 **un
-- elemento nuevo reabre un hilo cerrado** (D-07-01, F-045): el hilo saldría de
-- aquí en ABIERTO, y MSG-01 dejaría de tener sus cinco estados — que es la razón
-- entera por la que hay cinco hilos y no uno.
--
-- El \`update\` pasa porque la siembra corre como \`postgres\`, y
-- \`app.guard_thread_state\` (0007:241) exime a \`service_role\` y \`postgres\`. Desde
-- el cliente esto no se podría hacer, y así debe ser.
-- ---------------------------------------------------------------------------
update public.threads set state = '${cerrado.estado}'
 where id = '${cerrado.id}';
`;

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, 'demo_threads.sql');
writeFileSync(destino, sql, 'utf8');

// Se imprimen las PÚBLICAS y nada más. Ninguna privada ni la semilla salen por
// aquí: ADR-001 §8, "ni en payloads, ni en logs, ni en mensajes de error".
console.log(`Escrito ${destino}`);
console.log(`  ${HILOS.length} hilos · ${items.length} elementos · ${wrapped.length} claves envueltas`);
for (const p of publicKeys) console.log(`  pública de ${p.id}: ${p.publicKeyHex}`);
