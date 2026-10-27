-- =============================================================================
-- 0077 · «Favoritos recibidos» del Panel: un número, nunca quién (F-280)
-- =============================================================================
-- `favorites_select_own` (0005) limita `favorite_distributors` a `member_id = auth.uid()`, así que
-- un conteo desde el cliente devolvería 0 en silencio. Esta función es la única vía: devuelve UN
-- número —cuántos USUARIOS (miembros) han añadido a la organización de quien llama en el mes
-- natural— y no expone ninguna fila ni identidad (RNG-SRCH-08, comentario de `favorite_count`).
--
-- Cuenta miembros, no organizaciones: la PK es (member_id, distributor_org_id).
-- Sin sesión o sin miembro activo de una organización APPROVED devuelve NULL, no 0: el Panel
-- pinta «—» y nunca un cero falso.
-- Sin parámetros a propósito: con una ventana libre, ventanas estrechas delatarían el momento
-- de cada favorito. El mes natural es el de Madrid (`created_at` es timestamptz).
-- Nace cerrada (0071): `authenticated` sí, `anon` no.
-- =============================================================================
create or replace function public.favorites_received_this_month()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when (select app.is_active_member()) then (
      select count(*)::integer
        from public.favorite_distributors f
       where f.distributor_org_id = (select app.current_org_id())
         and f.created_at >= date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'
    )
  end;
$$;

comment on function public.favorites_received_this_month() is
  'Panel (F-280): cuántos usuarios han añadido a la organización de quien llama a sus favoritos en el mes natural (Europa/Madrid). SECURITY DEFINER porque favorites_select_own solo deja ver las filas propias; devuelve un número, nunca quién. NULL si quien llama no es miembro activo.';

revoke execute on function public.favorites_received_this_month() from public, anon;
grant  execute on function public.favorites_received_this_month() to authenticated;
