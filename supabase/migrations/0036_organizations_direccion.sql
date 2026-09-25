-- =============================================================================
-- 0036 · Dirección postal de la organización (DIR-02)
-- =============================================================================
-- DIR-02, la ficha pública, pinta tres datos generales que ninguna columna de
-- `organizations` guarda: la dirección (calle y número), la ciudad y el código
-- postal. Mismo hallazgo que en `0027` para DIR-01: se dijo que la pantalla "corre
-- sobre `organizations` tal como está" mirando las columnas de la tabla y no las
-- que la spec pinta (`organization-public-profile`: nombre, país, dirección,
-- código postal, fecha de incorporación). El nombre, el país y la fecha
-- (`created_at`) existen; estas tres, no.
--
-- **Tres columnas y no una `address` con todo dentro**: el HTML aprobado pinta la
-- dirección en dos líneas (`Heinrich-Hertz-Strasse 1` / `40699 Erkrath`) Y el
-- código postal como fila aparte. Con una sola cadena habría que trocearla para
-- pintar la segunda fila, y trocear texto libre es como se acaban rompiendo las
-- direcciones con comas.
--
-- **Mismas reglas que el contacto público (`0027`):** públicas de LEER para
-- cualquier miembro (`open-public-contact-data`), y el cliente NO las escribe. La
-- política `organizations_update_visibility_admin` filtra por organización, no por
-- columna, así que una columna nueva nace editable por cualquier ADMIN si no entra
-- en `app.guard_organization_columns`. Entran aquí, en la misma migración. Que un
-- ADMIN edite los datos de su organización (Ajustes → Datos de la organización) es
-- una decisión de `organization-onboarding`, con su propia migración.
-- =============================================================================

alter table public.organizations
  add column if not exists address     text,
  add column if not exists city        text,
  add column if not exists postal_code text;

comment on column public.organizations.address is
  'Calle y numero (DIR-02). Publica para cualquier miembro autenticado; la escribe el operador, no el cliente -- ver app.guard_organization_columns.';
comment on column public.organizations.city is
  'Ciudad (DIR-02). Mismas reglas que address.';
comment on column public.organizations.postal_code is
  'Codigo postal (DIR-02). Mismas reglas que address. Texto y no numero: hay codigos con letras (GB, NL) y con ceros a la izquierda.';

-- Comprobaciones flojas a propósito, como en `0027`: lo único que se impide es la
-- basura evidente (cadena vacía o desmesurada) en columnas que se pintan en una
-- ficha pública. Validar el formato de un código postal por país en un CHECK es la
-- misma trampa que validar un teléfono.
alter table public.organizations
  add constraint organizations_address_chk
  check (address is null or char_length(address) between 1 and 200);

alter table public.organizations
  add constraint organizations_city_chk
  check (city is null or char_length(city) between 1 and 100);

alter table public.organizations
  add constraint organizations_postal_code_chk
  check (postal_code is null or char_length(postal_code) between 1 and 16);

-- -----------------------------------------------------------------------------
-- El guardia, con las tres columnas nuevas dentro
-- -----------------------------------------------------------------------------
-- Idéntico al de `0027` salvo las tres comparaciones añadidas. Sigue SIN
-- `security definer`: decide con OLD/NEW, `current_user` y `auth.uid()`, que es lo
-- que el ancla de `F-155` en `01_schema_smoke.sql` exige de toda función `invoker`.
create or replace function app.guard_organization_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  if new.name   is distinct from old.name
  or new.legal_name is distinct from old.legal_name
  or new.country is distinct from old.country
  or new.continent is distinct from old.continent
  or new.status is distinct from old.status
  or new.favorite_count is distinct from old.favorite_count
  or new.contact_phone is distinct from old.contact_phone
  or new.contact_email is distinct from old.contact_email
  or new.address is distinct from old.address
  or new.city is distinct from old.city
  or new.postal_code is distinct from old.postal_code then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode y visibility_scope_enabled; el resto es del operador o derivado';
  end if;
  return new;
end;
$$;
