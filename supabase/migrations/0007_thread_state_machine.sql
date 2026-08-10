-- =============================================================================
-- 0007 · La máquina de estados del hilo: quien la calcula es la base
-- =============================================================================
-- Fuente de verdad: openspec/specs/messaging-and-negotiation/spec.md
--                   · thread-lifecycle (los cinco estados y sus transiciones)
--                   · offer-card       (los cuatro estados de la oferta)
--
-- POR QUÉ EXISTE ESTA MIGRACIÓN, Y ES UN AGUJERO VIVO (F-044).
--
-- `threads.state` se creó el día 2 con su `default 'ABIERTO'` y su CHECK de cinco
-- valores, y ahí se quedó: **nadie la escribe**. No hay trigger, no hay escritura
-- desde la app —`lib/threads.ts` solo lee— y no hay nada en 0003-0006. Los cinco
-- badges que MSG-01 pinta desde el día 5 son correctos ÚNICAMENTE porque
-- `demo_threads.sql` los escribió a mano, uno por estado. En cuanto alguien envíe
-- una oferta de verdad, el badge no se mueve.
--
-- Es el patrón de F-023 con la peor cara: no es una promesa vacía que se ve
-- vacía, es un dato que existe, sale bien formateado y ha dejado de significar lo
-- que dice. `thread-lifecycle` exige justo lo contrario: *"calculando toda
-- transición exclusivamente a partir de metadatos de tipo de elemento y estado de
-- tarjeta, sin requerir descifrado de contenido"*.
--
-- POR QUÉ EN LA BASE Y NO EN EL CLIENTE.
--
-- El hilo lo tocan DOS organizaciones desde dos navegadores, y el día 7 entra
-- Realtime (`Plan §3`). Si el estado lo calcula el cliente, dos clientes pueden
-- discrepar y gana el último que escribe — sobre el dato que ordena la lista de
-- hilos y pinta su badge. Calculado aquí, el estado es una FUNCIÓN de las filas y
-- no puede derivar. Es además el patrón que ya usa este esquema dos veces:
-- `app.touch_thread_last_item` y `app.guard_offer_terminal_state`.
--
-- LO QUE ESTA MIGRACIÓN NO HACE, A PROPÓSITO: `RETIRADA`.
--
-- `Plan §7` dibuja una máquina de SEIS estados —BORRADOR, ENVIADA,
-- CONTRAOFERTADA, ACEPTADA, RECHAZADA, RETIRADA— de la que no coincide ni un
-- literal con los CUATRO de `offer-card` y del CHECK de 0003. El diagrama del
-- plan es anterior al SDD y manda el spec cerrado (F-043). De los seis, el único
-- que es una necesidad comercial real y no una diferencia de vocabulario es
-- `RETIRADA` —retirar una oferta antes de que la acepten—, y **no se añade aquí
-- porque no está en la capability**: es decisión del PO y son otra migración y
-- otro valor en el CHECK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Cuándo cambió de estado una tarjeta
--
-- La derivación necesita saber si el acuerdo que ve es POSTERIOR a la última
-- reversión, y `created_at` no sirve: dice cuándo se creó la oferta, no cuándo se
-- aceptó. Sin esta columna, revertir un acuerdo y luego enviar un mensaje
-- cualquiera volvería a poner el hilo en ACUERDO ALCANZADO — la reversión duraría
-- hasta el siguiente elemento y nadie sabría por qué.
--
-- Es dato en claro y es metadato: `thread-lifecycle` calcula sin descifrar.
-- -----------------------------------------------------------------------------
alter table public.thread_items
  add column if not exists estado_changed_at timestamptz;

comment on column public.thread_items.estado_changed_at is
  'Cuando cambio por ultima vez estado_oferta/estado_consulta. METADATO EN CLARO. Lo mantiene app.touch_item_estado; lo usa app.derive_thread_state para distinguir un acuerdo vigente de uno ya revertido.';

create or replace function app.touch_item_estado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado_oferta is not null or new.estado_consulta is not null then
      new.estado_changed_at := now();
    end if;
  elsif new.estado_oferta   is distinct from old.estado_oferta
     or new.estado_consulta is distinct from old.estado_consulta then
    new.estado_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists thread_items_touch_estado on public.thread_items;
