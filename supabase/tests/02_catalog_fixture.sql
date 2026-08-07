-- =============================================================================
-- Fixture de la fase de catálogo
-- =============================================================================
-- Se ejecuta en una base APARTE de la del smoke test, porque el smoke deja sus
-- propias organizaciones y líneas de inventario y los recuentos del catálogo no
-- pueden contar con basura ajena.
--
-- Aquí van solo las dos organizaciones que `seed/dev_accounts.sql` crea, sin nada
-- de `auth` ni `members`: el catálogo cuelga de `organizations` por clave ajena y
-- no toca a los miembros. Después de este fichero se ejecutan, tal cual y sin
-- editar, `seed/demo_orgs.sql` y `seed/catalog_demo.sql` — la única forma de que
-- el test pruebe los ficheros de verdad y no una copia suya.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

insert into public.organizations (id, name, legal_name, country, continent, status) values
  ('a1000000-0000-4000-8000-000000000001', 'Rodamientos Ibéricos', 'Rodamientos Ibéricos S.L.', 'ES', 'EU', 'APPROVED'),
  ('b2000000-0000-4000-8000-000000000002', 'Nordwälz Lager',       'Nordwälz Lager GmbH',       'DE', 'EU', 'APPROVED')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- assert_that: el gemelo positivo de `expect_fail` del stub.
--
-- Imprime el label en cada aserto que pasa. No es ruido: es la única forma de
-- distinguir "34 asertos pasaron" de "el fichero se ejecutó y no comprobó nada",
-- que es exactamente el fallo de F-015.
-- -----------------------------------------------------------------------------
create or replace function public.assert_that(cond boolean, label text, detail text default null)
returns void
language plpgsql
as $$
begin
  if cond is null then
    raise exception 'TEST ROTO · %',
      label || coalesce(' · ' || detail, '') || ' — la condición evaluó a NULL, no a verdadero/falso';
  end if;
  if not cond then
    raise exception 'ASERTO FALLIDO · %', label || coalesce(' · ' || detail, '');
  end if;
  raise notice 'OK · %', label;
end;
$$;
