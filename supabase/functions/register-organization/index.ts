/**
 * register-organization · REG-01 (FRO)
 * =============================================================================
 *
 * El solicitante aprobado llega con el enlace que el Operador le envió
 * (`#registro?token=…`, `0040`) y da de alta su organización y su cuenta de
 * administrador. **Es la segunda función de este proyecto que atiende a quien no
 * tiene sesión** (la primera es `access-request`), así que se despliega sin
 * verificación de JWT y no se fía de nada de lo que le llega: **el único permiso
 * es el token**. Sin un token válido no obtiene nada, ni siquiera un «no».
 *
 * Por qué una función y no un `GRANT` a `anon`: crear la cuenta de Auth es la API
 * de administración (service key, que solo vive aquí), y `anon` no ejecuta nada de
 * `public` (F-146). Las funciones de la base que toca son de `service_role`.
 *
 * Tres acciones, por el cuerpo:
 *
 *   `{ action: 'validate', token }`
 *     Devuelve los datos del FSR para pre-rellenar el formulario, o 404 si el
 *     token no vale. **Nunca dice por qué** (no existe, caducado, canjeado,
 *     revocado): quien adivina tokens no aprende nada de la respuesta.
 *
 *   `{ action: 'check_email', token, email }`
 *     La comprobación «en tiempo real» de la spec: `{ available }`. **Exige un
 *     token válido**: sin él no hay oráculo de «este email tiene cuenta». Solo
 *     mira `members` (la comprobación definitiva es la del alta).
 *
 *   `{ action: 'register', token, … }`
 *     1. Valida el token (404). 2. Repite lo esencial de la validación (los
 *     criterios completos están en la base, que es la que decide). 3. Crea la
 *     cuenta de Auth ya confirmada: el enlace lo envió el Operador a ese
 *     solicitante, así que el token es la prueba del email (no hay proveedor de
 *     correo, F-212). 4. Llama a `register_organization` (`0041`), que canjea el
 *     token y crea organización, NIF y ADMIN en una transacción. **Si eso falla se
 *     borra la cuenta de Auth recién creada** —sin fila en `members` sería una
 *     cuenta huérfana que ocupa el email— y el token sigue valiendo.
 *
 * Sin freno de ritmo propio: lo que cuesta caro (crear cuentas) exige un token
 * válido de un solo uso, y adivinarlo son 244 bits. La contraseña y el resto de lo
 * que llega no se registran en ningún log ni se devuelven.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN = /^[0-9a-f]{64}$/;
const NO_VALE = 'El enlace no es válido o ha caducado.';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
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

  // Todas las acciones empiezan por el token. La forma se comprueba antes de ir a
  // la base: 64 hexadecimales, ni una cosa más.
  const token = text(body.token);
  if (!TOKEN.test(token)) return json(404, { error: NO_VALE });

  const { data: fsr, error: fsrError } = await db.rpc('registration_link_validate', { p_token: token });
  if (fsrError) return json(500, { error: 'No se pudo comprobar el enlace.' });
  const prefill = (fsr as Record<string, unknown>[] | null)?.[0];
  if (!prefill) return json(404, { error: NO_VALE });

  if (body.action === 'validate') {
    return json(200, { prefill });
  }

  if (body.action === 'check_email') {
    const email = text(body.email).toLowerCase();
    if (!EMAIL.test(email)) return json(400, { error: 'El email no es válido.' });
    const { data: taken, error: takenError } = await db
      .from('members')
      .select('id')
      .eq('email', email)
      .limit(1);
    if (takenError) return json(500, { error: 'No se pudo comprobar el email.' });
    return json(200, { available: !(taken && taken.length > 0) });
  }

  if (body.action !== 'register') return json(400, { error: 'Acción no válida.' });

  const adminEmail = text(body.admin_email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL.test(adminEmail)) return json(400, { error: 'El email del administrador no es válido.' });
  if (!passwordOk(password)) {
    return json(400, {
      error: 'La contraseña necesita 10 caracteres, mayúscula, minúscula, número y símbolo.',
    });
  }

  // La cuenta de Auth, ya confirmada. Antes de la base porque la base necesita su id.
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const already = /already|registered|exists/i.test(createError?.message ?? '');
    return already
      ? json(409, { error: 'Este email ya tiene cuenta en Bearingworld.io.' })
      : json(500, { error: 'No se pudo crear la cuenta.' });
  }

  const { error: rowError } = await db.rpc('register_organization', {
    p_token: token,
    p_user_id: created.user.id,
    p_admin_email: adminEmail,
    p_admin_name: text(body.admin_full_name),
    p_legal_name: text(body.legal_name),
    p_tax_id: text(body.tax_id),
    p_address: text(body.address),
    p_postal_code: text(body.postal_code),
    p_country: text(body.country),
    p_contact_email: text(body.contact_email),
    p_contact_phone: text(body.contact_phone),
    p_website: text(body.website),
    p_operating_countries: list(body.operating_countries),
    p_brands: list(body.brands),
    p_inventory_visibility: text(body.inventory_visibility),
  });

  if (rowError) {
    // Nada de lo de arriba se queda a medias: la transacción de la base ya deshizo el
    // alta y el canje del token; falta la cuenta de Auth, que es de otro sistema.
    await db.auth.admin.deleteUser(created.user.id);
    const message = rowError.message ?? '';
    if (/ya tiene cuenta/i.test(message)) {
      return json(409, { error: 'Este email ya tiene cuenta en Bearingworld.io.' });
    }
    if (/enlace no es valido/i.test(message)) return json(404, { error: NO_VALE });
    if (/^Datos no validos/i.test(message)) {
      return json(400, { error: message.replace(/^Datos no validos:\s*/i, '') });
    }
    return json(500, { error: 'No se pudo dar de alta la organización.' });
  }

  return json(200, { registered: true });
});
