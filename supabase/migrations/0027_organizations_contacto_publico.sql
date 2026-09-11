-- =============================================================================
-- 0027 · Teléfono y email públicos de la organización (DIR-01)
-- =============================================================================
-- DIR-01, el Directorio de Organizaciones, es la primera de las tres pantallas
-- con las que se mide el H1 (`openspec/v1/UMBRAL-FABRICA-V1.md`). Su tabla tiene
-- cinco columnas fijas -- Nombre, País, Teléfono, Email y Favoritos -- y al ir a
-- escribir su capa de datos resultó que DOS de las cinco no existen en ninguna
-- parte del esquema.
--
-- ⚠ Y eso corrige algo que se dijo por escrito al PO al proponer esta pantalla:
-- que DIR-01 "corre sobre `organizations` tal como está". Era falso. Se dijo
-- mirando la lista de columnas de la tabla, sin cruzarla contra las columnas que
-- la spec pinta. Sigue siendo la más barata de las tres -- dos columnas frente a
-- un módulo de foro entero sin una sola tabla -- pero no era gratis.
--
-- **Por qué van en `organizations` y no en una tabla aparte:** son UNO por
-- organización, públicos por spec (*"Los datos de contacto son públicos para
-- todos los miembros"*), y no tienen ciclo de vida propio. Una tabla 1-a-1 aquí
-- solo añadiría un `join` y una política de RLS más que mantener.
--
-- **Y por qué el cliente no los puede tocar.** `app.guard_organization_columns`
-- dice desde `0002` que desde el cliente solo se cambian
-- `inventory_visibility_mode` y `visibility_scope_enabled`, y que el resto es del
-- operador o derivado. Una columna nueva NO entra sola en ese guardia: nace
-- editable por cualquier ADMIN vía la política `organizations_update_visibility_
-- admin`, que filtra por ORGANIZACIÓN y no por columna. Así que se añaden las dos
-- al guardia en la misma migración. El día que el módulo 01 (alta de empresas)
-- quiera que un ADMIN edite el contacto de su propia organización, eso será un
-- cambio deliberado con su propia migración, no un olvido de esta.
-- =============================================================================

alter table public.organizations
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

comment on column public.organizations.contact_phone is
  'Telefono de contacto publico (DIR-01, columna 3). Publico para cualquier miembro autenticado; lo escribe el operador, no el cliente -- ver app.guard_organization_columns.';
comment on column public.organizations.contact_email is
  'Email de contacto publico (DIR-01, columna 4). Mismas reglas que contact_phone.';

-- Dos comprobaciones flojas a propósito: validar un teléfono internacional en un
-- CHECK es una trampa conocida (formatos por país, extensiones, prefijos), y lo
-- único que se quiere impedir aquí es la basura evidente en una columna que se
-- pinta en una tabla pública. El email se comprueba con la forma mínima -- algo,
-- arroba, algo, punto, algo -- y sin espacios.
alter table public.organizations
  add constraint organizations_contact_phone_chk
  check (contact_phone is null or char_length(contact_phone) between 5 and 32);

alter table public.organizations
  add constraint organizations_contact_email_chk
  check (contact_email is null
         or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- -----------------------------------------------------------------------------
-- El guardia, con las dos columnas nuevas dentro
-- -----------------------------------------------------------------------------
-- Idéntico al de `0002` salvo las dos comparaciones añadidas. Sigue SIN
-- `security definer` -- no lee ninguna tabla, decide con OLD/NEW, `current_user`
-- y `auth.uid()`, que es justo lo que el ancla de `F-155` en
-- `01_schema_smoke.sql` exige de toda función `invoker`.
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
  or new.contact_email is distinct from old.contact_email then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode y visibility_scope_enabled; el resto es del operador o derivado';
  end if;
  return new;
end;
$$;
