#!/usr/bin/env node
/**
 * Genera `supabase/seed/demo_threads.sql` con contenido CIFRADO DE VERDAD.
 *
 * ── POR QUÉ EXISTE (D-08-01, opción (a)) ────────────────────────────────────
 *
 * Hasta el día 8, `demo_threads.sql` llevaba `decode('a1b2c3d4e5f6','hex')` en
 * los cinco elementos y lo decía sin rodeos: *"EL CONTENIDO CIFRADO ES RELLENO A
 * PROPÓSITO"*. Daba igual mientras MSG-01 nunca descifrara. Con la rebanada E2EE
 * ya no da igual: los cinco hilos de la demo enseñarían `Contenido cifrado —
 * introduce tu frase de seguridad para ver` en cada elemento, y el día 11 es la
 * primera sesión con el socio.
 *
 * El `Plan §3` del día 11 pide además un *"panel de vista-servidor (comprador
 * vs. lo que almacena Postgres)"*, que **necesita** que arriba se lea y abajo no.
 * Con relleno, las dos mitades salen ilegibles y el panel no demuestra nada.
 *
 * ── LO QUE SE RELAJA, DICHO ENTERO ──────────────────────────────────────────
 *
 * Las privadas de la demo se derivan de una semilla fija del entorno en vez de
 * ser aleatorias por sesión. **El servidor sigue sin ver nada**: no almacena
 * ninguna privada, no la ve pasar y no participa en el descifrado. Lo único que
 * cambia es de dónde sale la clave.
 *
 * ⚠ **QUIEN TENGA LA SEMILLA TIENE TODAS LAS PRIVADAS DE LA DEMO.** Vale para
 * datos inventados y para nada más. NO es una implementación de ADR-001 y no
 * debe existir en V1 — está anotado como divergencia en `findings-register.md`.
 *
 * ── POR QUÉ IMPORTA `crypto.ts` EN VEZ DE COPIAR LA CRIPTOGRAFÍA ────────────
 *
 * Si la siembra derivara las claves con su propio código, bastaría un cambio de
 * un `info` de HKDF en la app para que nada de lo sembrado volviera a abrirse —
 * y el síntoma sería "la demo sale opaca", tres días después, sin nada que
 * apunte a la causa. Node 24 importa TypeScript directamente, así que aquí corre
 * **exactamente el mismo módulo que el navegador**. Si eso deja de ser cierto,
 * este script deja de funcionar, que es justo lo que tiene que pasar.
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

const {
  decryptContent,
  deriveKeyPairFromSeed,
  encryptContent,
  generateCek,
  toHex,
  unwrapCek,
  wrapCekFor,
} = await import('../../app/src/lib/crypto.ts');

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

// -----------------------------------------------------------------------------
// Quién es quién
//
// Solo Alpha y Nordwälz tienen cuenta (`dev_accounts.sql`). Las otras cuatro
// organizaciones del guion existen como filas de `organizations` y no tienen
// miembros, así que no hay a quién envolverle una CEK: sus hilos se cifran solo
// para Alpha, que es quien los va a leer en la demo. No es una limitación del
// modelo — es que en el MVP esas cuatro no tienen usuarios.
// -----------------------------------------------------------------------------
const ALPHA_ORG = 'a1000000-0000-4000-8000-000000000001';
const NORDWALZ_ORG = 'b2000000-0000-4000-8000-000000000002';
const ALPHA_MIEMBRO = 'a1000000-0000-4000-8000-00000000000a';
const NORDWALZ_MIEMBRO = 'b2000000-0000-4000-8000-00000000000b';

const MIEMBROS_POR_ORG = {
  [ALPHA_ORG]: [ALPHA_MIEMBRO],
  [NORDWALZ_ORG]: [NORDWALZ_MIEMBRO],
};

const dias = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

// -----------------------------------------------------------------------------
// Los cinco hilos y su único elemento
//
// Los metadatos son EXACTAMENTE los de la siembra anterior —van en claro y son
// lo que MSG-01 pinta en la vista previa—; lo que cambia es que el contenido
// ahora es real y se puede abrir. Cada hilo cubre uno de los cinco estados del
// CHECK de `thread-lifecycle`.
// -----------------------------------------------------------------------------
const HILOS = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    orgAlta: NORDWALZ_ORG,
    estado: 'CON OFERTA PENDIENTE',
    hace: '2 hours',
    comentario: 'Alpha ↔ Nordwälz Lager · el vendedor con quien se negocia en vivo en la demo',
    item: {
      id: '12111111-0000-4000-8000-000000000001',
      senderOrg: NORDWALZ_ORG,
      senderMember: NORDWALZ_MIEMBRO,
      tipo: 'OFERTA',
      partNumber: '6205-2RS',
      brand: 'NSK',
      estadoConsulta: null,
      estadoOferta: 'Pendiente',
      // La línea que el guion llama "la más atractiva": 1250 unidades en 2 días,
      // de Nordwälz (`guion-demo-y-siembra.md`). `shippingCost` va a `null` y no
      // a `0` a propósito: un cero dice "portes gratis" (`offer-card`).
      contenido: {
        kind: 'OFERTA',
        unitPrice: 4.82,
        currency: 'EUR',
        quantity: 1250,
        leadTimeDays: 2,
        shippingCost: null,
        shippingCostCurrency: null,
        validUntil: dias(30),
        notes: 'Precio por unidad para el lote completo. Portes por confirmar.',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    orgAlta: 'c3000000-0000-4000-8000-000000000003',
    estado: 'CON CONSULTA PENDIENTE',
    hace: '5 hours',
    comentario: 'Alpha ↔ Cuscinetti Padana',
    item: {
      id: '12111111-0000-4000-8000-000000000002',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'CONSULTA',
      partNumber: 'NU2210-E-TVP2',
      brand: 'INA',
      estadoConsulta: 'Pendiente',
      estadoOferta: null,
      // `comment` es opcional y de 300 caracteres como mucho (`inquiry-card`).
      contenido: {
        kind: 'CONSULTA',
        quantity: 240,
        comment: '¿Podríais servirlas en dos entregas, mitad ahora y mitad en octubre?',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    orgAlta: 'd4000000-0000-4000-8000-000000000004',
    estado: 'ABIERTO',
    hace: '1 day',
    creadoPor: 'd4000000-0000-4000-8000-000000000004',
    comentario: 'Alpha ↔ Łożyska Wschód',
    item: {
      id: '12111111-0000-4000-8000-000000000003',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'MENSAJE',
      partNumber: null,
      brand: null,
      estadoConsulta: null,
      estadoOferta: null,
      contenido: {
        kind: 'MENSAJE',
        text: 'Buenos días: ¿seguís trabajando la serie NU2200? Preguntamos por volumen recurrente.',
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000004',
    orgAlta: 'e5000000-0000-4000-8000-000000000005',
    estado: 'ACUERDO ALCANZADO',
    hace: '3 days',
    comentario: 'Alpha ↔ Roulements Rhône',
    item: {
      id: '12111111-0000-4000-8000-000000000004',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'OFERTA',
      partNumber: '22316-E',
      brand: 'Timken',
      estadoConsulta: null,
      estadoOferta: 'Aceptada',
      // Esta sí lleva portes informados, para que el panel del día 11 enseñe el
      // contraste con el `null` del hilo 1 — son dos cosas distintas y la
      // pantalla las pinta distinto.
      contenido: {
        kind: 'OFERTA',
        unitPrice: 88.5,
        currency: 'EUR',
        quantity: 60,
        leadTimeDays: 12,
        shippingCost: 145,
        shippingCostCurrency: 'EUR',
        validUntil: dias(-4),
        notes: null,
      },
    },
  },
  {
    id: '11111111-0000-4000-8000-000000000005',
    orgAlta: 'f6000000-0000-4000-8000-000000000006',
    estado: 'CERRADO SIN ACUERDO',
    hace: '7 days',
    comentario: 'Alpha ↔ Anadolu Rulman · el hilo cerrado de D-07-01',
    item: {
      id: '12111111-0000-4000-8000-000000000005',
      senderOrg: ALPHA_ORG,
      senderMember: ALPHA_MIEMBRO,
      tipo: 'MENSAJE',
      partNumber: null,
      brand: null,
      estadoConsulta: null,
      estadoOferta: null,
      contenido: {
        kind: 'MENSAJE',
        text: 'Gracias por la información. De momento lo dejamos aquí; si cambian los plazos, os escribimos.',
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Cifrado
// -----------------------------------------------------------------------------
const claves = new Map();
for (const miembro of [ALPHA_MIEMBRO, NORDWALZ_MIEMBRO]) {
  claves.set(miembro, await deriveKeyPairFromSeed(SEMILLA, miembro));
}

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const filasItem = [];
const filasClave = [];

for (const hilo of HILOS) {
  const destinatarios = [
    ...(MIEMBROS_POR_ORG[ALPHA_ORG] ?? []),
    ...(MIEMBROS_POR_ORG[hilo.orgAlta] ?? []),
  ];

  const cek = await generateCek();
  const { ciphertext, iv } = await encryptContent(hilo.item.contenido, cek);

  filasItem.push(
    `  ('${hilo.item.id}'::uuid, '${hilo.id}'::uuid,\n` +
      `   '${hilo.item.senderOrg}'::uuid, '${hilo.item.senderMember}'::uuid,\n` +
      `   '${hilo.item.tipo}', now() - interval '${hilo.hace}',\n` +
      `   ${q(hilo.item.partNumber)}, ${q(hilo.item.brand)}, ` +
      `${q(hilo.item.estadoConsulta)}, ${q(hilo.item.estadoOferta)},\n` +
      `   decode('${toHex(ciphertext)}', 'hex'), decode('${toHex(iv)}', 'hex'))`,
  );

  for (const miembro of destinatarios) {
    const w = await wrapCekFor(cek, claves.get(miembro).publicKey);
    filasClave.push(
      `  ('${hilo.item.id}'::uuid, '${miembro}'::uuid,\n` +
        `   decode('${toHex(w.wrappedCek)}', 'hex'), decode('${toHex(w.wrapIv)}', 'hex'),\n` +
        `   decode('${toHex(w.ephemeralPublicKey)}', 'hex'))`,
    );

    /**
     * ⚠ SE COMPRUEBA QUE ABRE, Y SE COMPRUEBA CON UN PAR RECIÉN DERIVADO.
     *
     * Descifrar con el mismo objeto `claves` que acaba de cifrar no probaría
     * nada de lo que hace falta: lo que decide D-08-01 no es que la
     * criptografía funcione dentro de este proceso, es que **la semilla vuelva
     * a dar la misma clave en otra sesión, otro día y otro navegador**. Así que
     * se deriva otra vez desde cero y se abre con esa.
     *
     * Si esto falla, el fichero no se escribe. Una siembra que no se puede
     * descifrar es exactamente lo que había ayer, y encima con pinta de
     * arreglada.
     */
    const otraSesion = await deriveKeyPairFromSeed(SEMILLA, miembro);
    const abierta = await unwrapCek(w, otraSesion);
    const leido = await decryptContent(ciphertext, iv, abierta);
    if (JSON.stringify(leido) !== JSON.stringify(hilo.item.contenido)) {
      throw new Error(
        `El contenido de ${hilo.item.id} no se recupera igual para ${miembro}. ` +
          'La siembra no se escribe: seria opaca en la demo.',
      );
    }
  }
}

