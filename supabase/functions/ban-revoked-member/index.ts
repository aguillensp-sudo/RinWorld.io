/**
 * ban-revoked-member · F-214
 * =============================================================================
 *
 * `user-revocation` pide que el usuario revocado *«pierda inmediatamente la
 * capacidad de iniciar sesión»*. `remove_member` (0037) deja `members.state =
 * 'CANCELLED'`, y con eso la RLS le quita los datos y `session.ts` le cierra la
 * sesión; pero la cuenta de Auth seguía pudiendo autenticarse. Esto cierra esa
 * mitad: pone `banned_until` en `auth.users`, que desde SQL depende de un permiso
 * sobre el esquema `auth` y aquí se hace con la API de administración.
 *
 * ── POR QUÉ ES UNA FUNCIÓN Y NO UN TRIGGER ─────────────────────────────────
 * Necesita la service key, que solo vive en el entorno de la función y nunca en
 * el navegador (CLAUDE.md §1.1). Y ese es el motivo de las comprobaciones de
 * abajo: la función corre con poderes de administrador, así que **no se fía de lo
 * que le pide el cliente**. Lo único que recibe es un `member_id`; todo lo demás
 * se lee de la base.
 *
 * Condiciones, todas obligatorias, todas leídas de `members`:
 *   1. El que llama está autenticado (JWT válido).
 *   2. Es ADMIN y está ACTIVE, en la misma organización que el objetivo.
 *   3. El objetivo ya está `CANCELLED`: se revoca primero con `remove_member`,
 *      que es quien valida el resto de reglas, y solo entonces se bloquea el
 *      login. Esta función no puede revocar a nadie por sí sola.
 *   4. El objetivo no es el que llama, y es EDITOR (a un ADMIN no se le elimina).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** ~100 años: `auth` no admite «para siempre», y esto es equivalente. */
const BAN_DURATION = '876000h';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'Falta la sesión.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json(500, { error: 'La función no tiene su configuración.' });
  }

  let memberId: unknown;
  try {
    ({ member_id: memberId } = await req.json());
  } catch {
    return json(400, { error: 'Cuerpo no válido.' });
  }
  if (typeof memberId !== 'string' || !UUID.test(memberId)) {
    return json(400, { error: 'member_id no válido.' });
  }

  // 1 · ¿quién llama? Se valida el JWT contra Auth, no se decodifica a mano.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json(401, { error: 'Sesión no válida.' });
  const callerId = who.user.id;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error: readError } = await admin
    .from('members')
    .select('id, org_id, role, state')
    .in('id', [callerId, memberId]);
  if (readError) return json(500, { error: 'No se pudo leer a los miembros.' });

  const caller = rows?.find((m) => m.id === callerId);
  const target = rows?.find((m) => m.id === memberId);

  // Mismo mensaje para «no existe» y «no es tuyo»: no se confirma a otra
  // organización qué ids existen.
  if (!caller || !target || caller.org_id !== target.org_id) {
    return json(403, { error: 'No permitido.' });
  }
  if (caller.role !== 'ADMIN' || caller.state !== 'ACTIVE') {
    return json(403, { error: 'Solo un administrador activo puede hacerlo.' });
  }
  if (target.id === caller.id || target.role !== 'EDITOR') {
    return json(403, { error: 'No permitido.' });
  }
  if (target.state !== 'CANCELLED') {
    return json(409, { error: 'El usuario no está revocado: elimínalo primero.' });
  }

  const { error: banError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: BAN_DURATION,
  });
  if (banError) return json(500, { error: 'No se pudo bloquear el inicio de sesión.' });

  return json(200, { banned: true });
});
