-- =============================================================================
-- 0004 · Correcciones del linter de seguridad de Supabase
-- =============================================================================
-- `get_advisors` marcó tres avisos tras aplicar 0001–0003 en el proyecto remoto:
--
--   · function_search_path_mutable · app.touch_updated_at
--   · function_search_path_mutable · app.guard_offer_terminal_state
--   · extension_in_public          · pg_trgm
--
-- 0001–0003 ya están corregidas en origen, así que en una base nueva esta
-- migración no cambia nada: es idempotente. Existe para las bases donde 0001–0003
-- ya se habían aplicado, que es el caso del proyecto remoto.
--
-- Queda un cuarto aviso que NO se toca desde aquí porque es configuración del
-- proyecto y no del esquema: `auth_leaked_password_protection` (comprobación
-- contra HaveIBeenPwned, desactivada). Decisión del PO.
-- =============================================================================

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    -- Los índices existentes siguen funcionando: referencian el opclass por OID,
    -- no por nombre cualificado.
    alter extension pg_trgm set schema extensions;
  end if;
end
$$;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.guard_offer_terminal_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.item_type = 'OFERTA'
     and old.estado_oferta in ('Aceptada','Rechazada','Superada por contraoferta')
     and new.estado_oferta is distinct from old.estado_oferta then
    raise exception
      'estado_oferta "%" es terminal (offer-card). Una contraoferta es una fila nueva, no un cambio de estado de esta.',
      old.estado_oferta;
  end if;
  return new;
end;
$$;
