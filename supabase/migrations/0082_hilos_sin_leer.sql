-- =============================================================================
-- 0082 · Hilos sin leer (F-027 a)
-- =============================================================================
-- Decisión del PO del 18-nov-2026 (`DECISIONES-V1.md`): el bloque Hilos del Panel (PANEL-01 §4.4) y el
-- indicador de no leídos de la lista de Hilos (MSG-01 §3) tienen por fin de dónde salir. Hasta hoy no
-- había ningún registro de lectura y los dos pintaban «—».
--
-- «Sin leer» es por MIEMBRO. Un hilo tiene algo sin leer para un miembro si, después de la última vez
-- que lo abrió (o de su alta, si no lo ha abierto nunca):
--   · la otra empresa ha creado un elemento (mensaje, consulta u oferta), o
--   · ha cambiado el estado de uno de la empresa del miembro (aceptar, rechazar, superar por
--     contraoferta); ese cambio solo lo hace la otra parte (0007, 0055).
-- Lo que escribe la propia empresa no cuenta.
--
-- Solo metadatos en claro: `sender_org_id`, `created_at`, `estado_changed_at`. Nada cifrado (RNG-VND-01).
--
-- Pruebas: `supabase/tests/13_hilos_sin_leer.sql`. Escrita a mano por Claude Code.
-- =============================================================================

create table if not exists public.thread_reads (
  member_id    uuid        not null references public.members (id) on delete cascade,
  thread_id    uuid        not null references public.threads (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (member_id, thread_id)
);

comment on table public.thread_reads is
  'F-027 a (0082): cuándo abrió cada miembro cada hilo por última vez. Solo lo ve y lo escribe el propio miembro.';

alter table public.thread_reads enable row level security;

revoke all on public.thread_reads from public, anon, authenticated;
grant select, insert on public.thread_reads to authenticated;
grant update (last_read_at) on public.thread_reads to authenticated;

create policy thread_reads_select_own on public.thread_reads
  for select to authenticated
  using (member_id = (select auth.uid()));

create policy thread_reads_insert_own on public.thread_reads
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and (select app.is_active_member())
    and app.can_access_thread(thread_id)
  );

create policy thread_reads_update_own on public.thread_reads
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()) and app.can_access_thread(thread_id));

-- -----------------------------------------------------------------------------
-- Marcar como leído: lo llama la pantalla del hilo al cargarlo. La hora la pone el servidor.
-- `invoker`: solo ESCRIBE, bajo las políticas de arriba; si no puede, falla con error.
-- -----------------------------------------------------------------------------
create or replace function public.mark_thread_read(p_thread_id uuid)
  returns void
  language sql
  volatile
  set search_path to 'public', 'pg_temp'
as $$
  insert into public.thread_reads (member_id, thread_id, last_read_at)
  values ((select auth.uid()), p_thread_id, now())
  on conflict (member_id, thread_id) do update set last_read_at = excluded.last_read_at;
$$;

revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant  execute on function public.mark_thread_read(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Los hilos con algo sin leer para quien llama, con la contraparte y el estado del hilo
-- (PANEL-01 §4.4: «Más reciente: {organización} — {estatus del hilo}»).
-- `invoker` a propósito: lee bajo la RLS de quien llama, así que solo cuenta lo que ese miembro puede
-- ver (incluido el ámbito de visibilidad de 0019/0051). Su resultado ES la respuesta, no un guardia.
-- -----------------------------------------------------------------------------
create or replace function public.unread_threads()
  returns table (
    thread_id         uuid,
    counterparty_name text,
    thread_state      text,
    unread_count      integer,
    last_unread_at    timestamptz
  )
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  with yo as (
    select m.id, m.created_at
      from public.members m
     where m.id = (select auth.uid())
  ),
  eventos as (
    -- Lo que crea la otra empresa.
    select i.thread_id, i.created_at as at
      from public.thread_items i
     where i.sender_org_id <> (select app.current_org_id())
    union all
    -- Lo propio cuyo estado ha cambiado después de crearse (lo cambia la otra parte).
    select i.thread_id, i.estado_changed_at
      from public.thread_items i
     where i.sender_org_id = (select app.current_org_id())
       and i.estado_changed_at > i.created_at
  )
  select t.id,
         o.name,
         t.state::text,
         count(*)::integer,
         max(e.at)
    from eventos e
    join public.threads t on t.id = e.thread_id
    join public.organizations o
      on o.id = case when t.org_low_id = (select app.current_org_id()) then t.org_high_id else t.org_low_id end
   cross join yo
    left join public.thread_reads r on r.thread_id = t.id and r.member_id = yo.id
   where e.at > coalesce(r.last_read_at, yo.created_at)
   group by t.id, o.name, t.state
   order by max(e.at) desc;
$$;

revoke execute on function public.unread_threads() from public, anon;
grant  execute on function public.unread_threads() to authenticated;

-- -----------------------------------------------------------------------------
-- Punto de partida: lo que ya existe hoy se da por leído. Sin esto, el primer día saldría «sin leer»
-- todo el histórico. Los hilos que nazcan después no tienen fila y cuentan desde el alta del miembro.
-- -----------------------------------------------------------------------------
insert into public.thread_reads (member_id, thread_id, last_read_at)
select m.id, t.id, now()
  from public.members m
  join public.threads t on m.org_id in (t.org_low_id, t.org_high_id)
on conflict (member_id, thread_id) do nothing;
