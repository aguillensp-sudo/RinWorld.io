-- =============================================================================
-- 0061 · INV-04 fase 2: lo que la función de borde `ingest-email` necesita de la base
-- =============================================================================
-- Dos funciones, las dos SOLO de `service_role`:
--
--   · `ingest_resolve(p_token)`  de la dirección `ingest-<token>@…` a la organización, sus
--     remitentes autorizados y sus perfiles de mapeo, en UNA llamada. La función de borde no
--     lee las tablas una a una: una sola ida y vuelta, y la regla «vigente y organización
--     aprobada» vive aquí, no repartida entre la base y TypeScript.
--   · `import_inventory_for_org(p_org, p_lines)`  la importación de `import_inventory`
--     (0046) sin sesión de usuario. **Solo ACUMULATIVO** (decisión 3 del plan): un correo,
--     erróneo o falsificado, no puede pasar a `DELETED` el inventario publicado. Tampoco
--     guarda perfiles: un correo no tiene a nadie delante para nombrarlos.
--
-- Por qué una copia del cuerpo de `import_inventory` y no una refactorización: aquella
-- función lleva `auth.uid()` en su primera línea y la tocan dos pantallas en producción;
-- reescribirla para compartir tres sentencias es más riesgo que la duplicación. Si una de
-- las dos cambia, el banco de esquema compara lo que hacen sobre las mismas líneas.
--
-- ⚠ `revoke … from public, anon, authenticated` explícito (F-146): Supabase concede por
-- defecto a `anon` y `authenticated` la ejecución de lo que se crea en `public`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Resolver una dirección
-- -----------------------------------------------------------------------------
create or replace function public.ingest_resolve(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_addr uuid;
  v_org  uuid;
  v_country text;
begin
  if p_token is null or p_token !~ '^[a-km-np-z2-9]{12}$' then
    return null;
  end if;

  select a.id, a.org_id, o.country into v_addr, v_org, v_country
    from public.ingest_addresses a
    join public.organizations o on o.id = a.org_id
   where a.token = p_token
     and a.revoked_at is null
     and o.status = 'APPROVED';
  if v_addr is null then
    return null;
  end if;

  return jsonb_build_object(
    'address_id', v_addr,
    'org_id',     v_org,
    'org_country', v_country,
    'senders',    coalesce((select jsonb_agg(s.email order by s.email)
                              from public.ingest_senders s where s.org_id = v_org), '[]'::jsonb),
    'profiles',   coalesce((select jsonb_agg(jsonb_build_object(
                                     'header_signature', p.header_signature,
                                     'mapping',          p.mapping))
                              from public.inventory_import_profiles p where p.org_id = v_org), '[]'::jsonb)
  );
end;
$$;

comment on function public.ingest_resolve(text) is
  'INV-04: dirección de ingestión → organización, remitentes y perfiles. Null si no existe, está rotada o la organización no está APPROVED. Solo service_role.';

-- -----------------------------------------------------------------------------
-- 2 · Importar sin sesión (solo acumulativo)
-- -----------------------------------------------------------------------------
create or replace function public.import_inventory_for_org(p_org uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n         integer;
  v_bad       integer;
  v_updated   integer;
  v_inserted  integer;
begin
  if p_org is null or not exists (
       select 1 from public.organizations o where o.id = p_org and o.status = 'APPROVED') then
    raise exception 'La organización no existe o no está aprobada.' using errcode = '42501';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Las líneas deben llegar como una lista.' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_lines);
  if v_n < 1 or v_n > 20000 then
    raise exception 'Un lote lleva entre 1 y 20000 líneas; han llegado %.', v_n using errcode = '22023';
  end if;

  create temp table _incoming on commit drop as
  select btrim(x.part_number)                     as part_number,
         btrim(x.brand)                           as brand,
         x.quantity                               as quantity,
         upper(btrim(x.location_country))         as location_country,
         nullif(btrim(coalesce(x.product_family, '')), '') as product_family,
         x.lead_time_days                         as lead_time_days,
         nullif(btrim(coalesce(x.notes, '')), '') as notes
    from jsonb_to_recordset(p_lines) as x(
           part_number text, brand text, quantity integer, location_country text,
           product_family text, lead_time_days integer, notes text);

  -- El que llama es una función de borde que recibe datos de Internet: se valida igual que
  -- en `import_inventory`, sin fiarse de que la función ya lo haya hecho.
  select count(*) into v_bad
    from _incoming
   where coalesce(part_number, '') = '' or char_length(part_number) > 64
      or coalesce(brand, '') = ''       or char_length(brand) > 64
      or quantity is null or quantity < 0
      or location_country is null or location_country !~ '^[A-Z]{2}$'
      or (product_family is not null and char_length(product_family) > 80)
      or (lead_time_days is not null and (lead_time_days < 0 or lead_time_days > 3650))
      or (notes is not null and char_length(notes) > 500);
  if v_bad > 0 then
    raise exception '% líneas del lote no son válidas.', v_bad using errcode = '22023';
  end if;

  select v_n - count(*) into v_bad
    from (select distinct upper(part_number), upper(brand), location_country from _incoming) d;
  if v_bad > 0 then
    raise exception 'El lote trae % líneas repetidas (misma referencia, marca y país).', v_bad
      using errcode = '22023';
  end if;

  update public.inventory_lines l
     set quantity       = i.quantity,
         product_family = coalesce(i.product_family, l.product_family),
         lead_time_days = i.lead_time_days,
         notes          = i.notes,
         status         = 'PUBLISHED',
         last_upload_at = now()
    from _incoming i
   where l.org_id = p_org
     and l.status <> 'DELETED'
     and upper(l.part_number) = upper(i.part_number)
     and upper(l.brand) = upper(i.brand)
     and l.location_country = i.location_country;
  get diagnostics v_updated = row_count;

  insert into public.inventory_lines
         (org_id, part_number, brand, quantity, location_country, product_family,
          lead_time_days, notes, status, last_upload_at)
  select p_org, i.part_number, i.brand, i.quantity, i.location_country, i.product_family,
         i.lead_time_days, i.notes, 'PUBLISHED', now()
    from _incoming i
   where not exists (
           select 1 from public.inventory_lines l
            where l.org_id = p_org
              and l.status <> 'DELETED'
              and upper(l.part_number) = upper(i.part_number)
              and upper(l.brand) = upper(i.brand)
              and l.location_country = i.location_country);
  get diagnostics v_inserted = row_count;

  drop table _incoming;

  return jsonb_build_object('published', v_n, 'removed', null, 'inserted', v_inserted, 'updated', v_updated);
end;
$$;

comment on function public.import_inventory_for_org(uuid, jsonb) is
  'INV-04: importación acumulativa sin sesión de usuario, para la función ingest-email. Nunca pasa líneas a DELETED. Solo service_role.';

-- -----------------------------------------------------------------------------
-- 3 · Privilegios
-- -----------------------------------------------------------------------------
revoke all on function public.ingest_resolve(text)                from public, anon, authenticated;
revoke all on function public.import_inventory_for_org(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.ingest_resolve(text)                to service_role;
grant  execute on function public.import_inventory_for_org(uuid, jsonb) to service_role;
