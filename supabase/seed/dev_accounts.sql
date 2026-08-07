-- =============================================================================
-- Semilla de desarrollo · dos organizaciones y dos cuentas
-- =============================================================================
-- Las contraseñas NO viven aquí (CLAUDE.md §1: ninguna credencial en ningún
-- fichero). Entran como variables de psql:
--
--   psql "$DB_URL" -v alpha_pw="$BW_ALPHA_PW" -v beta_pw="$BW_BETA_PW" \
--        -f supabase/seed/dev_accounts.sql
--
-- Idempotente: se puede volver a ejecutar sin duplicar.
--
-- ⚠ LA TRAMPA DE GOTRUE. Al insertar en `auth.users` por SQL, las columnas
-- `confirmation_token`, `recovery_token`, `email_change_token_new` y
-- `email_change` NO tienen DEFAULT y quedan NULL. GoTrue las lee en un `string`
-- de Go, que no admite NULL, y el login devuelve 500 "Database error querying
-- schema" — un error que no menciona la causa por ningún lado. De ahí el
-- `coalesce(..., '')` de abajo: no es decoración. Ver F-013.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

-- ⚠ Los nombres llevan diacríticos y el `\encoding UTF8` de arriba es lo que los
-- protege: en Windows la consola entra con code page 850/1252 y sin esa línea psql
-- reinterpreta los bytes y escribe mojibake en la columna que el socio lee en la
-- demo. Las dos filas nacieron en ASCII y se corrigieron el 7-ago (F-019); aquí
-- están ya bien para que un bootstrap desde cero no repita el fallo.
insert into public.organizations (id, name, legal_name, country, continent, status) values
  ('a1000000-0000-4000-8000-000000000001', 'Rodamientos Ibéricos', 'Rodamientos Ibéricos S.L.', 'ES', 'EU', 'APPROVED'),
  ('b2000000-0000-4000-8000-000000000002', 'Nordwälz Lager',       'Nordwälz Lager GmbH',       'DE', 'EU', 'APPROVED')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'alpha@bearingworld.test', crypt(:'alpha_pw', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Alvaro Alpha"}'::jsonb,
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b2000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'beta@bearingworld.test', crypt(:'beta_pw', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Bea Beta"}'::jsonb,
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values
  (gen_random_uuid(), 'a1000000-0000-4000-8000-00000000000a',
   'a1000000-0000-4000-8000-00000000000a', 'email',
   '{"sub":"a1000000-0000-4000-8000-00000000000a","email":"alpha@bearingworld.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now()),
  (gen_random_uuid(), 'b2000000-0000-4000-8000-00000000000b',
   'b2000000-0000-4000-8000-00000000000b', 'email',
   '{"sub":"b2000000-0000-4000-8000-00000000000b","email":"beta@bearingworld.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now())
on conflict (provider_id, provider) do nothing;

-- `role` lo fija el trigger app.assign_member_role: cada uno es el primero de su
-- organización, así que los dos salen ADMIN. `state = ACTIVE` sin material de
-- clave es el caso del MVP (ver comentario largo en 0001).
insert into public.members (id, org_id, email, full_name, role, state) values
  ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000001',
   'alpha@bearingworld.test', 'Alvaro Alpha', 'EDITOR', 'ACTIVE'),
  ('b2000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000002',
   'beta@bearingworld.test',  'Bea Beta',    'EDITOR', 'ACTIVE')
on conflict (id) do nothing;

-- Tres líneas por organización, con una no-PUBLISHED cada una para poder ver la
-- frontera de RLS de un vistazo. El catálogo de 200+ líneas es del día 3 (Coder).
-- `unit_price` queda NULL: es E2EE y todavía no hay claves reales que lo cifren.
-- `lead_time_days` va EN CLARO (migración 0005): es chip de filtro y columna
-- ordenable de SRCH-01. Cifrado solo cuando viaja en una tarjeta de oferta.
insert into public.inventory_lines
  (org_id, part_number, brand, quantity, location_country, product_family, status, lead_time_days)
select * from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, '6205-2RS',  'SKF',  840, 'ES', 'Rodamiento rigido de bolas', 'PUBLISHED', 3),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '6206-2RS',  'FAG',  310, 'ES', 'Rodamiento rigido de bolas', 'PUBLISHED', 5),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '22210-E1',  'FAG',   45, 'PT', 'Rodamiento de rodillos a rotula', 'DRAFT', 14),
  ('b2000000-0000-4000-8000-000000000002'::uuid, '6205-2RS',  'NSK', 1200, 'DE', 'Rodamiento rigido de bolas', 'PUBLISHED', 7),
  ('b2000000-0000-4000-8000-000000000002'::uuid, '32011-X',   'SKF',  180, 'PL', 'Rodamiento de rodillos conicos', 'PUBLISHED', 12),
  ('b2000000-0000-4000-8000-000000000002'::uuid, 'NU-2210-E', 'INA',   90, 'DE', 'Rodamiento de rodillos cilindricos', 'ARCHIVED', 21)
) as v
where not exists (select 1 from public.inventory_lines);

select
  (select count(*) from public.organizations)   as orgs,
  (select count(*) from public.members)         as members,
  (select count(*) from public.inventory_lines) as lineas;
