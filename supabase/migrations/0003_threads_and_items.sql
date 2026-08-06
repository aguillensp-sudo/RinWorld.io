-- =============================================================================
-- 0003 · Hilos, tarjetas y las tres máquinas de estados
-- =============================================================================
-- Fuente de verdad: openspec/specs/messaging-and-negotiation/spec.md
--                   openspec/mvp/Dia-02_decisiones_esquema.md §1.2 y §3
--
-- LOS VALORES DE ESTADO SON LOS DEL SPEC, LITERALES. Decisión del PO del
-- 6-ago-2026: manda el spec cerrado. Lo importante de `offer-card`:
-- "Superada por contraoferta" es TERMINAL — la contraoferta es una FILA NUEVA
-- que nace 'Pendiente' y la anterior "no se elimina del historial". Nunca se
-- reutiliza la fila.
--
-- RNG-MSG-02, que gobierna toda esta migración: ninguna transición de estado del
-- hilo puede requerir descifrar contenido. Por eso los estados, los
-- participantes, la referencia y la marca están en claro, y todo lo demás no.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- threads · single-thread-model
--
-- Un único hilo por PAR de organizaciones. Se impone con orden canónico
-- (org_low < org_high) más índice único: así "reutiliza el hilo existente ante
-- cualquier vía de contacto" es una invariante de la base de datos, no una
-- comprobación que se pueda olvidar en la aplicación.
-- -----------------------------------------------------------------------------
create table public.threads (
  id                uuid primary key default gen_random_uuid(),
  org_low_id        uuid not null references public.organizations (id) on delete cascade,
  org_high_id       uuid not null references public.organizations (id) on delete cascade,
  -- Quién lo inició: lo necesita el límite de 25 hilos nuevos por día natural.
  created_by_org_id uuid not null references public.organizations (id) on delete cascade,

  -- thread-lifecycle. Entró en el DDL de hoy por decisión del PO (6-ago) aunque
  -- ESTADO.md no lo listaba: es igual de irreversible y evita migración el día 7.
  state             text not null default 'ABIERTO',

  created_at        timestamptz not null default now(),
  last_item_at      timestamptz not null default now(),

  constraint threads_canonical_order_chk check (org_low_id < org_high_id),
  constraint threads_creator_is_participant_chk check (
    created_by_org_id in (org_low_id, org_high_id)
  ),
  constraint threads_state_chk check (
    state in ('ABIERTO','CON CONSULTA PENDIENTE','CON OFERTA PENDIENTE',
              'ACUERDO ALCANZADO','CERRADO SIN ACUERDO')
  )
);

create unique index threads_pair_uniq on public.threads (org_low_id, org_high_id);
create index threads_org_low_idx  on public.threads (org_low_id, last_item_at desc);
create index threads_org_high_idx on public.threads (org_high_id, last_item_at desc);
create index threads_creator_day_idx on public.threads (created_by_org_id, created_at);

-- thread-rate-limiting: 25 hilos NUEVOS por organización y día natural. No afecta
-- al envío de elementos en hilos ya existentes — de ahí que el trigger esté en
-- `threads` y no en `thread_items`.
create or replace function app.check_thread_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  select count(*) into n
  from public.threads
  where created_by_org_id = new.created_by_org_id
    and created_at >= date_trunc('day', now())
    and created_at <  date_trunc('day', now()) + interval '1 day';

  if n >= 25 then
    raise exception
      'Límite diario alcanzado: 25 hilos nuevos por día natural (thread-rate-limiting). Los hilos ya existentes no se ven afectados.';
  end if;
  return new;
end;
$$;

create trigger threads_rate_limit
  before insert on public.threads
  for each row execute function app.check_thread_rate_limit();

