-- 0068 · F-256 · registro de `usage` de VERA y cupo por usuario y hora.
--
-- Hasta aquí el proxy de VERA (`supabase/functions/vera/index.ts`) tenía tope de TAMAÑO por petición, pero
-- ninguno de FRECUENCIA: cualquier miembro con sesión podía usarlo como una API de Sonnet abierta, pagada con la
-- clave de la plataforma. Y la función devolvía `usage` sin que nadie lo guardara, así que no se sabía cuánto
-- cuesta VERA en uso real (ESTADO-V1 §6).
--
-- Diseño, y por qué así:
--
-- 1. **Una fila por LLAMADA al modelo, no por pregunta.** Una pregunta son de 1 a 7 llamadas (las vueltas de
--    herramienta de `MAX_STEPS`). El cupo cuenta llamadas porque es lo único que el cliente no puede disfrazar:
--    «pregunta nueva» o «vuelta de herramienta» lo dice el cuerpo de la petición, que escribe el cliente.
--    `es_pregunta` se guarda solo para medir (coste por pregunta), nunca para decidir.
--
-- 2. **El proxy llama a estas funciones con el JWT del USUARIO, no con la clave de servicio.** D-09-05 dejó la
--    función sin acceso a la base para que comprometerla no expusiera ni una fila de nadie; eso se mantiene:
--    con el JWT del usuario solo puede abrir y cerrar turnos SUYOS. El precio, dicho: el usuario puede llamar a
--    `vera_cerrar_turno` él mismo y falsear los tokens de SUS filas antes de que lo haga el proxy. El cupo no se
--    salta así (cuenta filas al ABRIR, y nadie puede borrarlas), y el proxy registra en su log cuándo encontró
--    su turno ya cerrado. Para el arranque se acepta; si las cifras de coste llegan a facturarse, se revisa.
--
-- 3. **El cupo vive aquí, en una constante** (`vera_cupo_por_hora()`), y no en la función de Deno: así se
--    cambia con una migración revisada y el banco lo prueba. Ventana deslizante de 60 minutos.
--
-- 4. **Nadie lee la tabla salvo el Operador de Plataforma** (`0028`). Los miembros no ven ni su propio
--    consumo: no hay pantalla que lo pida, y cada SELECT que se abre es uno más que cerrar después (F-192).
--
-- Escrito por Claude Code.

-- -----------------------------------------------------------------------------
-- 1 · La tabla
-- -----------------------------------------------------------------------------
create table if not exists public.vera_usage (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null,
  org_id                      uuid,            -- null para el Operador de Plataforma, que no tiene organización
  es_pregunta                 boolean not null default true,
  created_at                  timestamptz not null default now(),
  closed_at                   timestamptz,
  ok                          boolean,         -- null mientras el turno está abierto
  model                       text,
  stop_reason                 text,
  input_tokens                integer check (input_tokens >= 0),
  output_tokens               integer check (output_tokens >= 0),
  cache_creation_input_tokens integer check (cache_creation_input_tokens >= 0),
  cache_read_input_tokens     integer check (cache_read_input_tokens >= 0)
);

create index if not exists vera_usage_user_created_idx on public.vera_usage (user_id, created_at desc);

alter table public.vera_usage enable row level security;

-- Las default privileges de la plataforma abren las tablas nuevas a `anon` y `authenticated` (ver `0028`).
-- Se cierra todo y se abre solo el SELECT, que la política deja en manos del operador.
revoke all on public.vera_usage from public, anon, authenticated;
grant select on public.vera_usage to authenticated;

drop policy if exists vera_usage_select_operator on public.vera_usage;
create policy vera_usage_select_operator on public.vera_usage
  for select to authenticated
  using ((select app.is_platform_operator()));

-- -----------------------------------------------------------------------------
-- 2 · El cupo
-- -----------------------------------------------------------------------------
-- 150 llamadas en 60 minutos ≈ entre 20 y 150 preguntas, según cuántas vueltas de herramienta lleve cada una.
-- Con la caché caliente una llamada cuesta ~0,008 $ (ESTADO-V1 §6), así que el techo por usuario ronda 1–3 $/h.
create or replace function public.vera_cupo_por_hora()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$ select 150 $$;

-- -----------------------------------------------------------------------------
-- 3 · Abrir un turno: comprueba el cupo y, si cabe, deja la fila contada
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4 · Cerrar un turno: el `usage` que devolvió el modelo, una sola vez y solo el propio
-- -----------------------------------------------------------------------------
create or replace function public.vera_cerrar_turno(
  p_turno         uuid,
  p_ok            boolean,
  p_model         text    default null,
  p_stop_reason   text    default null,
  p_input         integer default null,
  p_output        integer default null,
  p_cache_write   integer default null,
  p_cache_read    integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'VERA necesita una sesión' using errcode = '28000';
  end if;

  update public.vera_usage
     set closed_at                   = now(),
         ok                          = coalesce(p_ok, false),
         model                       = left(p_model, 64),
         stop_reason                 = left(p_stop_reason, 32),
         input_tokens                = p_input,
         output_tokens               = p_output,
         cache_creation_input_tokens = p_cache_write,
         cache_read_input_tokens     = p_cache_read
   where id = p_turno and user_id = auth.uid() and closed_at is null;

  -- `false` = no era suyo, no existía o ya estaba cerrado. El proxy lo registra en su log (ver cabecera, punto 2).
  return found;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5 · Privilegios: solo `authenticated`; `anon` no ejecuta nada de `public` (0022)
-- -----------------------------------------------------------------------------
revoke execute on function public.vera_cupo_por_hora()           from public, anon;
revoke execute on function public.vera_abrir_turno(boolean)      from public, anon;
revoke execute on function public.vera_cerrar_turno(uuid, boolean, text, text, integer, integer, integer, integer)
  from public, anon;
grant  execute on function public.vera_cupo_por_hora()           to authenticated;
grant  execute on function public.vera_abrir_turno(boolean)      to authenticated;
grant  execute on function public.vera_cerrar_turno(uuid, boolean, text, text, integer, integer, integer, integer)
  to authenticated;