create trigger thread_items_touch_estado
  before insert or update on public.thread_items
  for each row execute function app.touch_item_estado();

-- Las filas que ya existen (la siembra del día 5) nacen con su marca puesta.
update public.thread_items
   set estado_changed_at = created_at
 where estado_changed_at is null
   and (estado_oferta is not null or estado_consulta is not null);

-- -----------------------------------------------------------------------------
-- 2 · La reversión del acuerdo
--
-- `thread-lifecycle`: *"cualquiera de las dos partes solicita revertir el acuerdo
-- → el hilo transiciona de vuelta a ABIERTO, siempre disponible, sin
-- restricciones ni periodo de gracia"*.
--
-- La oferta aceptada NO se reescribe: su estado es terminal y `app.
-- guard_offer_terminal_state` lo impide desde 0003, que es la mitad de "sin
-- eliminarse del historial". Así que la reversión se marca en el hilo, con su
-- instante, y la derivación la respeta.
-- -----------------------------------------------------------------------------
alter table public.threads
  add column if not exists agreement_reverted_at timestamptz;

comment on column public.threads.agreement_reverted_at is
  'Instante de la ultima reversion de ACUERDO ALCANZADO (thread-lifecycle). La oferta aceptada no se toca: su estado es terminal.';

-- -----------------------------------------------------------------------------
-- 3 · La derivación
--
-- Las cuatro reglas, en orden de prioridad. Salen literalmente de los escenarios
-- de `thread-lifecycle`, y el orden importa: es lo que hace que el escenario del
-- rechazo salga solo, con sus dos ramas y sin escribirlas aparte.
--
--   1. Hay una oferta Pendiente            -> CON OFERTA PENDIENTE
--   2. Hay una consulta Pendiente          -> CON CONSULTA PENDIENTE
--   3. Hay una oferta Aceptada vigente     -> ACUERDO ALCANZADO
--   4. Nada de lo anterior                 -> ABIERTO
--
-- Comprobado contra los escenarios del spec, uno a uno:
--
--  · "transición a CON OFERTA PENDIENTE": la oferta nace Pendiente -> regla 1.
--  · "aceptación de oferta": deja de haber pendientes y la aceptada es vigente
--    -> regla 3.
--  · "rechazo — el hilo vuelve a su estado previo": la regla 1 ya no aplica; si
--    quedaba otra consulta pendiente entra la 2 (CON CONSULTA PENDIENTE) y si no,
--    la 3 no aplica —la última terminal es Rechazada, no Aceptada— y cae en
--    ABIERTO. **Las dos ramas que el spec enumera salen del orden, no de un caso
--    especial.** Un `if` escrito a mano para cada rama es donde se cuela el que
--    falta.
--  · "contraoferta": la anterior pasa a Superada y la nueva nace Pendiente
--    -> regla 1, el hilo se queda en CON OFERTA PENDIENTE. Correcto: el spec dice
--    "permanece en CON OFERTA PENDIENTE, ahora referido a la nueva oferta".
--
-- `CERRADO SIN ACUERDO` no está en la derivación y no es un olvido: es una
-- transición MANUAL. Ver §4.
-- -----------------------------------------------------------------------------
create or replace function app.derive_thread_state(t_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when exists (
      select 1 from public.thread_items i
       where i.thread_id = t_id and i.item_type = 'OFERTA'
         and i.estado_oferta = 'Pendiente'
    ) then 'CON OFERTA PENDIENTE'

    when exists (
      select 1 from public.thread_items i
       where i.thread_id = t_id and i.item_type = 'CONSULTA'
         and i.estado_consulta = 'Pendiente'
    ) then 'CON CONSULTA PENDIENTE'

    when exists (
      select 1 from public.thread_items i, public.threads t
       where t.id = t_id and i.thread_id = t_id
         and i.item_type = 'OFERTA' and i.estado_oferta = 'Aceptada'
         -- Vigente = aceptada DESPUÉS de la última reversión.
         and coalesce(i.estado_changed_at, i.created_at)
             > coalesce(t.agreement_reverted_at, '-infinity'::timestamptz)
    ) then 'ACUERDO ALCANZADO'

    else 'ABIERTO'
  end;
$$;

revoke execute on function app.derive_thread_state(uuid) from public;
grant  execute on function app.derive_thread_state(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4 · El trigger
--
-- Se dispara con cualquier cambio en los elementos del hilo, que es lo único de
-- lo que depende la derivación.
--
-- **`CERRADO SIN ACUERDO` se respeta y no se recalcula.** El spec lo describe
-- como cierre manual y no dice qué pasa si después llega un elemento. Se resuelve
-- por lo conservador: cerrar un hilo es un acto deliberado y que se reabra solo
-- porque alguien mandó un mensaje lo vacía de sentido. Para volver, hay que
-- reabrirlo a mano. Queda como pregunta abierta al PO por si la quiere al revés.
-- -----------------------------------------------------------------------------
create or replace function app.sync_thread_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t_id  uuid := coalesce(new.thread_id, old.thread_id);
  actual text;
  nuevo  text;
begin
  select state into actual from public.threads where id = t_id;
  if actual = 'CERRADO SIN ACUERDO' then
    return null;
  end if;

  nuevo := app.derive_thread_state(t_id);
  if nuevo is distinct from actual then
    update public.threads set state = nuevo where id = t_id;
  end if;
  return null;
end;
$$;

drop trigger if exists thread_items_sync_state on public.thread_items;
create trigger thread_items_sync_state
  after insert or update or delete on public.thread_items
  for each row execute function app.sync_thread_state();

-- -----------------------------------------------------------------------------
-- 5 · Qué puede escribir el cliente en `threads.state`
--
-- `threads_update_participant` (0003) deja a un participante actualizar su hilo,
-- y sin acotarlo eso incluye **poner el estado que le dé la gana** — por ejemplo
-- ACUERDO ALCANZADO sin que exista ninguna oferta aceptada. El estado es el dato
-- que la otra parte lee como verdad sobre la negociación, así que no puede ser
-- de escritura libre.
--
-- Desde el cliente solo caben las DOS transiciones manuales del spec:
--   · a `CERRADO SIN ACUERDO` — cierre manual.
--   · a `ABIERTO`             — reversión del acuerdo y reapertura del cierre.
-- El resto lo pone la derivación, y el trigger pasa porque es SECURITY DEFINER.
--
-- La reversión, además, tiene que dejar su marca: si se pone ABIERTO viniendo de
-- ACUERDO ALCANZADO sin sellar `agreement_reverted_at`, el siguiente elemento del
-- hilo lo devuelve a ACUERDO ALCANZADO por la regla 3. Se sella aquí y no se le
-- pide al cliente: un invariante que depende de que quien llama se acuerde no es
-- un invariante.
-- -----------------------------------------------------------------------------
create or replace function app.guard_thread_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  if new.state is distinct from old.state then
    if new.state not in ('CERRADO SIN ACUERDO','ABIERTO') then
      raise exception
        'Desde el cliente solo se cierra el hilo o se revierte a ABIERTO; el resto del ciclo lo deriva la base (thread-lifecycle).';
    end if;

    if old.state = 'ACUERDO ALCANZADO' and new.state = 'ABIERTO' then
      new.agreement_reverted_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists threads_guard_state on public.threads;
create trigger threads_guard_state
  before update on public.threads
  for each row execute function app.guard_thread_state();

-- -----------------------------------------------------------------------------
-- 6 · Poner al día lo que ya existe
--
-- La siembra del día 5 escribió los cinco estados a mano, uno por hilo, para que
-- MSG-01 tuviera un ejemplo de cada badge. Ahora que hay derivación, esos valores
-- pasan a ser una afirmación comprobable: se recalculan desde sus elementos.
--
-- Los hilos CERRADO SIN ACUERDO se dejan como están — es transición manual y la
-- derivación no la produce (§4).
-- -----------------------------------------------------------------------------
update public.threads t
   set state = app.derive_thread_state(t.id)
 where t.state <> 'CERRADO SIN ACUERDO'
   and t.state is distinct from app.derive_thread_state(t.id);
