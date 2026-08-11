-- =============================================================================
-- 0008 · La oferta la decide quien la recibe, no quien la emite
-- =============================================================================
-- Fuente de verdad: openspec/specs/messaging-and-negotiation/spec.md · offer-card
--
-- EL AGUJERO, Y POR QUÉ NO LO VEÍA NADIE.
--
-- `offer-card` dice lo mismo en sus tres escenarios de decisión: *"una tarjeta de
-- oferta con estado_oferta=Pendiente, **recibida** y visible para el receptor,
-- cuando **el receptor** pulsa Aceptar / Rechazar / responde con contraoferta"*.
-- Quien pone el precio no cierra el trato solo: es lo único que hace que una
-- negociación sea una negociación.
--
-- Nada lo impedía. `thread_items_update_participant` (0003) deja escribir a las
-- DOS partes —y tiene que hacerlo, porque el receptor no es el dueño de la fila—,
-- el CHECK solo mira que el literal esté entre los cuatro, y
-- `app.guard_offer_terminal_state` solo mira que no se reescriba un terminal.
-- Ninguno mira **quién firma**. Con eso, una organización podía aceptar su propia
-- oferta y el hilo pasaba a ACUERDO ALCANZADO sin que la otra parte tocara nada.
--
-- Y no lo cazaba ningún test porque la pantalla nunca pinta ese botón: la regla
-- vivía solo en `offerActions()` del cliente. Una regla que solo existe en el
-- navegador no es una regla — es una sugerencia que se salta cualquiera que llame
-- a PostgREST directamente, y el repositorio es público.
--
-- Es el mismo patrón que el aviso de `Dia-04 §4` sobre las dos políticas
-- permisivas de `inventory_lines`: RLS protege de leer lo que no toca, pero no
-- decide por ti qué es legal escribir. Ver F-051.
-- =============================================================================

create or replace function app.guard_offer_decider()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quien uuid;
begin
  -- La siembra y el operador entran por aquí: no hay sesión de usuario que mirar.
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

create trigger thread_items_guard_decider
  before update on public.thread_items
  for each row execute function app.guard_offer_decider();

-- -----------------------------------------------------------------------------
-- El orden de los dos guardias importa y por eso este trigger se llama así.
--
-- Postgres dispara los triggers `BEFORE ... FOR EACH ROW` en orden ALFABÉTICO de
-- nombre, y los de esta tabla quedan:
--
--   thread_items_guard_decider   <- 0008, este
--   thread_items_guard_terminal  <- 0003
--   thread_items_sync_state      <- 0007 (AFTER, no compite)
--   thread_items_touch_estado    <- 0007 (BEFORE, solo sella la marca)
--   thread_items_validate        <- 0003
--
-- `decider` va antes que `terminal` por casualidad alfabética, no por diseño, y
-- da igual: los dos levantan excepción y cualquiera de los dos que salte aborta
-- la sentencia. Se anota para que nadie renombre uno de los dos dando por hecho
-- que el orden es libre — el día que uno de ellos deje de lanzar y pase a
-- corregir el valor, dejará de darlo.
-- -----------------------------------------------------------------------------

comment on function app.guard_offer_decider() is
  'offer-card: solo el receptor mueve una oferta Pendiente. RLS deja escribir a las dos partes porque el receptor no es dueno de la fila; esto acota QUE puede escribir cada una.';