const filasHilo = HILOS.map(
  (h) =>
    `  -- ${h.comentario}\n` +
    `  ('${h.id}'::uuid,\n` +
    `   '${ALPHA_ORG}'::uuid, '${h.orgAlta}'::uuid,\n` +
    `   '${h.creadoPor ?? ALPHA_ORG}'::uuid, '${h.estado}', now() - interval '${h.hace}')`,
).join(',\n');

const filasPublica = [ALPHA_MIEMBRO, NORDWALZ_MIEMBRO]
  .map(
    (m) =>
      `update public.members set public_key = decode('${toHex(claves.get(m).publicKey)}', 'hex')\n` +
      ` where id = '${m}';`,
  )
  .join('\n\n');

const sql = `\\encoding UTF8
-- ---------------------------------------------------------------------------
-- Siembra de hilos de demo · MSG-01 · Lista de Hilos · MSG-02 · Vista de un Hilo
--
-- ⚠ FICHERO GENERADO. No se edita a mano: se regenera con
--
--     VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs
--
-- porque el contenido va CIFRADO y a mano no se puede escribir. Los metadatos
-- (tipo, referencia, marca, estados, fechas) sí se leen aquí: van en claro en
-- \`thread_items\` desde 0003 y son lo que MSG-01 pinta en la vista previa.
--
-- ── QUÉ CAMBIÓ EL DÍA 8 (D-08-01, opción (a)) ──────────────────────────────
--
-- Hasta ayer esta siembra decía *"EL CONTENIDO CIFRADO ES RELLENO A PROPÓSITO"*
-- y llevaba \`decode('a1b2c3d4e5f6','hex')\` en los cinco elementos. Daba igual
-- mientras MSG-01 nunca descifrara. Con la rebanada E2EE dejó de dar igual: los
-- cinco hilos de la demo habrían enseñado \`Contenido cifrado — introduce tu
-- frase de seguridad para ver\` en cada elemento, el día 11, delante del socio.
--
-- Ahora el contenido es real y se abre con las claves deterministas de la demo.
-- **El servidor sigue sin poder leerlo**: lo único que se relaja es de dónde
-- sale la clave, no quién puede descifrar. Quien tenga la semilla tiene todas
-- las privadas de la demo — vale para datos inventados y para nada más, NO es
-- ADR-001 y no debe existir en V1.
--
-- Cinco hilos de Rodamientos Ibéricos (Alpha), uno por cada estado del CHECK de
-- \`thread-lifecycle\`. El orden canónico del par (\`org_low_id < org_high_id\`) lo
-- impone la base; Alpha es el UUID más bajo de las seis, así que va siempre de
-- \`org_low_id\`.
-- ---------------------------------------------------------------------------

\\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1 · Las claves públicas de las dos cuentas
--
-- Sin esto, la contraparte no tiene con qué envolver una CEK y no puede
-- escribirle a nadie: el envío de MSG-02 se niega y dice de quién falta la
-- clave (0012 §3). La app las vuelve a publicar en cada arranque de sesión
-- (\`keys.ts\`); aquí se ponen para que la siembra de abajo se pueda abrir desde
-- el primer minuto, sin depender de que alguien haya entrado antes.
-- ---------------------------------------------------------------------------
${filasPublica}

-- ---------------------------------------------------------------------------
-- 2 · Los cinco hilos
-- ---------------------------------------------------------------------------
insert into public.threads (id, org_low_id, org_high_id, created_by_org_id, state, last_item_at)
values
${filasHilo}
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3 · El elemento de cada hilo, con contenido cifrado de verdad
--
-- ⚠ SE BORRA ANTES DE INSERTAR, y el borrado está acotado a estos cinco hilos.
-- No es un capricho: las instalaciones que ya corrieron la siembra anterior
-- tienen los elementos de relleno con ids aleatorios, así que un
-- \`on conflict (id)\` no los alcanzaría y quedarían los dos juegos — el viejo
-- opaco y el nuevo legible, en el mismo historial. Las filas de
-- \`thread_item_keys\` se van solas por \`on delete cascade\` (0003:270).
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
${filasItem.join(',\n')};

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
${filasClave.join(',\n')}
on conflict (item_id, recipient_member_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5 · Devolver el hilo de Anadolu a CERRADO SIN ACUERDO
--
-- ⚠ ESTO NO ES REDUNDANTE Y CUESTA UN ESTADO DE LA DEMO SI SE QUITA.
--
-- El \`insert\` de arriba dispara \`app.sync_thread_state\`, y desde 0009 **un
-- elemento nuevo reabre un hilo cerrado** (D-07-01, F-045): el hilo 5 saldría
-- de aquí en ABIERTO, y MSG-01 dejaría de tener sus cinco estados — que es la
-- razón entera por la que hay cinco hilos y no uno.
--
-- El \`update\` pasa porque la siembra corre como \`postgres\`, y
-- \`app.guard_thread_state\` (0007:241) exime a \`service_role\` y \`postgres\`. Desde
-- el cliente esto no se podría hacer, y así debe ser.
-- ---------------------------------------------------------------------------
update public.threads set state = 'CERRADO SIN ACUERDO'
 where id = '11111111-0000-4000-8000-000000000005';
`;

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, 'demo_threads.sql');
writeFileSync(destino, sql, 'utf8');

// Se imprimen las PÚBLICAS y nada más. Ninguna privada ni la semilla salen por
// aquí: ADR-001 §8, "ni en payloads, ni en logs, ni en mensajes de error".
console.log(`Escrito ${destino}`);
console.log(`  ${HILOS.length} hilos · ${filasItem.length} elementos · ${filasClave.length} claves envueltas`);
for (const [miembro, par] of claves) {
  console.log(`  pública de ${miembro}: ${toHex(par.publicKey)}`);
}
