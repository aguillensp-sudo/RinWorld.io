-- =============================================================================
-- 0046 · import_inventory dice cuántas líneas son nuevas y cuántas ya existían
-- =============================================================================
-- Hasta ahora devolvía `{published, removed}` y la pantalla decía «500 publicadas»
-- aunque 446 ya estuvieran (6-oct-2026, PO: «me parece que se han vuelto a importar las
-- 500 líneas; no ha dado ningún mensaje que indique que había repetidas»). No había
-- duplicados -la identidad referencia + marca + país actualiza en vez de insertar-,
-- pero la pantalla no lo contaba. Ahora devuelve también:
--   · `inserted`: líneas que no existían y se han creado;
--   · `updated`:  líneas que ya existían y se han actualizado con los datos del archivo
--                 (también las que venían idénticas: no se compara, se reescribe).
-- Siempre `inserted + updated = published`. El resto de la función es idéntico al de 0045.
-- =============================================================================

create or replace function public.import_inventory(
  p_lines            jsonb,
  p_policy           text,
  p_profile_name     text default null,
  p_header_signature text default null,
  p_mapping          jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org       uuid;
  v_n         integer;
  v_bad       integer;
  v_removed   integer := null;
  v_published integer;
  v_inserted  integer;
  v_updated   integer;
begin
  select m.org_id into v_org
    from public.members m
    join public.organizations o on o.id = m.org_id
   where m.id = auth.uid()
     and m.state = 'ACTIVE'
     and m.role in ('ADMIN', 'EDITOR')
     and o.status = 'APPROVED';
  if v_org is null then
    raise exception 'Solo un miembro activo de una organización aprobada puede importar inventario.';
  end if;

  if p_policy is null or p_policy not in ('REPLACE', 'ACCUMULATE') then
    raise exception 'Política de actualización no válida: %', coalesce(p_policy, 'null')
      using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Las líneas deben llegar como una lista.' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_lines);
  if v_n < 1 or v_n > 20000 then
    raise exception 'Un lote lleva entre 1 y 20000 líneas; han llegado %.', v_n
      using errcode = '22023';
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

  -- El cliente ya valida todo esto; aquí se repite porque una función de `public`
  -- no puede fiarse de quien la llama (mismo criterio que `register-organization`).
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

  if p_policy = 'REPLACE' then
    update public.inventory_lines l
       set status = 'DELETED'
     where l.org_id = v_org
       and l.status = 'PUBLISHED'
       and not exists (
             select 1 from _incoming i
              where upper(i.part_number) = upper(l.part_number)
                and upper(i.brand) = upper(l.brand)
                and i.location_country = l.location_country);
    get diagnostics v_removed = row_count;
  end if;

  update public.inventory_lines l
     set quantity       = i.quantity,
         product_family = coalesce(i.product_family, l.product_family),
         lead_time_days = i.lead_time_days,
         notes          = i.notes,
         status         = 'PUBLISHED',
         last_upload_at = now()
    from _incoming i
   where l.org_id = v_org
     and l.status <> 'DELETED'
     and upper(l.part_number) = upper(i.part_number)
     and upper(l.brand) = upper(i.brand)
     and l.location_country = i.location_country;
  get diagnostics v_updated = row_count;

  insert into public.inventory_lines
         (org_id, part_number, brand, quantity, location_country, product_family,
          lead_time_days, notes, status, last_upload_at)
  select v_org, i.part_number, i.brand, i.quantity, i.location_country, i.product_family,
         i.lead_time_days, i.notes, 'PUBLISHED', now()
    from _incoming i
   where not exists (
           select 1 from public.inventory_lines l
            where l.org_id = v_org
              and l.status <> 'DELETED'
              and upper(l.part_number) = upper(i.part_number)
              and upper(l.brand) = upper(i.brand)
              and l.location_country = i.location_country);
  get diagnostics v_inserted = row_count;

  v_published := v_n;

  if p_profile_name is not null then
    if char_length(btrim(p_profile_name)) not between 3 and 50 then
      raise exception 'El nombre del perfil lleva entre 3 y 50 caracteres.' using errcode = '22023';
    end if;
    if coalesce(p_header_signature, '') = '' or p_mapping is null
       or jsonb_typeof(p_mapping) <> 'array' then
      raise exception 'Un perfil necesita la estructura del archivo y su mapeo.' using errcode = '22023';
    end if;
    insert into public.inventory_import_profiles (org_id, name, header_signature, mapping, created_by)
    values (v_org, btrim(p_profile_name), p_header_signature, p_mapping, auth.uid())
    on conflict (org_id, header_signature) do update
       set name = excluded.name, mapping = excluded.mapping,
           created_by = excluded.created_by, updated_at = now();
  end if;

  drop table _incoming;

  return jsonb_build_object('published', v_published, 'removed', v_removed, 'inserted', v_inserted, 'updated', v_updated);
end;
$$;

revoke all on function public.import_inventory(jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.import_inventory(jsonb, text, text, text, jsonb) to authenticated;
