/**
 * access-request · REG-00 (FSR) y REG-00-WAIT
 * =============================================================================
 *
 * La Ruta 00.2: alguien que no tiene cuenta ni invitación pide acceso. **Es la
 * única función de este proyecto que atiende a quien no tiene sesión**, y por eso
 * se despliega sin verificación de JWT (`supabase/config.toml` y el paso de CI) y
 * no se fía de nada de lo que le llega.
 *
 * Por qué una función y no un `GRANT` a `anon`: `registration_requests` (`0028`)
 * solo admite `INSERT` de `service_role`, a propósito. Abrir la tabla a `anon`
 * dejaría la validación y el límite de abuso en manos de una política de RLS, y
 * la lectura del estado de una solicitud no se puede expresar en RLS sin sesión
 * (no hay `auth.uid()` que comparar). Aquí la service key vive en el servidor y
 * **a `anon` no se le concede nada** en la base (`F-192` sigue igual).
 *
 * Dos acciones, por el cuerpo:
 *
 *   `{ action: 'submit', email, full_name, org_name, country, phone, website }`
 *     Repite en servidor la validación de la pantalla (`lib/access-request.ts`).
 *     Dos frenos de abuso, los dos contados en la propia tabla:
 *       · una solicitud `PENDING_REVIEW` por email (409);
 *       · como mucho `MAX_PER_HOUR` solicitudes nuevas por hora en total (429):
 *         un formulario público sin captcha tiene que tener un techo, y la cola
 *         la revisa una persona.
 *     Devuelve `{ id, submitted_at }`. **El `id` es el token de seguimiento**:
 *     un uuid aleatorio que solo tiene quien envió la solicitud.
 *
 *   `{ action: 'status', id }`
 *     Devuelve `{ state, rejection_reason }` y nada más: ni el email ni el
 *     nombre. Quien tiene el token ya tiene sus datos (los escribió él); lo que
 *     no tiene es la decisión del Operador.
 *
 * Nada de lo que llega se registra en ningún log.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Mismo patrón que el `CHECK` de `0028` (`registration_requests_email_chk`). */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COUNTRY = /^[A-Z]{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 20;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Mismas reglas que `isFieldValid` de `app/src/lib/access-request.ts`. */
function problem(f: {
  email: string;
  fullName: string;
  orgName: string;
  country: string;
  phone: string;
  website: string;
}): string | null {
  if (!EMAIL.test(f.email) || f.email.length > 254) return 'El email no es válido.';
  if (f.fullName.length < 2 || f.fullName.length > 120) {
    return 'El nombre debe tener entre 2 y 120 caracteres.';
  }
  if (f.orgName.length < 2 || f.orgName.length > 120) {
    return 'El nombre de la organización debe tener entre 2 y 120 caracteres.';
  }
  if (!COUNTRY.test(f.country)) return 'El país no es válido.';
  if (f.phone.length < 1 || f.phone.length > 30) return 'Falta el teléfono de contacto.';
  if (!f.website.startsWith('https://') || f.website.length > 200) {
    return 'La URL debe comenzar por https://';
  }
  return null;
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

  if (body.action === 'status') {
    const id = text(body.id);
    if (!UUID.test(id)) return json(400, { error: 'Solicitud no válida.' });
    const { data, error } = await db
      .from('registration_requests')
      .select('state, rejection_reason')
      .eq('id', id)
      .maybeSingle();
    if (error) return json(500, { error: 'No se pudo consultar la solicitud.' });
    if (!data) return json(404, { error: 'La solicitud no existe.' });
    return json(200, { state: data.state, rejection_reason: data.rejection_reason });
  }

  if (body.action !== 'submit') return json(400, { error: 'Acción no válida.' });

  const form = {
    email: text(body.email).toLowerCase(),
    fullName: text(body.full_name),
    orgName: text(body.org_name),
    country: text(body.country).toUpperCase(),
    phone: text(body.phone),
    website: text(body.website),
  };
  const invalid = problem(form);
  if (invalid) return json(400, { error: invalid });

  // Freno 1 · una solicitud pendiente por email.
  const { data: pending, error: pendingError } = await db
    .from('registration_requests')
    .select('id')
    .eq('state', 'PENDING_REVIEW')
    // `eq` y no `ilike`: un `%` o un `_` del email harían de comodín. Se guarda
    // siempre en minúsculas, así que la comparación exacta basta.
    .eq('applicant_email', form.email)
    .limit(1);
  if (pendingError) return json(500, { error: 'No se pudo comprobar la solicitud.' });
  if (pending && pending.length > 0) {
    return json(409, { error: 'Ya hay una solicitud en revisión con este email.' });
  }

  // Freno 2 · un techo por hora para toda la cola.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await db
    .from('registration_requests')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', since);
  if (countError) return json(500, { error: 'No se pudo comprobar la solicitud.' });
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return json(429, { error: 'Hay demasiadas solicitudes ahora mismo. Inténtalo más tarde.' });
  }

  const { data: created, error: insertError } = await db
    .from('registration_requests')
    .insert({
      applicant_email: form.email,
      applicant_full_name: form.fullName,
      org_name: form.orgName,
      country: form.country,
      applicant_phone: form.phone,
      website: form.website,
    })
    .select('id, submitted_at')
    .single();
  if (insertError || !created) return json(500, { error: 'No se pudo enviar la solicitud.' });

  return json(200, { id: created.id, submitted_at: created.submitted_at });
});
