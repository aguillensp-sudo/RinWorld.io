-- =============================================================================
-- 0030 · Foro: reacciones y la lista de hilos de FORO-02
-- =============================================================================
--
-- Capa de datos de FORO-02 (Lista de Hilos de una Categoria), escrita a mano
-- ANTES de la tarea, como las tres del H1 (UMBRAL-FABRICA-V1.md §7, paso 2).
--
-- ⚠ POR QUE HACE FALTA UNA TABLA NUEVA. La spec de FORO-02 pinta en cada fila un
-- contador `👍 Y`, y 0029 no tiene donde guardar una sola reaccion: solo
-- categorias, hilos y publicaciones. Sin esto, la pantalla tendria que inventarse
-- la cifra o pintar un cero que la base no puede afirmar.
--
-- QUE SE CUENTA, y de donde sale:
--   · Una reaccion es de un USUARIO sobre una PUBLICACION, y se puede quitar
--     (capability `community-forum`, Requirement: reactions; Modulo 08 v1.1 §4.5:
--     "el usuario individual reacciona, no la organizacion").
--   · El contador de la lista es el TOTAL de reacciones acumuladas en el hilo
--     (Modulo 08 v1.1 §3, "Lista de hilos"), es decir, la suma de todas sus
--     publicaciones, no solo la inicial.
--   · Las "respuestas" son las publicaciones MENOS la inicial: el hilo abre con
--     una fila normal de `forum_posts` (ver `supabase/seed/demo_forum.sql`).
--   · Las reacciones no ordenan nada (RNG-FORO-07): la vista no las usa para eso.
--
-- MISMO PATRON QUE 0029, a proposito:
--   · La firma la pone la base: un disparador escribe `member_id := auth.uid()`
--     aunque el cliente mande otro. Reaccionar en nombre de otro no debe poder
--     pasar ni por error.
--   · RLS de miembro activo para leer, y cada uno solo inserta y borra lo suyo.
--     BORRAR es aqui quitar la propia reaccion (el Scenario "reaccionar y quitar
--     reaccion"), no moderar: sigue sin haber UPDATE en ninguna tabla del foro.
--   · La vista es `security_invoker`: respeta la RLS de quien consulta, como
--     `forum_category_stats`. No es una funcion, asi que el barrido de funciones
--     invoker del Dia 14 (`01_schema_smoke.sql`) no la afecta.
-- =============================================================================

create table public.forum_reactions (
  post_id    uuid not null references public.forum_posts (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

comment on table public.forum_reactions is
  'Reacciones "me gusta" del foro: una por usuario y publicacion, retirables. Las cuenta forum_thread_list (FORO-02).';

create or replace function app.guard_forum_reactor()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  new.member_id := auth.uid();
  return new;
end;
$$;

create trigger forum_reactions_member
  before insert on public.forum_reactions
  for each row execute function app.guard_forum_reactor();

-- La lista de FORO-02. Una fila por hilo, con los dos contadores calculados.
-- `left join` a organizations: un hilo no desaparece de la lista porque quien
-- consulta no pueda leer la fila de su organizacion autora.
create view public.forum_thread_list
with (security_invoker = true) as
  select t.id,
         t.category_id,
         t.title,
         t.author_org_id,
         o.name                                   as author_org_name,
         t.created_at,
         t.last_post_at,
         greatest(count(distinct p.id) - 1, 0)    as reply_count,
         count(r.member_id)                       as reaction_count
    from public.forum_threads t
    left join public.organizations   o on o.id = t.author_org_id
    left join public.forum_posts     p on p.thread_id = t.id
    left join public.forum_reactions r on r.post_id = p.id
   group by t.id, t.category_id, t.title, t.author_org_id, o.name, t.created_at, t.last_post_at;

comment on view public.forum_thread_list is
  'FORO-02: hilos con respuestas (publicaciones menos la inicial) y reacciones totales del hilo. security_invoker: respeta la RLS de quien consulta.';

alter table public.forum_reactions enable row level security;

create policy forum_reactions_select_member on public.forum_reactions
  for select to authenticated using (app.is_active_member());

create policy forum_reactions_insert_own on public.forum_reactions
  for insert to authenticated
  with check (app.is_active_member() and member_id = auth.uid());

create policy forum_reactions_delete_own on public.forum_reactions
  for delete to authenticated
  using (member_id = auth.uid());

-- Primero se quita TODO y luego se da lo justo. En el proyecto real las DEFAULT
-- PRIVILEGES de la plataforma conceden de mas a `anon` y `authenticated` en cada
-- objeto nuevo de `public` (F-146): lo que se afirme aqui se comprueba contra el
-- catalogo, no contra estas lineas.
revoke all on public.forum_reactions   from anon, authenticated;
revoke all on public.forum_thread_list from anon, authenticated;

grant select, insert, delete on public.forum_reactions   to authenticated, service_role;
grant select                 on public.forum_thread_list to authenticated, service_role;
