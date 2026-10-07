/**
 * accept-invitation · INVT-02
 * =============================================================================
 *
 * El invitado llega con el enlace que su administrador le pasó
 * (`#invitacion?token=…`, `0050`) y crea su cuenta de EDITOR. Como `register-organization`
 * atiende a quien no tiene sesión, así que se despliega sin verificación de JWT y **el
 * único permiso es el token**. Las funciones de la base que toca son de `service_role`
 * (`anon` no ejecuta nada de `public`, F-146).
 *
 * Dos acciones, por el cuerpo:
 *
 *   `{ action: 'validate', token }`
 *     404 si el token no vale (no existe, usado, anulado: **un solo mensaje**, no se
 *     dice cuál). Con un token que sí existe devuelve `status`: `OK`, `EXPIRED`,
 *     `EXISTS` (el correo ya tiene cuenta) o `FULL` (la organización está completa),
 *     más los datos del bloque de la pantalla. Adivinar el token son 244 bits.
 *
 *   `{ action: 'accept', token, full_name, password }`
 *     1. Valida el token y exige `status = OK`. 2. Valida nombre y contraseña con los
 *     mismos criterios que FRU. 3. Crea la cuenta de Auth con **el correo de la
 *     invitación** (el cliente no manda correo: no hay a quién suplantar), ya
 *     confirmada: el enlace lo entregó el ADMIN a esa persona, así que el token es la
 *     prueba del correo (no hay proveedor de correo, F-212). 4. `redeem_invitation`
 *     crea la fila de `members` y canjea el token en una transacción. **Si eso falla se
 *     borra la cuenta de Auth recién creada** y el token sigue valiendo.
 *
 * La contraseña no se registra ni se devuelve.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOKEN = /^[0-9a-f]{64}$/;
const NO_VALE = 'El enlace no es válido.';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Mismo criterio que `passwordProblems` de `app/src/lib/onboarding.ts`. */
function passwordOk(p: string): boolean {
  return (
    p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)
  );
}

type Validated = {
  status: 'OK' | 'EXPIRED' | 'EXISTS' | 'FULL';
  org_name: string;
  inviter_name: string | null;
  email: string;
  expires_at: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'La función no tiene su configuración.' });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object') throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Cuerpo no válido.' });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = text(body.token);
  if (!TOKEN.test(token)) return json(404, { error: NO_VALE });

  const { data, error: validateError } = await db.rpc('invitation_link_validate', { p_token: token });
  if (validateError) return json(500, { error: 'No se pudo comprobar el enlace.' });
  const invitation = (data as Validated[] | null)?.[0];
  if (!invitation) return json(404, { error: NO_VALE });

  if (body.action === 'validate') {
    return json(200, { invitation });
  }

  if (body.action !== 'accept') return json(400, { error: 'Acción no válida.' });

  if (invitation.status !== 'OK') return json(409, { status: invitation.status });

  const fullName = text(body.full_name);
  const password = typeof body.password === 'string' ? body.password : '';
  if (fullName.length < 2 || fullName.length > 100) {
    return json(400, { error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }
  if (!passwordOk(password)) {
    return json(400, {
      error: 'La contraseña necesita 10 caracteres, mayúscula, minúscula, número y símbolo.',
    });
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const already = /already|registered|exists/i.test(createError?.message ?? '');
    return already ? json(409, { status: 'EXISTS' }) : json(500, { error: 'No se pudo crear la cuenta.' });
  }

  const { error: rowError } = await db.rpc('redeem_invitation', {
    p_token: token,
    p_user_id: created.user.id,
    p_full_name: fullName,
  });
  if (rowError) {
    await db.auth.admin.deleteUser(created.user.id);
    const message = rowError.message ?? '';
    if (/ya tiene cuenta/i.test(message)) return json(409, { status: 'EXISTS' });
    if (/l[ií]mite de 5/i.test(message)) return json(409, { status: 'FULL' });
    if (/enlace no es valido/i.test(message)) return json(404, { error: NO_VALE });
    if (/^Datos no validos/i.test(message)) {
      return json(400, { error: message.replace(/^Datos no validos:\s*/i, '') });
    }
    return json(500, { error: 'No se pudo completar el alta.' });
  }

  return json(200, { accepted: true, email: invitation.email });
});
