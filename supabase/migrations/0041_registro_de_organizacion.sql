-- =============================================================================
-- 0041 · Alta de organizacion desde el FRO (REG-01, F-226)
-- =============================================================================
-- REG-01 es la pantalla a la que lleva el enlace de `0040`: el solicitante aprobado
-- rellena los datos de su organizacion y de su administrador. Este esquema pone
-- debajo lo que le faltaba, y NADA de lo que sigue es alcanzable por un cliente: la
-- unica puerta es `register_organization`, que solo ejecuta `service_role` (la Edge
-- Function `register-organization`, que crea antes la cuenta de Auth).
--
-- **Tres columnas publicas** en `organizations`, del mismo tipo que las de `0036`
-- (`contact_email`, `address`...): sitio web, paises de operacion y marcas. Son
-- perfil publico (ficha y Directorio), asi que las lee cualquier miembro activo por
-- la politica que ya existe.
--
-- **El NIF/CIF NO va ahi.** La spec lo llama «dato interno» y `organizations` la lee
-- el Directorio. Va en `organization_internal`, con una politica de lectura solo
-- para el ADMIN de la propia organizacion. No hay politica de escritura para nadie:
-- lo escribe la funcion de alta, y editarlo sera de otra pantalla.
--
-- **La funcion decide TODO en el servidor.** Repite las validaciones de la spec (no
-- se fia de la pantalla ni de la Edge Function), canjea el token de `0040` y crea
-- organizacion, NIF y ADMIN en UNA transaccion: si algo falla, el token NO se gasta
-- (la excepcion deshace el canje) y el solicitante puede volver a intentarlo con el
-- mismo enlace. El rol ADMIN lo pone `assign_member_role` (0001): es el primero.
--
-- **Lo que NO hace:** no crea la cuenta de Auth (es API de administracion, de la
-- Edge Function), no envia correo y no activa al ADMIN: nace `REGISTERED`, igual que
-- el usuario de FRU. Llegar a `KEY_ACTIVE` es REG-05 a REG-07, que no existen (F-218).
-- No enlaza la solicitud con la organizacion: el token, de un solo uso, ya garantiza
-- que una solicitud crea una.
-- =============================================================================

alter table public.organizations
  add column website             text,
  add column operating_countries text[] not null default '{}',
  add column brands              text[] not null default '{}';

alter table public.organizations
  add constraint organizations_website_chk
    check (website is null or (website ~ '^https://[^[:space:]]+$' and char_length(website) <= 200)),
  add constraint organizations_brands_chk
    check (cardinality(brands) <= 20),
  add constraint organizations_operating_countries_chk
    check (cardinality(operating_countries) <= 250);

comment on column public.organizations.operating_countries is
  'Codigos ISO alfa-2 de los paises donde opera (FRO campo 9). Vacio en las organizaciones anteriores a 0041.';

-- -----------------------------------------------------------------------------
-- 1 · El NIF/CIF: dato interno
-- -----------------------------------------------------------------------------
create table public.organization_internal (
  org_id     uuid primary key references public.organizations (id) on delete cascade,
  tax_id     text not null,
  created_at timestamptz not null default now(),
  constraint organization_internal_tax_id_chk
    check (char_length(btrim(tax_id)) between 1 and 20)
);

comment on table public.organization_internal is
  'Datos internos de la organizacion (NIF/CIF del FRO, campo 2). Solo los lee el ADMIN de la propia organizacion; solo los escribe register_organization.';

alter table public.organization_internal enable row level security;

create policy organization_internal_select_admin on public.organization_internal
  for select to authenticated
  using (org_id = app.current_org_id() and app.is_org_admin());

