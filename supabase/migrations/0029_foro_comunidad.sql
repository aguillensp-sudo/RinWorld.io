-- =============================================================================
-- 0029 · El foro: categorías, hilos y publicaciones (FORO-01, tercera pantalla
--        del H1)
-- =============================================================================
-- El foro es **la única parte no cifrada del producto** (Plan §3.1), y eso lo
-- cambia todo respecto a las otras siete pantallas: aquí no hay CEK, ni reparto
-- de claves, ni `thread_item_keys`. El contenido es texto plano y lo ve
-- cualquier miembro activo, que es exactamente lo que el aviso permanente de la
-- pantalla promete: *"Nada de lo escrito aquí tiene ninguna garantía de
-- confidencialidad."*
--
-- ⚠ **NO CONFUNDIR `forum_threads` CON `threads`.** Son dos cosas distintas con
-- el mismo nombre común y ni una línea compartida: `threads` es la negociación
-- cifrada entre DOS organizaciones (`0003`), con su reparto de claves y su
-- `state`; `forum_threads` es una conversación pública de la comunidad. Que el
-- prefijo `forum_` esté en las tres tablas es deliberado y no se quita.
--
-- **LAS CUATRO CATEGORÍAS VAN EN LA MIGRACIÓN, NO EN LA SIEMBRA, y es una
-- decisión.** La spec las llama *"las cuatro categorías de lanzamiento"* y las
-- nombra una a una con su descripción: no son datos de demo que cada entorno
-- rellena a su gusto, son parte de la definición del producto, como lo es el
-- `CHECK` de estados de un hilo. Cambiarlas debe costar una migración. Lo que sí
-- va a la siembra son los hilos y las publicaciones, que sí son demo.
--
-- **LOS CONTADORES SE CALCULAN, NO SE GUARDAN.** La tarjeta de cada categoría
-- enseña "X hilos", "Y publicaciones" y "última actividad". Se podrían mantener
-- desnormalizados con disparadores -- es lo que hace `organizations.favorite_count`
-- con `app.sync_favorite_count` -- y se ha decidido que no: son CUATRO filas, un
-- contador desnormalizado puede derivar y un `count(*)` no, y el día que el foro
-- crezca lo bastante para que esto se note, se notará en el perfil y se cambia
-- con una vista materializada. **Elegir lo que no puede mentir mientras no
-- duela** es la misma regla que ya se aplicó a la lista de países de DIR-01.
--
-- **LO QUE ESTA MIGRACIÓN NO HACE:** no hay moderación, ni borrado, ni edición.
-- El Plan §3.1 dice que el módulo 08 lleva *"control de abuso"*, y eso son
-- FORO-02/FORO-03 y una decisión de producto que todavía no está tomada. Por eso
-- **no hay ni una política de UPDATE ni de DELETE para nadie**: es más fácil
-- añadirlas el día que se decida que retirar las que se hayan puesto de más.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Las categorías
-- -----------------------------------------------------------------------------
create table public.forum_categories (
  id          uuid primary key default gen_random_uuid(),
  -- El identificador que va en la URL hacia FORO-02. Estable aunque el nombre
  -- se retoque: un `slug` derivado del nombre rompería los enlaces el día que
  -- alguien corrija una tilde.
  slug        text not null unique,
  name        text not null,
  description text not null,
  -- El orden del grid lo fija el producto, no el alfabeto ni la fecha.
  position    int  not null,

  constraint forum_categories_slug_chk check (slug ~ '^[a-z0-9-]+$')
);

comment on table public.forum_categories is
  'Las cuatro categorias de lanzamiento del foro (FORO-01). Son producto, no datos de demo: cambiarlas cuesta una migracion.';

