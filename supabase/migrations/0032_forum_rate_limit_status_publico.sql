-- =============================================================================
-- 0032 · Foro: RPC pública del estado de RNG-FORO-06
-- =============================================================================
--
-- `app.forum_rate_limit_status()` (0031) vive en el esquema `app`, que es el
-- de funciones INTERNAS (CLAUDE.md §10.3: "app es el esquema de funciones").
-- PostgREST no expone ese esquema, así que ninguna pantalla puede llamarlo con
-- `supabase.rpc()` -- exactamente lo que le pasa a `app.current_org_id()` o
-- `app.is_active_member()`, que nunca los llama el cliente directamente. Se
-- descubrió leyendo cómo llama el cliente hoy (`app/src/lib/keys.ts`,
-- `thread-detail.ts`): las cuatro RPC que sí usa (`thread_public_keys`,
-- `org_public_keys`, `create_thread_item`, `counter_offer`, `create_inquiry`)
-- viven TODAS en `public`, nunca en `app`.
--
-- Este es el envoltorio público, sin lógica propia: delega en la función de
-- 0031, que hace el trabajo real y ya está en la lista auditada de F-155.
-- Como este envoltorio no nombra ninguna tabla en su cuerpo -solo llama a otra
-- función-, el detector de F-155 no lo marca y no hace falta tocar su lista.
-- =============================================================================

create or replace function public.forum_rate_limit_status()
returns table (used integer, "limit" integer, seconds_until_reset integer)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select * from app.forum_rate_limit_status();
$$;

comment on function public.forum_rate_limit_status() is
  'RNG-FORO-06: envoltorio publico de app.forum_rate_limit_status() para que el cliente lo llame con supabase.rpc(). Sin logica propia. anon sin EXECUTE por la default privilege de 0022 (revoke execute on functions from anon, para toda funcion nueva de postgres en public).';