-- -----------------------------------------------------------------------------
-- 2 · Pais -> continente
-- -----------------------------------------------------------------------------
-- Las mismas listas que `CONTINENT_COUNTRY_CODES` de `app/src/lib/visibility.ts` (INV-07),
-- que salen del diseno aprobado. Si un pais sale en dos continentes (KZ, TR, TL), gana
-- el primero en el orden EU, AS, NA, SA, AF, OC. NULL si el codigo no existe.
create or replace function app.continent_of(p_country text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_country in ('AD', 'AL', 'AM', 'AT', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'KZ', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK') then 'EU'
    when p_country in ('AE', 'AF', 'BD', 'BH', 'BN', 'BT', 'CN', 'ID', 'IL', 'IN', 'IQ', 'IR', 'JO', 'JP', 'KG', 'KH', 'KP', 'KR', 'KW', 'LA', 'LB', 'LK', 'MM', 'MN', 'MV', 'MY', 'NP', 'OM', 'PH', 'PK', 'QA', 'SA', 'SG', 'SY', 'TH', 'TJ', 'TL', 'TM', 'TW', 'UZ', 'VN', 'YE') then 'AS'
    when p_country in ('AG', 'BB', 'BS', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'GD', 'GT', 'HN', 'HT', 'JM', 'KN', 'LC', 'MX', 'NI', 'PA', 'SV', 'TT', 'US', 'VC') then 'NA'
    when p_country in ('AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE') then 'SA'
    when p_country in ('AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EG', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RW', 'SC', 'SD', 'SL', 'SN', 'SO', 'SS', 'ST', 'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'ZA', 'ZM', 'ZW') then 'AF'
    when p_country in ('AU', 'FJ', 'FM', 'KI', 'MH', 'NR', 'NZ', 'PG', 'PW', 'SB', 'TO', 'TV', 'VU', 'WS') then 'OC'
    else null
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3 · El alta
-- -----------------------------------------------------------------------------
create or replace function public.register_organization(
  p_token                text,
  p_user_id              uuid,
  p_admin_email          text,
  p_admin_name           text,
  p_legal_name           text,
  p_tax_id               text,
  p_address              text,
  p_postal_code          text,
  p_country              text,
  p_contact_email        text,
  p_contact_phone        text,
  p_website              text,
  p_operating_countries  text[],
  p_brands               text[],
  p_inventory_visibility text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email     text := lower(btrim(coalesce(p_admin_email, '')));
  v_contact   text := lower(btrim(coalesce(p_contact_email, '')));
  v_legal     text := btrim(coalesce(p_legal_name, ''));
  v_tax       text := btrim(coalesce(p_tax_id, ''));
  v_address   text := btrim(coalesce(p_address, ''));
  v_postal    text := btrim(coalesce(p_postal_code, ''));
  v_phone     text := btrim(coalesce(p_contact_phone, ''));
  v_website   text := nullif(btrim(coalesce(p_website, '')), '');
  v_name      text := btrim(coalesce(p_admin_name, ''));
  v_country   text := upper(btrim(coalesce(p_country, '')));
  v_countries text[];
  v_brands    text[];
  v_request   uuid;
  v_org       uuid;
  c           text;
  b           text;
begin
  -- Validaciones de la spec (REG-01 §4), repetidas aqui porque la base no se fia de
  -- quien la llama. Los mensajes empiezan por «Datos no validos» para que la Edge
  -- Function los distinga de un enlace malo y de un email ya registrado.
  if char_length(v_legal) not between 5 and 120 then
    raise exception 'Datos no validos: el nombre legal tiene entre 5 y 120 caracteres.';
  end if;
  if char_length(v_tax) not between 1 and 20 then
    raise exception 'Datos no validos: el NIF/CIF tiene entre 1 y 20 caracteres.';
  end if;
  if char_length(v_address) not between 1 and 150 then
    raise exception 'Datos no validos: la direccion tiene entre 1 y 150 caracteres.';
  end if;
  if char_length(v_postal) not between 1 and 10 then
    raise exception 'Datos no validos: el codigo postal tiene entre 1 y 10 caracteres.';
  end if;
  if app.continent_of(v_country) is null then
    raise exception 'Datos no validos: el pais de sede no existe.';
  end if;
  if v_contact !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_contact) > 30 then
    raise exception 'Datos no validos: el email de contacto no es valido o pasa de 30 caracteres.';
  end if;
  if v_contact = v_email then
    raise exception 'Datos no validos: el email de contacto tiene que ser distinto del del administrador.';
  end if;
  if v_phone !~ '^\+[0-9]{1,4}[0-9 -]{4,}$' then
    raise exception 'Datos no validos: el telefono no es valido.';
  end if;
  if v_website is not null and (v_website !~ '^https://[^[:space:]]+$' or char_length(v_website) > 200) then
    raise exception 'Datos no validos: la web tiene que empezar por https://.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Datos no validos: el email del administrador no es valido.';
  end if;
  if char_length(v_name) not between 6 and 50 then
    raise exception 'Datos no validos: el nombre del administrador tiene entre 6 y 50 caracteres.';
  end if;
  if p_inventory_visibility is null or p_inventory_visibility not in ('VISIBLE_TODOS', 'RESTRINGIDA') then
    raise exception 'Datos no validos: la visibilidad del inventario no es valida.';
  end if;

  -- Paises de operacion: minimo 1, codigos que existen, sin repetidos.
  select coalesce(array_agg(distinct upper(btrim(x))), '{}') into v_countries
    from unnest(coalesce(p_operating_countries, '{}')) as x;
  if cardinality(v_countries) < 1 then
    raise exception 'Datos no validos: hay que indicar al menos un pais de operacion.';
  end if;
  foreach c in array v_countries loop
    if app.continent_of(c) is null then
      raise exception 'Datos no validos: el pais de operacion % no existe.', c;
    end if;
  end loop;

  -- Marcas: hasta 20, hasta 60 caracteres cada una, sin vacias ni repetidas.
  select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}') into v_brands
    from unnest(coalesce(p_brands, '{}')) as x;
  if cardinality(v_brands) > 20 then
    raise exception 'Datos no validos: como mucho 20 marcas.';
  end if;
  foreach b in array v_brands loop
    if char_length(b) > 60 then
      raise exception 'Datos no validos: una marca pasa de 60 caracteres.';
    end if;
  end loop;

  -- La cuenta de Auth la crea la Edge Function antes de llamar aqui.
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Datos no validos: la cuenta de acceso no existe.';
  end if;
  if exists (select 1 from public.members where lower(email) = v_email) then
    raise exception 'Este email ya tiene cuenta en Bearingworld.io.';
  end if;

  -- El token se canjea AL FINAL de las comprobaciones y dentro de la misma
  -- transaccion: cualquier fallo de abajo lo deshace y el enlace sigue valiendo.
  v_request := app.redeem_registration_token(p_token);
  if v_request is null then
    raise exception 'El enlace no es valido o ha caducado.';
  end if;

  insert into public.organizations
    (name, legal_name, country, continent, status, inventory_visibility_mode,
     contact_phone, contact_email, address, postal_code, website,
     operating_countries, brands)
  values
    (v_legal, v_legal, v_country, app.continent_of(v_country), 'APPROVED', p_inventory_visibility,
     v_phone, v_contact, v_address, v_postal, v_website,
     v_countries, v_brands)
  returning id into v_org;

  insert into public.organization_internal (org_id, tax_id) values (v_org, v_tax);

  -- El primero de la organizacion sale ADMIN y con su ambito de visibilidad
  -- (`assign_member_role`, 0001 y 0018): ni el rol ni el ambito se piden aqui.
  insert into public.members (id, org_id, email, full_name, state)
  values (p_user_id, v_org, v_email, v_name, 'REGISTERED');

  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4 · Privilegios, explicitos (F-146: se leen del catalogo, no de este fichero)
-- -----------------------------------------------------------------------------
revoke all on public.organization_internal from anon, authenticated;
grant select on public.organization_internal to authenticated;
grant select, insert, update, delete on public.organization_internal to service_role;

revoke execute on function app.continent_of(text) from public, anon, authenticated;

revoke execute on function public.register_organization(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text[], text[], text
) from public, anon, authenticated;
grant execute on function public.register_organization(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text[], text[], text
) to service_role;
