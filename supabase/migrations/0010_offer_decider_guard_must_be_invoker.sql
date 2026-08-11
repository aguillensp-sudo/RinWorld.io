-- =============================================================================
-- 0010 · La guardia del decisor se desactivaba a sí misma
-- =============================================================================
-- Corrige un defecto de 0008. Ver F-056.
--
-- QUÉ PASABA.
--
-- `app.guard_offer_decider` se creó `security definer`, y empieza con la exención
-- de siempre para la siembra y el operador:
--
--   if current_user in ('service_role','postgres') or auth.uid() is null then
--     return new;
--   end if;
--
-- Dentro de una función `SECURITY DEFINER`, **`current_user` es el dueño de la
-- función, no quien la llama** — y el dueño es `postgres`. Es decir: la primera
-- línea de la guardia se cumplía SIEMPRE, para todo el mundo, y la guardia
-- devolvía `new` sin mirar nada más. **Nunca bloqueó a nadie.**
--
-- Comprobado en un Postgres pelado antes de escribir esto, para no volver a
-- diagnosticar de oídas:
--
--   dentro de SECURITY DEFINER, current_user = postgres
--   dentro de SECURITY INVOKER, current_user = authenticated
--
-- Con lo cual el agujero de F-051 —una organización aceptando su propia oferta—
-- siguió abierto en el remoto desde que 0008 se aplicó, con la migración puesta y
-- el trigger habilitado. Un objeto que existe y no hace nada es peor que uno que
-- falta: el que falta se ve.
--
-- LO QUE DUELE, Y POR ESO SE ESCRIBE AQUÍ.
--
-- **Esto ya estaba avisado en este mismo repositorio, siete migraciones antes.**
-- `0001_organizations_and_members.sql:219` lleva desde el día 2 el comentario:
--
--   -- OJO: este trigger NO puede ser SECURITY DEFINER. Con SECURITY DEFINER,
--   -- `current_user` pasa a ser el dueño de la función (postgres) y la guarda se
--   -- desactivaría siempre a sí misma. […] Tampoco necesita privilegios: solo lee
--   -- OLD y NEW.
--
-- Y `0005` lo repite. De las cuatro funciones del esquema que usan esa exención,
-- las tres del día 2 son `SECURITY INVOKER` — correctas — y la única `DEFINER` era
-- la de ayer. El aviso estaba escrito, en el sitio correcto, y no se leyó.
--
-- EL ARREGLO.
--
-- `SECURITY INVOKER`, que es el que hace falta: la función solo lee `OLD` y `NEW` y
-- llama a `app.current_org_id()`, que ya está concedida a `authenticated`. No
-- necesita privilegios de nadie. `create or replace` sin la cláusula la deja en
-- invoker, que es el valor por defecto.
--
-- Y esta vez va con asertos: `01_schema_smoke.sql` prueba que el emisor recibe
-- excepción al aceptar su propia oferta **y** que el receptor sí puede aceptarla.
-- El primero de los dos es el que habría cazado esto el día 6.
-- =============================================================================

create or replace function app.guard_offer_decider()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  quien uuid;
begin
  -- La siembra y el operador entran por aquí: no hay sesión de usuario que mirar.
  -- SIN `security definer`, y no es un olvido: ver la cabecera.
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  if old.item_type <> 'OFERTA' then
    return new;
  end if;

  -- Solo se vigila la SALIDA de `Pendiente`. Lo demás ya lo corta
  -- `app.guard_offer_terminal_state`, que no deja mover un terminal.
  if old.estado_oferta = 'Pendiente'
     and new.estado_oferta is distinct from old.estado_oferta then

    quien := app.current_org_id();

    if quien = old.sender_org_id then
      raise exception
        'Una oferta la decide quien la recibe (offer-card). La organizacion % la emitio: no puede aceptarla, rechazarla ni marcarla superada.',
        old.sender_org_id;
    end if;
  end if;

  return new;
end;
$$;

comment on function app.guard_offer_decider() is
  'offer-card: solo el receptor mueve una oferta Pendiente. NO puede ser SECURITY DEFINER: current_user seria el dueno de la funcion y la guardia se desactivaria a si misma (F-056).';
