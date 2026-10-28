-- =============================================================================
-- 0078 · Foro: crear hilo, editar y eliminar la publicación propia
--        (community-forum: thread-and-reply-creation#1, own-content-editing#1 y #2)
-- =============================================================================
-- `0029` dejó el foro sin UPDATE ni DELETE «porque es más fácil añadirlos el día
-- que se decida que retirar los que sobren». Se decide: la spec
-- (`own-content-editing`) los pide para cualquier usuario de la organización
-- autora, y la eliminación es irreversible con confirmación (la confirmación es
-- de la pantalla; la base solo garantiza quién puede y qué queda después).
--
-- **CREAR UN HILO ES UNA SOLA OPERACIÓN.** Un hilo sin publicación inicial no
-- existe (`fetchThreadPosts`: «la primera fila ES la publicación inicial»), así
-- que insertar `forum_threads` y `forum_posts` desde el cliente en dos llamadas
-- dejaría un hilo vacío si la segunda cae -- y la segunda es justo la que el
-- límite de RNG-FORO-06 puede rechazar. `forum_create_thread` los inserta en la
-- misma transacción: si el límite corta, no queda hilo. Es `security invoker`:
-- la RLS, la firma de `guard_forum_author` y el límite de `0031` se aplican
-- tal cual a quien llama, sin una sola regla duplicada aquí.
--
-- **EDITAR: SOLO `body`.** El privilegio de UPDATE es por columna. Quien edita
-- no puede mover la publicación de hilo, cambiarle la fecha ni firmarla con otra
-- organización, aunque lo intente por la API.
--
-- **ELIMINAR Y LA PUBLICACIÓN INICIAL (decisión de esta migración, a revisar por
-- el PO).** La spec no dice qué pasa al borrar la primera publicación, y
-- `reply_count` de `forum_thread_list` es «publicaciones menos la inicial»:
-- si la inicial desapareciera con respuestas ajenas debajo, la primera
-- respuesta pasaría a hacer de inicial sin que su autor lo haya decidido.
--   · La inicial de un hilo CON respuestas no se puede eliminar (sí editar).
--   · La inicial de un hilo SIN respuestas se elimina y se lleva el hilo, que
--     no tiene sentido vacío.
--   · Una respuesta se elimina siempre, y `last_post_at` vuelve a la última
--     publicación que quede: una respuesta borrada no cuenta como actividad.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Crear hilo + publicación inicial, atómico
-- -----------------------------------------------------------------------------
create or replace function public.forum_create_thread(
  p_category_id uuid,
  p_title       text,
  p_body        text
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_thread uuid := gen_random_uuid();
begin
  -- Los mínimos de la spec de FORO-03 (modo creación): título 5-150, cuerpo
  -- 10-10.000. Los CHECK de las tablas son más laxos (3-160 y 1-10.000) porque
  -- valen también para las respuestas; el mínimo de un hilo nuevo es de este
  -- camino.
  if char_length(btrim(coalesce(p_title, ''))) not between 5 and 150 then
    raise exception 'El titulo del hilo debe tener entre 5 y 150 caracteres.';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 10000 then
    raise exception 'El cuerpo del hilo debe tener entre 10 y 10000 caracteres.';
  end if;

  -- La firma (`author_*`) la pone `app.guard_forum_author`; no se pasa.
  insert into public.forum_threads (id, category_id, title)
  values (v_thread, p_category_id, btrim(p_title));

  insert into public.forum_posts (thread_id, body)
  values (v_thread, btrim(p_body));

  return v_thread;
end;
$$;

comment on function public.forum_create_thread(uuid, text, text) is
  'FORO-03 modo creacion (FL-FORO-01): crea el hilo y su publicacion inicial en una transaccion. SECURITY INVOKER: la RLS, la firma de autor y el limite de RNG-FORO-06 (0031) se aplican a quien llama, y si el limite corta no queda un hilo vacio. Devuelve el id del hilo.';

revoke execute on function public.forum_create_thread(uuid, text, text) from public, anon;
grant  execute on function public.forum_create_thread(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · Editar y eliminar la publicación de la propia organización
-- -----------------------------------------------------------------------------
-- La spec dice «el usuario que la escribió o cualquier usuario de su misma
-- organización»: la condición es la organización, no la persona.
grant update (body) on public.forum_posts to authenticated;
grant delete        on public.forum_posts to authenticated;

create policy forum_posts_update_own_org on public.forum_posts
  for update to authenticated
  using      ((select app.is_active_member()) and author_org_id = (select app.current_org_id()))
  with check ((select app.is_active_member()) and author_org_id = (select app.current_org_id()));

create policy forum_posts_delete_own_org on public.forum_posts
  for delete to authenticated
  using ((select app.is_active_member()) and author_org_id = (select app.current_org_id()));

-- -----------------------------------------------------------------------------
-- 3 · La inicial de un hilo con respuestas no se elimina
-- -----------------------------------------------------------------------------
-- ⚠ `security INVOKER`, como `guard_forum_rate_limit` (0031) y por la misma
-- razón: dentro de una función `definer` `current_user` es su DUEÑO, no quien
-- llama, y el bypass de `service_role`/`postgres` se activaría siempre. Lee
-- `forum_posts` bajo la RLS de quien borra; como `forum_posts_select_member`
-- deja ver todas las publicaciones a cualquier miembro activo (es un foro
-- público), el hilo que ve es el hilo entero.
create or replace function app.guard_forum_post_delete()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user in ('service_role','postgres') then
    return old;
  end if;

  if old.id = (select p.id
                 from public.forum_posts p
                where p.thread_id = old.thread_id
                order by p.created_at, p.id
                limit 1)
     and exists (select 1
                   from public.forum_posts p
                  where p.thread_id = old.thread_id
                    and p.id <> old.id)
  then
    raise exception 'La publicacion inicial de un hilo con respuestas no se puede eliminar.';
  end if;

  return old;
end;
$$;

create trigger forum_posts_guard_delete
  before delete on public.forum_posts
  for each row execute function app.guard_forum_post_delete();

-- -----------------------------------------------------------------------------
-- 4 · Lo que queda después de eliminar
-- -----------------------------------------------------------------------------
-- `security definer`: quien elimina no tiene UPDATE ni DELETE sobre
-- `forum_threads` (ni debe tenerlo).
create or replace function app.after_forum_post_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Sin publicaciones no hay hilo.
  delete from public.forum_threads t
   where t.id = old.thread_id
     and not exists (select 1 from public.forum_posts p where p.thread_id = t.id);

  -- Si el hilo sigue, su actividad reciente es la de la última publicación que
  -- queda. Si el hilo ya no existe, esto no toca nada.
  update public.forum_threads t
     set last_post_at = coalesce((select max(p.created_at)
                                    from public.forum_posts p
                                   where p.thread_id = t.id), t.last_post_at)
   where t.id = old.thread_id;

  return old;
end;
$$;

create trigger forum_posts_after_delete
  after delete on public.forum_posts
  for each row execute function app.after_forum_post_delete();