insert into public.forum_categories (slug, name, description, position) values
  ('general', 'General',
   'Conversación abierta del sector, presentaciones, noticias relevantes para la comunidad.', 1),
  ('referencias-tecnicas', 'Referencias técnicas',
   'Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias.', 2),
  ('logistica-y-aduanas', 'Logística y aduanas',
   'Experiencias e intercambio de información sobre transporte, aranceles, incoterms.', 3),
  ('plataforma-y-soporte', 'Plataforma y soporte',
   'Preguntas sobre el funcionamiento de Bearingworld.io, sugerencias de mejora, problemas técnicos.', 4)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 2 · Los hilos
-- -----------------------------------------------------------------------------
create table public.forum_threads (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.forum_categories (id) on delete restrict,
  title          text not null,

  -- Quién escribe: el miembro para la trazabilidad, la organización porque es
  -- lo que la pantalla pinta (*"organización autora"*). Los dos, y no uno
  -- derivado del otro: un miembro puede cambiar de organización algún día, y el
  -- hilo tiene que seguir diciendo desde dónde se escribió.
  author_member_id uuid not null references public.members (id) on delete restrict,
  author_org_id    uuid not null references public.organizations (id) on delete restrict,

  created_at     timestamptz not null default now(),
  -- Lo que ordena la lista de hilos recientes. Lo mantiene un disparador al
  -- publicar, nunca el cliente.
  last_post_at   timestamptz not null default now(),

  constraint forum_threads_title_chk check (char_length(btrim(title)) between 3 and 160)
);

create index forum_threads_recientes_idx on public.forum_threads (last_post_at desc);
create index forum_threads_categoria_idx on public.forum_threads (category_id, last_post_at desc);

-- -----------------------------------------------------------------------------
-- 3 · Las publicaciones
-- -----------------------------------------------------------------------------
create table public.forum_posts (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references public.forum_threads (id) on delete cascade,
  author_member_id uuid not null references public.members (id) on delete restrict,
  author_org_id    uuid not null references public.organizations (id) on delete restrict,

  -- ⚠ `body`, en claro, y a propósito. En el resto del producto el contenido
  -- vive en `content_ciphertext`/`content_iv` y el servidor no lo puede leer.
  -- Aquí sí, y la pantalla lo dice en un bloque permanente. La diferencia de
  -- nombre entre `body` y `content_ciphertext` es la señal: si algún día alguien
  -- copia una consulta de mensajería al foro, el nombre no le va a cuadrar.
  body             text not null,
  created_at       timestamptz not null default now(),

  constraint forum_posts_body_chk check (char_length(btrim(body)) between 1 and 10000)
);

create index forum_posts_hilo_idx on public.forum_posts (thread_id, created_at);

comment on column public.forum_posts.body is
  'Texto PLANO. El foro es la unica parte no cifrada del producto (Plan 3.1) y la pantalla lo advierte en un bloque permanente.';

-- -----------------------------------------------------------------------------
-- 4 · Quién firma lo que escribe
-- -----------------------------------------------------------------------------
-- `security invoker`, como los otros guardias de `app`: decide con NEW,
-- `current_user`, `auth.uid()` y dos ayudantes `definer`. **No lee ninguna
-- tabla**, y por eso tampoco nombra ninguna en sus mensajes -- es lo que el
-- ancla de `F-155` exige de toda función `invoker`.
create or replace function app.guard_forum_author()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  -- La firma la pone la base. Si se dejara al cliente, cualquiera podría
  -- publicar a nombre de otra organización en el único sitio del producto donde
  -- el contenido se lee en claro.
  new.author_member_id := auth.uid();
  new.author_org_id    := app.current_org_id();

  if new.author_org_id is null then
    raise exception 'Solo un miembro activo de una organizacion publica en el foro.';
  end if;

  return new;
end;
$$;

create trigger forum_threads_author
  before insert on public.forum_threads
  for each row execute function app.guard_forum_author();

create trigger forum_posts_author
  before insert on public.forum_posts
  for each row execute function app.guard_forum_author();

