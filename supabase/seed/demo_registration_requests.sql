-- =============================================================================
-- Semilla de demo · las tres solicitudes de registro de ADMIN-01
-- =============================================================================
-- Son las tres del bloque "Datos de ejemplo" de `Rinworld_spec_ADMIN-01.md`,
-- con una antigüedad cambiada a propósito: 52 horas (rojo), **30** horas
-- (naranja) y 3 horas (normal). Sin las tres, la columna "Antigüedad en cola"
-- se demuestra con un solo color y el indicador no indica nada -- que es
-- exactamente lo que pasó con el catálogo en `F-094`.
--
-- ⚠ **La spec dice 18 horas y las pinta en naranja, y las dos cosas no pueden
-- ser ciertas a la vez (`F-158`).** Su propia regla es *"en naranja si > 24h,
-- en rojo si > 48h"*, y 18 < 24. Manda la regla, que es normativa, no el
-- ejemplo. Se siembra con 30 horas para que la fila de en medio caiga de verdad
-- en la banda naranja: con 18 saldría normal y la demo enseñaría dos colores
-- creyendo que enseña tres.
--
-- ⚠ **RE-ANCLA EL RELOJ CADA VEZ QUE SE CORRE, y por eso el `on conflict` no es
-- `do nothing`.** Las fechas son relativas a `now()`, así que una siembra de
-- hace dos semanas deja las tres en rojo. Volver a pasar este fichero las
-- devuelve a 52/18/3 horas y a `PENDING_REVIEW`, limpias de cualquier decisión
-- que se tomara durante un ensayo. Es el mismo remedio que
-- `reanchor_freshness.sql` para el catálogo.
--
-- ⚠ **NO crea ninguna cuenta de Operador, así que con esto sembrado la pantalla
-- sigue sin poder verse.** `0028` deja la cola visible solo para quien esté en
-- `platform_operators`, y dar de alta a alguien ahí es crear credenciales: lo
-- decide el PO. Es lo único que ADMIN-01 necesita de fuera.
--
-- ⚠ ENCODING. Hay diacríticos (Álvarez). Ver `F-019`: sin `\encoding UTF8` la
-- consola de Windows mete mojibake en lo que el socio va a leer en pantalla.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, applicant_phone, website, submitted_at, state)
values
  ('11110000-0000-4000-8000-00000000aaa1', 'Distribuciones Álvarez SL', 'ES',
   'Juan Álvarez García', 'jalvarez@distribalvarez.test', '+34 91 234 56 78', null,
   now() - interval '52 hours', 'PENDING_REVIEW'),

  ('11110000-0000-4000-8000-00000000aaa2', 'Nordic Bearings AB', 'SE',
   'Sven Lindqvist', 'info@nordicbearings.test', '+46 8 123 456', 'https://nordicbearings.test',
   now() - interval '30 hours', 'PENDING_REVIEW'),

  ('11110000-0000-4000-8000-00000000aaa3', 'Roulements France SAS', 'FR',
   'Camille Moreau', 'contact@roulementsfrance.test', '+33 1 23 45 67', 'https://roulementsfrance.test',
   now() - interval '3 hours', 'PENDING_REVIEW')

on conflict (id) do update
   set submitted_at      = excluded.submitted_at,
       state             = 'PENDING_REVIEW',
       rejection_reason  = null,
       decided_by        = null,
       decided_at        = null;

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- El fichero se verifica a sí mismo, como `reanchor_freshness.sql`: si las tres
-- no caen en los tres niveles de color, la demo de ADMIN-01 no enseña lo que el
-- guion dice que enseña, y es mejor saberlo aquí que en la pantalla.
do $$
declare
  rojas    int;
  naranjas int;
  normales int;
begin
  select count(*) filter (where now() - submitted_at > interval '48 hours'),
         count(*) filter (where now() - submitted_at > interval '24 hours'
                            and now() - submitted_at <= interval '48 hours'),
         count(*) filter (where now() - submitted_at <= interval '24 hours')
    into rojas, naranjas, normales
    from public.registration_requests
   where id in ('11110000-0000-4000-8000-00000000aaa1',
                '11110000-0000-4000-8000-00000000aaa2',
                '11110000-0000-4000-8000-00000000aaa3');

  assert rojas = 1 and naranjas = 1 and normales = 1,
    format('La siembra de ADMIN-01 tiene que dejar una de cada color y dejo %s rojas, %s naranjas y %s normales',
           rojas, naranjas, normales);
  raise notice 'OK · tres solicitudes en cola: una roja (>48h), una naranja (>24h) y una normal';
end
$$;

select org_name, country, state,
       date_trunc('hour', now() - submitted_at) as antiguedad
  from public.registration_requests
 order by submitted_at;
