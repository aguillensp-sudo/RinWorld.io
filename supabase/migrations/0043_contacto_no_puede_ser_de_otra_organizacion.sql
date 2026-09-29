-- =============================================================================
-- 0043 · El email de contacto publico no puede ser el de OTRA organizacion (REG-01)
-- =============================================================================
-- La C5 del PO sobre REG-01 (29-sep-2026): con la regla de `0042` («el contacto puede ser el del
-- administrador») quedaba abierto que el contacto publico fuera el email de acceso de un usuario de
-- OTRA organizacion (se colo `alpha@bearingworld.test`, que es de Rodamientos Iberico) o el contacto
-- publico de otra. El contacto se publica en el Directorio y la ficha: no puede apuntar a otra
-- organizacion. SI puede ser el del propio administrador que se da de alta.
--
-- `contact_email_available(email, email_del_administrador)` responde a esa pregunta y la usan la
-- funcion de alta (rechaza) y la Edge Function (`check_contact_email`, la comprobacion en vivo al salir
-- del campo). Solo `service_role`: es un oraculo de «este email existe» y no se abre a nadie mas.
-- =============================================================================

create or replace function public.contact_email_available(p_email text, p_admin_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
           select 1 from public.members m
            where lower(m.email) = lower(btrim(coalesce(p_email, '')))
              and lower(m.email) <> lower(btrim(coalesce(p_admin_email, '')))
         )
     and not exists (
           select 1 from auth.users u
            where lower(u.email) = lower(btrim(coalesce(p_email, '')))
              and lower(u.email) <> lower(btrim(coalesce(p_admin_email, '')))
         )
     and not exists (
           select 1 from public.organizations o
            where lower(o.contact_email) = lower(btrim(coalesce(p_email, '')))
         );
$$;

revoke execute on function public.contact_email_available(text, text) from public, anon, authenticated;
grant  execute on function public.contact_email_available(text, text) to service_role;

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
  -- Sin comparar el email de contacto con el del administrador: si el administrador quiere que su
  -- email sea tambien el de contacto publico, no hay razon para impedirselo (PO, C5 del 29-sep).
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
  -- El email de contacto publico no puede ser el de otra organizacion (ni el de acceso de uno de sus
  -- usuarios ni su contacto publico). Puede ser el del propio administrador que se da de alta.
  if not public.contact_email_available(v_contact, v_email) then
    raise exception 'Este email de contacto ya pertenece a otra organizacion.';
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
