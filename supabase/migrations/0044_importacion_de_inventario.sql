-- =============================================================================
-- 0044 · Importación de inventario desde archivo (INV-02 → INV-03)
-- =============================================================================
-- INV-02 confirma el mapeo de columnas de un archivo que el navegador ya ha leído
-- y validado línea a línea; esta migración es lo que lo escribe. Tres piezas:
--
--   · `inventory_lines.notes`: el campo `notes` del desplegable de INV-02 no tenía
--     columna. En claro, como `lead_time_days`: es texto del vendedor sobre su
--     propio stock, no un campo comercial E2EE (RNG-VND-01 cifra precio, cantidad
--     negociada, plazo y transporte DEL HILO, no del catálogo).
--   · `inventory_import_profiles`: el «Guardar este mapeo como perfil». Uno por
--     organización y estructura de cabeceras (`header_signature`, la calcula el
--     cliente). Se lee por RLS; se escribe solo desde `import_inventory`.
--   · `public.import_inventory(...)`: la importación entera en UNA transacción. O
--     entra todo el lote o no entra nada; nunca medio inventario reemplazado.
--
-- **Quién puede.** Un miembro `ACTIVE` (ADMIN o EDITOR: los dos gestionan el
-- inventario) de una organización `APPROVED`. Un `REGISTERED`, un suspendido o el
-- Operador de Plataforma (sin organización) reciben un error.
--
-- **Identidad de una línea.** (referencia, marca, país), sin distinguir mayúsculas
-- en las dos primeras. Un mismo rodamiento en dos almacenes de países distintos
-- son dos líneas; el mismo en el mismo país, una. Un lote con dos líneas iguales
-- se rechaza entero: el cliente ya las marca como `Línea duplicada`, y si llegan
-- aquí es que alguien se ha saltado el cliente.
--
-- **Las dos políticas** (spec INV-02 §3):
--   · `REPLACE` (Reemplazo total): las líneas PUBLICADAS que no vienen en el
--     archivo pasan a `DELETED`. No se borra ninguna fila: `DELETED` es un estado
--     del ciclo de vida (0002) y los hilos que citan una línea siguen pudiendo.
--   · `ACCUMULATE` (Acumulativo): no toca lo que no viene.
-- En las dos, cada línea del archivo actualiza la existente o se inserta, y queda
-- `PUBLISHED` con `last_upload_at = now()`.
--
-- **Qué NO hace, y es deliberado.**
--   · No recibe precio. `unit_price_ciphertext` es E2EE (0002) y nadie en el
--     navegador tiene hoy una clave con la que cifrarlo para su lector: la opción
--     `price` de INV-02 sale deshabilitada.
--   · No lee el archivo: lo lee el navegador (CSV, TSV, TXT). XLSX/XLS no se leen
--     todavía (sin dependencia nueva) y acaban en el estado de fallo de INV-03.
--   · No infiere la familia: `product_family` llega ya inferida por el cliente; una
--     línea sin familia es un error de esa línea y no llega aquí.
--   · El límite de 500.000 líneas lo sigue poniendo el trigger de 0002; el de 20.000
--     líneas por lote es de esta función (tamaño de una petición).
-- =============================================================================

alter table public.inventory_lines
  add column notes text;

alter table public.inventory_lines
  add constraint inventory_lines_notes_len_chk
  check (notes is null or char_length(notes) <= 500);

comment on column public.inventory_lines.notes is
  'Notas del vendedor sobre la línea (INV-02, campo `notes`). En claro; máximo 500 caracteres.';

-- -----------------------------------------------------------------------------
-- Perfiles de mapeo
-- -----------------------------------------------------------------------------
create table public.inventory_import_profiles (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  header_signature text not null,
  mapping          jsonb not null,
  created_by       uuid references public.members (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint inventory_import_profiles_name_chk
    check (char_length(btrim(name)) between 3 and 50),
  constraint inventory_import_profiles_signature_chk
    check (char_length(header_signature) between 1 and 4000),
  constraint inventory_import_profiles_mapping_chk
    check (jsonb_typeof(mapping) = 'array'),
  constraint inventory_import_profiles_org_signature_key
    unique (org_id, header_signature)
);

alter table public.inventory_import_profiles enable row level security;

-- Privilegios explícitos, sin heredar los por defecto (F-192): se lee y nada más.
revoke all on table public.inventory_import_profiles from public, anon, authenticated;
grant select on table public.inventory_import_profiles to authenticated;

create policy inventory_import_profiles_select_own
  on public.inventory_import_profiles
  for select to authenticated
  using (org_id = app.current_org_id() and app.is_active_member());

-- -----------------------------------------------------------------------------
-- La importación
-- -----------------------------------------------------------------------------
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
         btrim(x.product_family)                  as product_family,
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
      or coalesce(product_family, '') = '' or char_length(product_family) > 80
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
         product_family = i.product_family,
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

  return jsonb_build_object('published', v_published, 'removed', v_removed);
end;
$$;

revoke all on function public.import_inventory(jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.import_inventory(jsonb, text, text, text, jsonb) to authenticated;

comment on function public.import_inventory(jsonb, text, text, text, jsonb) is
  'INV-02: importa un lote ya validado por el cliente en una transacción. REPLACE pasa a DELETED lo publicado que no viene; ACCUMULATE no lo toca. Devuelve {published, removed}.';
