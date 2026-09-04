-- =============================================================================
-- Stub de `auth` para probar las migraciones en un Postgres pelado
-- =============================================================================
-- SOLO PARA TESTS. En Supabase, `auth` y sus roles ya existen; este fichero no se
-- aplica nunca allí. Sirve para que las migraciones se puedan verificar sin
-- levantar el stack entero ni tocar el proyecto remoto.
-- =============================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant anon, authenticated, service_role to postgres;

-- -----------------------------------------------------------------------------
-- ⚠ F-146 · el stub tiene que copiar tambien lo que la plataforma REGALA
-- -----------------------------------------------------------------------------
-- Hasta el 4-sep-2026 este fichero solo creaba los tres roles, y con eso el
-- Postgres de pruebas se parecia a Supabase en lo que a Supabase le falta y no
-- en lo que a Supabase le sobra. Supabase deja puestas unas DEFAULT PRIVILEGES
-- en el esquema `public` que conceden EXECUTE a `anon`, `authenticated` y
-- `service_role` sobre CADA funcion nueva, en el momento de crearla. Un
-- `revoke execute ... from public` -el patron de todas las migraciones desde
-- 0001- quita el pseudo-rol PUBLIC y NO quita esa concesion propia de `anon`.
--
-- Resultado: en el proyecto real cinco de las siete funciones de `public` eran
-- ejecutables por `anon` mientras sus comentarios decian lo contrario, y **aqui
-- no habia forma de verlo**: sin la default privilege, ninguna funcion local
-- nacia con el permiso, asi que cualquier aserto sobre esto habria pasado en
-- vacio. Un banco de pruebas mas permisivo que produccion falla en el sentido
-- seguro; uno mas ESTRICTO -como era este- esconde agujeros reales.
--
-- Desde aqui, el local nace igual de abierto que el remoto y el aserto del
-- final de 01_schema_smoke.sql mide algo de verdad.
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Igual que en Supabase: lee el `sub` del JWT que PostgREST deja en la sesión.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- Espera que una sentencia falle. Si pasa, el test falla.
--
-- Imprime SIEMPRE el sqlstate y el mensaje: si no, un typo en el propio test
-- (columna mal escrita, sintaxis) se contaría como invariante verificada, y el
-- test parecería más fuerte de lo que es. Y rechaza de plano los errores que
-- delatan un test roto en vez de un esquema que dice no.
create or replace function public.expect_fail(stmt text, label text)
returns void
language plpgsql
as $$
declare
  st text;
  msg text;
begin
  begin
    execute stmt;
  exception
    when others then
      st := sqlstate; msg := sqlerrm;
      -- 42xxx = error de sintaxis o de nombre: el test está mal, no el esquema.
      if st like '42%' then
        raise exception 'TEST ROTO · "%" falló por error de sintaxis/nombre (% %), no por una restricción', label, st, msg;
      end if;
      raise notice 'OK · bloqueado: %  [% %]', label, st, msg;
      return;
  end;
  raise exception 'TEST FALLIDO · se esperaba que el esquema bloqueara: %', label;
end;
$$;
