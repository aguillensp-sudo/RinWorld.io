-- =============================================================================
-- Semilla de demo · las exclusiones de ejemplo de INV-07
-- =============================================================================
-- El diseno aprobado (`INV-07 · VIS v1.0.html`, spec §3 "Datos de ejemplo") pinta dos
-- exclusiones geograficas puestas: `[Asia x] [Rusia x]`. Aqui se siembran para la
-- organizacion ALPHA (Rodamientos Ibericos): el continente Asia y el pais Rusia.
--
-- ⚠ **SON INERTES MIENTRAS EL MODO SEA `VISIBLE_TODOS`** (`app.can_view_inventory_of` solo
-- mira la lista en `RESTRINGIDA`), asi que no descuadran SRCH-01 ni DIR-01. NO se toca el modo.
-- Con el modo restringido, las organizaciones con sede en Asia o en Rusia dejarian de ver el
-- stock de ALPHA: ninguna de las seis de la demo tiene sede ahi salvo Anadolu Rulman (TR, AS).
--
-- Idempotente. Se ejecuta DESPUES de `demo_orgs.sql`. Sin caracteres fuera de ASCII.
-- =============================================================================

insert into public.inventory_exclusions (owner_org_id, excluded_continent)
select 'a1000000-0000-4000-8000-000000000001', 'AS'
 where exists (select 1 from public.organizations where id = 'a1000000-0000-4000-8000-000000000001')
   and not exists (select 1 from public.inventory_exclusions
                    where owner_org_id = 'a1000000-0000-4000-8000-000000000001' and excluded_continent = 'AS');

insert into public.inventory_exclusions (owner_org_id, excluded_country)
select 'a1000000-0000-4000-8000-000000000001', 'RU'
 where exists (select 1 from public.organizations where id = 'a1000000-0000-4000-8000-000000000001')
   and not exists (select 1 from public.inventory_exclusions
                    where owner_org_id = 'a1000000-0000-4000-8000-000000000001' and excluded_country = 'RU');
