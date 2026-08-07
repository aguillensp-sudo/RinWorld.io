-- =============================================================================
-- Semilla de demo · las seis organizaciones distribuidoras
-- =============================================================================
-- Decisión del PO, 7-ago-2026: seis organizaciones, de las cuales solo dos tienen
-- cuenta. Justificación en `openspec/mvp/guion-demo-y-siembra.md` §3: la columna
-- Empresa de SRCH-01 es obligatoria por spec, y con dos organizaciones el
-- comprador ve un único proveedor en toda la tabla de resultados.
--
-- Las cuatro sin cuenta son organizaciones del directorio con **cero miembros**.
-- El esquema lo permite: `members` apunta a `organizations`, no al revés. La RLS
-- no cambia — `inventory_select_cross_org` filtra por `status = 'PUBLISHED'` y por
-- `can_view_inventory_of()`, y ninguno de los dos mira si hay miembros.
--
-- Idempotente. Se ejecuta DESPUÉS de `dev_accounts.sql` y ANTES del catálogo.
--
-- ⚠ ENCODING. Este fichero lleva diacríticos (Nordwälz, Ibéricos, Łożyska, Rhône,
-- A.Ş.). El `\encoding UTF8` no es decoración: en Windows la consola entra con
-- code page 850/1252 y sin esta línea psql reinterpreta los bytes y mete mojibake
-- en la columna que el socio va a leer en la demo. Ver F-019.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

-- -----------------------------------------------------------------------------
-- 1 · Los nombres de las dos que ya existen
--
-- `dev_accounts.sql` las creó en ASCII ("Rodamientos Ibericos", "Nordwaelz
-- Lager") y su `on conflict (id) do nothing` no arregla filas ya insertadas, así
-- que hace falta un UPDATE explícito. No es cosmética: `name` es lo que pinta la
-- columna Empresa de SRCH-01 y la barra de marca del shell. Ver F-019.
--
-- El UPDATE pasa por `app.guard_organization_columns()`, que bloquea el cambio de
-- `name` desde el cliente. Por eso esto se ejecuta como `postgres`/`service_role`:
-- es una corrección del operador, no una acción de la aplicación.
-- -----------------------------------------------------------------------------
update public.organizations
   set name = 'Rodamientos Ibéricos', legal_name = 'Rodamientos Ibéricos S.L.'
 where id = 'a1000000-0000-4000-8000-000000000001';

update public.organizations
   set name = 'Nordwälz Lager', legal_name = 'Nordwälz Lager GmbH'
 where id = 'b2000000-0000-4000-8000-000000000002';

-- -----------------------------------------------------------------------------
-- 2 · Las cuatro de catálogo
--
-- UUID fijos y legibles (c3…, d4…, e5…, f6…) a propósito: el catálogo del día 3 y
-- los tests que lo validan los referencian literalmente, y con `gen_random_uuid()`
-- no habría nada estable que referenciar.
--
-- `status = 'APPROVED'` porque su stock tiene que aparecer en la búsqueda del día
-- 6. `inventory_visibility_mode` se deja en su default 'VISIBLE_TODOS'.
--
-- ⚠ TURQUÍA VA EN 'AS', Y ES DELIBERADO. `organizations_continent_chk` admite
-- AF/AN/AS/EU/NA/OC/SA, y Turquía está a caballo. Se sigue el geoscheme de la ONU,
-- que la sitúa en Asia Occidental. La consecuencia es la que la demo necesita: el
-- chip de zona "Europa" filtra por `continent = 'EU'`, así que Anadolu Rulman
-- desaparece de los resultados en cuanto se aplica — que es justo lo que hay que
-- poder enseñar (guion §2.1, "la zona cortando").
-- -----------------------------------------------------------------------------
insert into public.organizations (id, name, legal_name, country, continent, status) values
  ('c3000000-0000-4000-8000-000000000003', 'Cuscinetti Padana', 'Cuscinetti Padana S.r.l.',  'IT', 'EU', 'APPROVED'),
  ('d4000000-0000-4000-8000-000000000004', 'Łożyska Wschód',    'Łożyska Wschód Sp. z o.o.', 'PL', 'EU', 'APPROVED'),
  ('e5000000-0000-4000-8000-000000000005', 'Roulements Rhône',  'Roulements Rhône SAS',      'FR', 'EU', 'APPROVED'),
  ('f6000000-0000-4000-8000-000000000006', 'Anadolu Rulman',    'Anadolu Rulman A.Ş.',       'TR', 'AS', 'APPROVED')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3 · Comprobación
-- -----------------------------------------------------------------------------
select id, name, country, continent, status
  from public.organizations
 order by continent, country;
