/**
 * register-additional-member · FRU
 * =============================================================================
 *
 * El ADMIN registra a un usuario adicional de su organización (FRU, «desde
 * REG-09»): nombre, email y contraseña. Crear una cuenta de Auth es cosa de la API
 * de administración, y por eso es una función de borde con la service key, que solo
 * vive aquí y nunca en el navegador (CLAUDE.md §1.1). Y por eso mismo **no se fía de
 * lo que le manda el cliente**: valida el JWT, lee de `members` quién es quien
 * llama, y repite en servidor todas las reglas del formulario.
 *
 * Qué hace, en este orden:
 *   1. Autentica al que llama (JWT contra Auth) y comprueba en `members` que es
 *      ADMIN en `KEY_ACTIVE` o `ACTIVE`. **La organización sale de ahí**: el
 *      cuerpo no lleva `org_id`, así que no hay nadie a quien suplantar.
 *   2. Valida nombre (2 a 100), email (formato) y contraseña (10+, mayúscula,
 *      minúscula, número y símbolo), con los mismos criterios que la pantalla.
 *   3. Crea la cuenta de Auth ya confirmada (no hay proveedor de correo: el ADMIN
 *      entrega las credenciales, mismo criterio que INVT-01, F-212).
 *   4. Escribe la fila de `members` con `add_registered_member` (0038), que aplica
 *      el límite de 5 y deja al usuario como EDITOR `REGISTERED`. **Si eso falla se
 *      borra la cuenta de Auth recién creada**: sin fila de `members` sería una
 *      cuenta huérfana que nadie ve y que ocupa el email.
 *
 * La contraseña no se registra en ningún log ni se devuelve.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Mismo criterio que `passwordProblems` de `app/src/lib/onboarding.ts`. */
function passwordOk(p: string): boolean {
  return (
    p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)
  );
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

  let body: { full_name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Cuerpo no válido.' });
  }
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (fullName.length < 2 || fullName.length > 100) {
    return json(400, { error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }
  if (!EMAIL.test(email)) return json(400, { error: 'El email no es válido.' });
  if (!passwordOk(password)) {
    return json(400, {
      error: 'La contraseña necesita 10 caracteres, mayúscula, minúscula, número y símbolo.',
    });
  }

  // 1 · ¿quién llama? El JWT se valida contra Auth, no se decodifica a mano.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json(401, { error: 'Sesión no válida.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: caller, error: readError } = await admin
    .from('members')
    .select('org_id, role, state')
    .eq('id', who.user.id)
    .maybeSingle();
  if (readError) return json(500, { error: 'No se pudo leer al miembro.' });
  if (!caller || caller.role !== 'ADMIN' || !['KEY_ACTIVE', 'ACTIVE'].includes(caller.state)) {
    return json(403, { error: 'Solo el administrador de la organización puede registrar usuarios.' });
  }

  // 2 · el email no puede tener ya cuenta en ninguna organización.
  const { data: taken, error: takenError } = await admin
    .from('members')
    .select('id')
    .ilike('email', email)
    .limit(1);
  if (takenError) return json(500, { error: 'No se pudo comprobar el email.' });
  if (taken && taken.length > 0) {
    return json(409, { error: 'Este email ya tiene cuenta en Bearingworld.io.' });
  }

  // 3 · la cuenta de Auth.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const already = /already|registered|exists/i.test(createError?.message ?? '');
    return already
      ? json(409, { error: 'Este email ya tiene cuenta en Bearingworld.io.' })
      : json(500, { error: 'No se pudo crear la cuenta.' });
  }

  // 4 · la fila de `members`. Si falla, la cuenta de Auth no se queda huérfana.
  const { error: rowError } = await admin.rpc('add_registered_member', {
    p_id: created.user.id,
    p_org: caller.org_id,
    p_email: email,
    p_full_name: fullName,
  });
  if (rowError) {
    await admin.auth.admin.deleteUser(created.user.id);
    const limit = /límite|limite/i.test(rowError.message);
    return limit
      ? json(409, { error: 'Tu organización ha alcanzado el límite de 5 usuarios.' })
      : json(500, { error: 'No se pudo registrar al usuario.' });
  }

  return json(200, { registered: true });
});