-- -----------------------------------------------------------------------------
-- thread_items · mensajes libres, tarjetas de consulta y tarjetas de oferta,
-- mezclados cronológicamente en el mismo hilo.
-- -----------------------------------------------------------------------------
create table public.thread_items (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references public.threads (id) on delete cascade,
  sender_org_id     uuid not null references public.organizations (id) on delete restrict,
  sender_member_id  uuid not null references public.members (id) on delete restrict,
  item_type         text not null,
  created_at        timestamptz not null default now(),

  -- ── METADATO EN CLARO ────────────────────────────────────────────────────
  -- part_number y brand en claro no es una concesión: VND-01 pinta la columna
  -- Referencia sin descifrar, y VERA notifica "organización y referencia sin
  -- revelar la cantidad".
  part_number       text,
  brand             text,

  -- Línea de inventario consultada. Sostiene dos reglas: una sola consulta por
  -- línea y comprador, y el reseteo del marcado tras reemplazo total (la línea
  -- nueva tiene id nuevo, así que la restricción no la alcanza).
  inventory_line_id uuid references public.inventory_lines (id) on delete set null,

  estado_consulta   text,
  estado_oferta     text,

  -- La oferta que responde a una consulta.
  responds_to_item_id uuid references public.thread_items (id) on delete set null,
  -- La contraoferta que superó a esta oferta. Apunta hacia adelante; la fila
  -- vieja no se toca más.
  superseded_by_item_id uuid references public.thread_items (id) on delete set null,

  -- ── CONTENIDO CIFRADO ────────────────────────────────────────────────────
  -- Un único blob por elemento: el texto del mensaje libre, o la cantidad de la
  -- consulta, o TODAS las cifras de la oferta (unit_price, currency, quantity,
  -- lead_time_days, shipping_cost, shipping_cost_currency, valid_until, notes),
  -- serializadas y cifradas con AES-256-GCM. Un blob y no una columna por campo
  -- porque nada del servidor necesita granularidad: todo lo que el servidor usa
  -- está arriba, en claro. Menos superficie y menos fuga por longitud de campo.
  content_ciphertext bytea not null,
  content_iv         bytea not null,

  constraint thread_items_type_chk check (item_type in ('MENSAJE','CONSULTA','OFERTA')),
  constraint thread_items_iv_len_chk check (octet_length(content_iv) = 12),

  -- offer-card · los cuatro estados del spec, literales.
  constraint thread_items_estado_oferta_chk check (
    estado_oferta is null
    or estado_oferta in ('Pendiente','Aceptada','Rechazada','Superada por contraoferta')
  ),
  -- inquiry-card + offer-card: la consulta pasa a "Respondida con oferta".
  constraint thread_items_estado_consulta_chk check (
    estado_consulta is null
    or estado_consulta in ('Pendiente','Respondida con oferta')
  ),

  -- Cada tipo de elemento lleva exactamente los metadatos que le tocan.
  constraint thread_items_shape_chk check (
    case item_type
      when 'MENSAJE' then
        part_number is null and brand is null and inventory_line_id is null
        and estado_consulta is null and estado_oferta is null
        and responds_to_item_id is null and superseded_by_item_id is null
      when 'CONSULTA' then
        part_number is not null and brand is not null
        and estado_consulta is not null and estado_oferta is null
        and responds_to_item_id is null and superseded_by_item_id is null
      when 'OFERTA' then
        part_number is not null and brand is not null
        and estado_oferta is not null and estado_consulta is null
        and inventory_line_id is null
      else false
    end
  ),

  -- "Superada por contraoferta" y el puntero a la contraoferta son la misma cosa:
  -- si hay uno tiene que haber el otro.
  constraint thread_items_superseded_coherent_chk check (
    (estado_oferta = 'Superada por contraoferta') = (superseded_by_item_id is not null)
  ),
  constraint thread_items_no_self_ref_chk check (
    superseded_by_item_id is distinct from id and responds_to_item_id is distinct from id
  )
);

create index thread_items_thread_idx on public.thread_items (thread_id, created_at);
create index thread_items_pending_offers_idx
  on public.thread_items (thread_id) where item_type = 'OFERTA' and estado_oferta = 'Pendiente';
create index thread_items_pending_inquiries_idx
  on public.thread_items (thread_id) where item_type = 'CONSULTA' and estado_consulta = 'Pendiente';

-- inquiry-card: "bloqueando el envío de una segunda consulta sobre la misma línea
-- de inventario por el mismo comprador". Se aplica a nivel de ORGANIZACIÓN
-- compradora — el aviso de SRCH-01 dice "Ya has consultado esta referencia con
-- este distribuidor", que se lee como la organización, no el usuario concreto.
create unique index thread_items_one_inquiry_per_line_uniq
  on public.thread_items (inventory_line_id, sender_org_id)
  where item_type = 'CONSULTA' and inventory_line_id is not null;

-- El emisor tiene que pertenecer a una de las dos organizaciones del hilo, y el
-- miembro emisor a la organización emisora. Sin esto, un cliente podría escribir
-- en nombre de otro.
create or replace function app.validate_thread_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t record;
  m_org uuid;
begin
  select org_low_id, org_high_id into t from public.threads where id = new.thread_id;
  if new.sender_org_id not in (t.org_low_id, t.org_high_id) then
    raise exception 'sender_org_id no participa en el hilo %', new.thread_id;
  end if;

  select org_id into m_org from public.members where id = new.sender_member_id;
  if m_org is distinct from new.sender_org_id then
    raise exception 'sender_member_id no pertenece a sender_org_id';
  end if;

  return new;
end;
$$;

create trigger thread_items_validate
  before insert or update on public.thread_items
  for each row execute function app.validate_thread_item();

-- Los tres estados terminales de la oferta no se mueven. Es la mitad de
-- "sin eliminarse del historial": no basta con no borrar la fila, hay que no
-- reescribirla.
create or replace function app.guard_offer_terminal_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.item_type = 'OFERTA'
     and old.estado_oferta in ('Aceptada','Rechazada','Superada por contraoferta')
     and new.estado_oferta is distinct from old.estado_oferta then
    raise exception
      'estado_oferta "%" es terminal (offer-card). Una contraoferta es una fila nueva, no un cambio de estado de esta.',
      old.estado_oferta;
  end if;
  return new;
end;
$$;