-- El reloj de la actividad reciente. `security definer` porque escribe en otra
-- tabla y esa escritura no puede depender de que el que publica tenga permiso
-- de UPDATE sobre el hilo -- que no lo tiene: no hay ninguna política de UPDATE
-- en todo el foro.
create or replace function app.touch_forum_thread()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.forum_threads
     set last_post_at = greatest(last_post_at, new.created_at)
   where id = new.thread_id;
  return new;
end;
$$;

create trigger forum_posts_touch_thread
  after insert on public.forum_posts
  for each row execute function app.touch_forum_thread();

-- -----------------------------------------------------------------------------
-- 5 · Los contadores de la tarjeta
-- -----------------------------------------------------------------------------
-- `security_invoker = true` (Postgres 15+): la vista aplica la RLS de QUIEN
-- CONSULTA, no la de su dueño. Sin eso, una vista sobre tablas con RLS es un
-- agujero con forma de comodidad -- devolvería los recuentos del foro entero a
-- cualquiera que pudiera leer la vista, saltándose las políticas de abajo.
create view public.forum_category_stats
with (security_invoker = true) as
  select c.id,
         c.slug,
         c.name,
         c.description,
         c.position,
         count(distinct t.id)                      as thread_count,
         count(p.id)                               as post_count,
         max(greatest(t.last_post_at, p.created_at)) as last_activity_at
    from public.forum_categories c
    left join public.forum_threads t on t.category_id = c.id
    left join public.forum_posts   p on p.thread_id   = t.id
   group by c.id, c.slug, c.name, c.description, c.position;

comment on view public.forum_category_stats is
  'Los tres contadores de la tarjeta de FORO-01, calculados. No se guardan desnormalizados a proposito: cuatro filas no lo justifican y un contador guardado puede derivar.';

-- -----------------------------------------------------------------------------
-- 6 · RLS
-- -----------------------------------------------------------------------------
alter table public.forum_categories enable row level security;
alter table public.forum_threads    enable row level security;
alter table public.forum_posts      enable row level security;

-- Lo ve cualquier miembro activo: es la definición de foro público de la
-- comunidad. `app.is_active_member()` y no `authenticated` a secas, porque un
-- usuario suspendido sigue teniendo sesión.
create policy forum_categories_select_member on public.forum_categories
  for select to authenticated using (app.is_active_member());

create policy forum_threads_select_member on public.forum_threads
  for select to authenticated using (app.is_active_member());

create policy forum_posts_select_member on public.forum_posts
  for select to authenticated using (app.is_active_member());

-- Escribir: cualquier miembro activo, y solo a su nombre. El `with check` mira
-- lo que el disparador de arriba ya ha corregido, así que las dos piezas dicen
-- lo mismo por dos caminos -- si alguien quita el disparador, la política sigue
-- cortando.
create policy forum_threads_insert_member on public.forum_threads
  for insert to authenticated
  with check (app.is_active_member()
              and author_member_id = auth.uid()
              and author_org_id = app.current_org_id());

create policy forum_posts_insert_member on public.forum_posts
  for insert to authenticated
  with check (app.is_active_member()
              and author_member_id = auth.uid()
              and author_org_id = app.current_org_id());

-- ⚠ Ni UPDATE ni DELETE, en ninguna de las tres tablas ni para nadie. La
-- moderación es de FORO-02/03 y es una decisión de producto sin tomar.

-- -----------------------------------------------------------------------------
-- 7 · GRANTs, y `anon` fuera
-- -----------------------------------------------------------------------------
grant select         on public.forum_categories     to authenticated, service_role;
grant select, insert on public.forum_threads        to authenticated, service_role;
grant select, insert on public.forum_posts          to authenticated, service_role;
grant select         on public.forum_category_stats to authenticated, service_role;
grant insert, update on public.forum_categories     to service_role;

revoke all on public.forum_categories     from anon;
revoke all on public.forum_threads        from anon;
revoke all on public.forum_posts          from anon;
revoke all on public.forum_category_stats from anon;
