-- =============================================================================
-- 0079 · VERA no abre turno para una organización suspendida (F-275, residual)
-- =============================================================================
-- `0069` cortó a los miembros de una organización SUSPENDED en la base, pero
-- `vera_abrir_turno` seguía abriendo turno: un miembro que llamara al proxy a mano
-- gastaba cupo y modelo. Las herramientas de VERA no leen nada (RLS), así que el
-- daño es coste, no datos.
--
-- Cambio mínimo: la misma función de `0068` con una comprobación más, después de
-- validar la sesión y antes del cerrojo y del cupo, para que una petición
-- rechazada no gaste cupo. Solo se rechaza si la organización EXISTE y no está
-- APPROVED; un usuario sin organización (operador) sigue igual que antes.
-- =============================================================================

create or replace function public.vera_abrir_turno(p_es_pregunta boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_cupo    integer := public.vera_cupo_por_hora();
  v_usados  integer;
  v_primero timestamptz;
  v_turno   uuid;
begin
  if v_uid is null then
    raise exception 'VERA necesita una sesión' using errcode = '28000';
  end if;

  -- Organización suspendida o no aprobada: no hay turno, ni se cuenta cupo.
  if exists (
    select 1 from public.organizations o
     where o.id = app.current_org_id() and o.status <> 'APPROVED'
  ) then
    return jsonb_build_object('permitido', false, 'motivo', 'organizacion_no_activa');
  end if;

  -- Dos peticiones a la vez del mismo usuario contarían las dos «149» y entrarían las dos. Un cerrojo por
  -- usuario, de transacción, las pone en fila; no bloquea a nadie más.
  perform pg_advisory_xact_lock(hashtext('vera_usage'), hashtext(v_uid::text));

  select count(*), min(created_at) into v_usados, v_primero
    from public.vera_usage
   where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_usados >= v_cupo then
    -- La fila más antigua de la ventana es la primera que sale: a partir de ahí cabe una más.
    return jsonb_build_object(
      'permitido', false,
      'cupo', v_cupo,
      'reintentar_en_s', greatest(1, ceil(extract(epoch from (v_primero + interval '1 hour' - now())))::integer)
    );
  end if;

  insert into public.vera_usage (user_id, org_id, es_pregunta)
  values (v_uid, app.current_org_id(), coalesce(p_es_pregunta, true))
  returning id into v_turno;

  return jsonb_build_object('permitido', true, 'turno', v_turno, 'cupo', v_cupo, 'restantes', v_cupo - v_usados - 1);
end;
$$;