create trigger thread_items_guard_terminal
  before update on public.thread_items
  for each row execute function app.guard_offer_terminal_state();

create or replace function app.touch_thread_last_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.threads set last_item_at = new.created_at where id = new.thread_id;
  return null;
end;
$$;

create trigger thread_items_touch_thread
  after insert on public.thread_items
  for each row execute function app.touch_thread_last_item();

-- -----------------------------------------------------------------------------
-- thread_item_keys · la clave de contenido, envuelta por destinatario
--
-- Por qué hace falta esta tabla: e2ee-content-encryption cifra "usando las claves
-- X25519 DEL MIEMBRO", pero el hilo es entre ORGANIZACIONES, y una organización
-- tiene un ADMIN más N EDITOR. Un ECDH directo entre dos personas dejaría fuera
-- al resto de su propia organización. Así que cada elemento tiene su clave de
-- contenido (CEK) y se guarda envuelta una vez por cada miembro que debe leerla.
--
-- En el MVP hay un miembro por organización y la tabla tendrá dos filas por
-- elemento. Existe desde hoy para que el día 8 no sea una migración de datos
-- cifrados, que es la peor clase de migración.
-- -----------------------------------------------------------------------------
create table public.thread_item_keys (
  item_id             uuid not null references public.thread_items (id) on delete cascade,
  recipient_member_id uuid not null references public.members (id) on delete cascade,

  -- CEK envuelta para este miembro: ECDH X25519 (efímera × pública del miembro)
  -- → AES-256-GCM. Es el esquema que SP-2 validó en el navegador (F-008).
  wrapped_cek       bytea not null,
  wrap_iv           bytea not null,
  ephemeral_pubkey  bytea not null,

  created_at        timestamptz not null default now(),

  primary key (item_id, recipient_member_id),
  constraint thread_item_keys_wrap_iv_len_chk check (octet_length(wrap_iv) = 12),
  constraint thread_item_keys_eph_len_chk check (octet_length(ephemeral_pubkey) = 32)
);

create index thread_item_keys_recipient_idx on public.thread_item_keys (recipient_member_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.threads          enable row level security;
alter table public.thread_items     enable row level security;
alter table public.thread_item_keys enable row level security;

create or replace function app.can_access_thread(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.threads t
    where t.id = t_id
      and app.current_org_id() in (t.org_low_id, t.org_high_id)
  );
$$;

revoke execute on function app.can_access_thread(uuid) from public;
grant  execute on function app.can_access_thread(uuid) to authenticated;

create policy threads_select_participant on public.threads
  for select to authenticated
  using (app.current_org_id() in (org_low_id, org_high_id));

create policy threads_insert_participant on public.threads
  for insert to authenticated
  with check (
    app.is_active_member()
    and created_by_org_id = app.current_org_id()
    and app.current_org_id() in (org_low_id, org_high_id)
  );

create policy threads_update_participant on public.threads
  for update to authenticated
  using (app.current_org_id() in (org_low_id, org_high_id) and app.is_active_member())
  with check (app.current_org_id() in (org_low_id, org_high_id));

create policy thread_items_select_participant on public.thread_items
  for select to authenticated
  using (app.can_access_thread(thread_id));

create policy thread_items_insert_own on public.thread_items
  for insert to authenticated
  with check (
    app.is_active_member()
    and sender_member_id = auth.uid()
    and sender_org_id = app.current_org_id()
    and app.can_access_thread(thread_id)
  );

-- Ambas partes pueden mover estados (aceptar, rechazar, marcar superada), pero
-- el guard de terminales y los CHECK acotan qué movimientos son legales.
create policy thread_items_update_participant on public.thread_items
  for update to authenticated
  using (app.can_access_thread(thread_id) and app.is_active_member())
  with check (app.can_access_thread(thread_id));

-- Nadie ve una clave envuelta que no sea la suya. Ni el otro miembro de su propia
-- organización: la CEK va envuelta por persona.
create policy item_keys_select_own on public.thread_item_keys
  for select to authenticated
  using (recipient_member_id = auth.uid());

-- El emisor deposita las claves envueltas de ambas partes al crear el elemento.
create policy item_keys_insert_sender on public.thread_item_keys
  for insert to authenticated
  with check (
    app.is_active_member()
    and exists (
      select 1 from public.thread_items i
      where i.id = item_id
        and i.sender_member_id = auth.uid()
        and app.can_access_thread(i.thread_id)
    )
  );

grant select, insert, update on public.threads          to authenticated, service_role;
grant select, insert, update on public.thread_items     to authenticated, service_role;
grant select, insert         on public.thread_item_keys to authenticated, service_role;

comment on table public.thread_item_keys is
  'CEK de cada elemento, envuelta una vez por miembro destinatario (ECDH X25519 -> AES-256-GCM). Necesaria porque las claves son de miembro y los hilos de organizacion.';
comment on column public.thread_items.content_ciphertext is
  'Todo el contenido del elemento, cifrado. El servidor solo almacena y reenvia ciphertext (e2ee-content-encryption).';
