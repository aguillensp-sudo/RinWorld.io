-- =============================================================================
-- 0031 · Foro: límite de publicaciones por hora (RNG-FORO-06)
-- =============================================================================
--
-- Precondición de corriente A para FORO-03 (ESTADO-V1.md, 17-sep-2026 §3): la
-- spec del Módulo 08 v1.1 (RNG-FORO-06, sección 8) exige limitar a 10 las
-- publicaciones -hilos y respuestas sumados- que una organización puede crear
-- por HORA NATURAL.
--
-- ⚠ LA PROPIA SPEC SE CONTRADICE A MEDIAS, y se resuelve antes de escribir una
-- sola línea: el `Requirement` (`openspec/specs/community-forum/spec.md`)
-- dice "por hora natural" y su propio `Scenario` dice "en la última hora".
-- Son dos cosas distintas -reloj de pared con corte en :00, o ventana móvil
-- de 60 minutos desde el último post- y no se pueden cumplir las dos a la
-- vez. Aquí manda la REGLA sobre el ejemplo, mismo criterio que F-158/F-170:
-- la ventana es SIEMPRE [HH:00:00, HH:59:59] del reloj, nunca una cuenta
-- atrás desde el post más antiguo. Encaja además con lo que la propia
-- pantalla promete -"Podrás publicar en [X] minutos"-: con hora natural, X es
-- sencillamente el tiempo hasta la próxima hora en punto; con ventana móvil
-- dependería de cuándo caduca cada uno de los diez posts, mucho más difícil
-- de explicar en una frase y de implementar sin guardar más estado.
--
-- QUÉ CUENTA: cualquier fila de `forum_posts` -hilos y respuestas sumados,
-- literal de la spec-, sea la publicación inicial de un hilo nuevo o una
-- respuesta. Las REACCIONES (`forum_reactions`) NO cuentan: no son
-- "publicaciones".
--
-- CÓMO SE HACE CUMPLIR: un disparador BEFORE INSERT en `forum_posts`, con
-- nombre que ordena DESPUÉS de `forum_posts_author` (Postgres ejecuta los
-- disparadores del mismo evento por orden alfabético de nombre; "_author"
-- antes que "_rate_limit"), para que `new.author_org_id` ya lo haya puesto la
-- base y no lo que mandara el cliente.
--
-- ⚠ INVOKER, y NO definer -- al reves de lo que la primera version de esta
-- migracion tenia, y quedo mal en un sitio que solo un Postgres desechable
-- podia cazar: dentro de una funcion `security definer`, `current_user` es el
-- DUEÑO de la funcion (quien aplico la migracion), no quien llama. El bypass
-- "es una siembra, no un usuario" (`current_user in ('service_role',
-- 'postgres')`) se activaba SIEMPRE, para cualquiera, y el limite no limitaba
-- a nadie -- comprobado corriendo la prueba de abajo antes de fiarse de la
-- migracion, exactamente la disciplina que esta seccion pide seguir.
--
-- Que sea invoker no reabre F-148/F-155/F-156: esa familia es sobre una
-- lectura RESTRINGIDA por RLS que decide algo sin que quien llama lo sepa.
-- Aqui la politica de lectura (`forum_posts_select_member`) no restringe por
-- organizacion -- CUALQUIER miembro activo ve TODAS las publicaciones, es un
-- foro publico-, asi que contar por `author_org_id` da el mismo numero sea
-- quien sea que llama: no hay conjunto oculto que un invoker pueda ver de
-- menos. Por eso esta funcion SI entra en la lista auditada de F-155 en
-- `01_schema_smoke.sql`, con esta misma razon escrita alli.
--
-- LO QUE ESTO NO RESUELVE, a propósito: crear un hilo nuevo (FL-FORO-01) es
-- un INSERT en `forum_threads` seguido de un INSERT en `forum_posts` -dos
-- sentencias, no una función atómica-. Si el segundo INSERT lo bloquea este
-- disparador, el hilo queda creado sin ninguna publicación. FL-FORO-01 no
-- existe todavía -FORO-02 y FORO-03 lo dejan fuera de alcance-: quien lo
-- construya decide si envuelve las dos escrituras en una función RPC para
-- que sean atómicas, o si acepta el hilo huérfano. No se decide aquí.
-- =============================================================================

create or replace function app.guard_forum_rate_limit()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  if current_user in ('service_role','postgres') then
    return new;
  end if;

  select count(*) into v_count
    from public.forum_posts
   where author_org_id = new.author_org_id
     and created_at >= date_trunc('hour', now());

  if v_count >= 10 then
    raise exception
      'RNG-FORO-06: tu organizacion ha alcanzado el limite de 10 publicaciones por hora.';
  end if;

  return new;
end;
$$;

comment on function app.guard_forum_rate_limit() is
  'RNG-FORO-06: bloquea la publicacion numero 11 de una organizacion dentro de la misma hora natural (reloj de pared, no ventana movil). Cuenta forum_posts -hilos y respuestas sumados-, nunca forum_reactions.';

create trigger forum_posts_rate_limit
  before insert on public.forum_posts
  for each row execute function app.guard_forum_rate_limit();

-- El estado para que la pantalla lo muestre ANTES de intentar publicar (spec
-- FORO-02 §6 / FORO-03 §6: el botón se bloquea con un mensaje inline, no con
-- un error tras el intento fallido). Devuelve lo que hace falta para "Podrás
-- publicar en X minutos": usadas, límite y segundos hasta que la hora natural
-- cambie -el cliente decide cómo redondear a minutos, esto da la verdad cruda-.
create or replace function app.forum_rate_limit_status()
returns table (used integer, "limit" integer, seconds_until_reset integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    count(*)::integer as used,
    10 as "limit",
    greatest(
      0,
      ceil(extract(epoch from (date_trunc('hour', now()) + interval '1 hour' - now())))
    )::integer as seconds_until_reset
    from public.forum_posts
   where author_org_id = app.current_org_id()
     and created_at >= date_trunc('hour', now());
$$;

comment on function app.forum_rate_limit_status() is
  'RNG-FORO-06: cuantas publicaciones lleva la organizacion de quien llama en la hora natural actual, y cuantos segundos faltan para que cambie. Para pintar el aviso ANTES de que el guardia bloquee el INSERT.';
