-- =============================================================================
-- 0012 · La pública de la contraparte: una vía de lectura, no una columna
-- =============================================================================
-- Fuente de verdad: `Plan §3`, fila del día 8 — *"Rebanada E2EE: cifrado de
--                   campos de oferta en cliente"*.
--
-- ⚠ ESTA MIGRACIÓN ES MUCHO MÁS PEQUEÑA DE LO QUE `Dia-08_decisiones_e2ee.md`
--   ANTICIPABA, Y CONVIENE SABER POR QUÉ ANTES DE LEERLA.
--
-- D-08-03 afirmaba: *"El esquema no tiene columna para la clave pública de
-- nadie. Comprobado: `organizations` y `members` en `0001` no llevan material de
-- clave"*, y de ahí proponía añadir `organizations.public_key`. **Eso era falso**,
-- y se comprobó contra el esquema antes de escribir una línea de cifrado:
--
--   · `members.public_key bytea`                          → 0001:73
--     comentada *"X25519 pública (key-generation). La privada NUNCA llega aquí"*
--   · `members_pubkey_len_chk check (… = 32)`             → 0001:93
--   · `public.thread_item_keys` entera                    → 0003:269-286
--     (`wrapped_cek`, `wrap_iv`, `ephemeral_pubkey`, PK `(item_id, recipient)`)
--   · `item_keys_select_own` / `item_keys_insert_sender`  → 0003:351 y 0003:356
--
-- Y el día 2 dejó escrito para qué lo construía (0003:265):
--   *"Existe desde hoy para que el día 8 no sea una migración de datos cifrados,
--    que es la peor clase de migración."*
--
-- Seguir D-08-03 habría descartado ese diseño y puesto uno **más lejos** de
-- ADR-001 (la identidad es del miembro, no de la organización) a cambio de nada.
-- El PO decidió el 12-ago mantener el diseño del día 2. Queda como hallazgo.
--
-- -----------------------------------------------------------------------------
-- EL HUECO REAL, QUE SÍ EXISTE Y ES EL ÚNICO
-- -----------------------------------------------------------------------------
-- `members_select_own_org` (0001:207):
--
--   using (org_id = app.current_org_id())   -- "un miembro ve a los de su
--                                           --  organización y a nadie más"
--
-- Para que Alpha cifre algo que Nordwälz pueda leer, Alpha necesita envolver la
-- CEK con la **pública de los miembros de Nordwälz**, y esa política se lo
-- impide. No falta dónde guardar la clave: falta **por dónde leerla**.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · Por qué una función y no una política
--
-- La tentación es relajar `members_select_own_org` para que deje ver a los
-- miembros de la contraparte de un hilo compartido. **No se hace, y no es
-- purismo: RLS no filtra por columna.** Abrir la fila abre la fila entera, y la
-- fila de `members` lleva:
--
--   · `email` y `full_name`  → datos personales de la otra empresa
--   · `encrypted_key_blob`, `key_iv`, `argon2_salt`, `kdf_params`  → 0001:78-81
--
-- Los cuatro últimos son el respaldo de la clave privada del miembro. Hoy son
-- NULL en el MVP (0001:109), así que la fuga sería teórica **hoy** — y por eso
-- mismo es la clase de agujero que no duele hasta que duele. ADR-001 §8, primer
-- invariante: el material de respaldo no viaja al servidor ni a nadie más, ni en
-- payloads, ni en logs, ni en mensajes de error. Una política que hoy no filtra
-- nada porque la columna está vacía es una política que filtra el día que V1 la
-- llene, y ese día nadie va a releer esta migración.
--
-- Una función `security definer` que devuelve **tres columnas y solo tres** no
-- tiene esa propiedad: lo que no está en el `select` no se puede filtrar por
-- descuido más adelante.
--
-- 2 · Por qué vive en `public` y no en `app`
--
-- **Es la primera función de este esquema pensada para que la llame el
-- navegador.** Las veinte de `app` son internas: las invocan triggers y
-- políticas, y `app` no está entre los esquemas que PostgREST expone. Una
-- función en `app` sería inalcanzable desde `supabase.rpc()`. El esquema `app`
-- se queda siendo lo que es —la maquinaria— y lo que el cliente llama vive
-- donde el cliente puede llamarlo.
--
-- 3 · Por qué devuelve también a quien NO tiene clave publicada
--
-- Podría filtrar `public_key is not null` y devolver solo destinatarios útiles.
-- **Sería un fallo silencioso de manual.** Si un miembro de la contraparte no ha
-- publicado su pública, el emisor envolvería la CEK para menos gente de la que
-- debe, el `insert` funcionaría, y la otra parte vería `Contenido cifrado —
-- introduce tu frase de seguridad para ver` para siempre, sin nada que explicara
-- por qué. Es F-023 otra vez: el hueco se pinta, no se esconde.
--
-- Devolviendo la fila con `public_key` a NULL, el cliente puede negarse a enviar
-- y decir de quién falta la clave. La decisión de qué hacer con eso es de la
-- pantalla; el dato tiene que llegarle.
--
-- 4 · Por qué incluye al propio emisor
--
-- La CEK va envuelta **una vez por cada miembro que debe leerla** (0003:263), y
-- el emisor es uno de ellos: sin su propia copia envuelta no podría releer lo
-- que acaba de escribir al recargar. `item_keys_select_own` (0003:353) lo
-- reparte por persona, no por organización, así que "los dos lados del hilo"
-- significa literalmente todos los miembros de las dos organizaciones.
-- -----------------------------------------------------------------------------
create or replace function public.thread_public_keys(t_id uuid)
returns table (member_id uuid, org_id uuid, public_key bytea)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.org_id, m.public_key
    from public.threads t
    join public.members m on m.org_id in (t.org_low_id, t.org_high_id)
   where t.id = t_id
     -- La puerta, y es la misma que usa RLS para el hilo entero. Si quien llama
     -- no participa, no hay filas: no se levanta excepción, porque decir "ese
     -- hilo existe pero no es tuyo" ya sería filtrar — mismo criterio que
     -- `fetchThreadDetail` con `maybeSingle` (thread-detail.ts:293).
     and app.can_access_thread(t_id)
   order by m.org_id, m.id;
$$;

-- `security definer` sin `revoke` es una función que puede llamar cualquiera,
-- incluido `anon`. Mismo patrón que 0001:186 y 0003:309.
revoke execute on function public.thread_public_keys(uuid) from public;
grant  execute on function public.thread_public_keys(uuid) to authenticated, service_role;

comment on function public.thread_public_keys(uuid) is
  'Claves publicas X25519 de los miembros de las dos organizaciones de un hilo, para envolver la CEK. Devuelve tres columnas y nunca la fila de members: email y el respaldo de clave (ADR-001 §8) no salen de aqui. Sin filas si quien llama no participa en el hilo.';


-- -----------------------------------------------------------------------------
-- 5 · Escribir el elemento y sus claves, o ninguna de las dos cosas
--
-- ⚠ POR QUÉ ESTO NO PUEDE SER DOS `insert` DESDE EL NAVEGADOR, que es como
--   saldría solo.
--
-- El elemento va en `thread_items` y las CEK envueltas en `thread_item_keys`, y
-- las claves no se pueden depositar antes porque `item_keys_insert_sender`
-- (0003:356) exige que el elemento ya exista. O sea: primero la fila, después
-- las claves.
--
-- Si la segunda escritura no llega —la red se cae entre las dos, la pestaña se
-- cierra, el token caduca justo ahí— queda **un elemento cifrado sin una sola
-- clave que lo abra**. Y no se puede reparar: nadie, ni su autor, puede
-- descifrarlo para volver a cifrarlo. Es corrupción permanente, y en la pantalla
-- se ve como un elemento que dice `Contenido cifrado — introduce tu frase de
-- seguridad para ver` **para siempre**, indistinguible del caso normal de
-- D-07-05. La clase de fallo que nadie diagnostica porque se parece a una
-- función que ya existe.
--
-- Una función lo hace en una transacción: o están las dos cosas, o no está
-- ninguna.
--
-- **`security invoker`, y es lo importante de aquí.** Sin `security definer`,
-- las dos inserciones pasan por RLS y por los triggers igual que si las hiciera
-- el navegador: `thread_items_insert_own` (0003:333) sigue exigiendo que el
-- emisor sea quien dice ser, `app.validate_thread_item` (0003:188) sigue
-- comprobando que participa en el hilo, y `app.check_thread_rate_limit` sigue
-- contando. Esta función agrupa dos escrituras; **no concede ni un permiso**.
-- Con `definer` habría sido una puerta trasera a `thread_items`.
--
-- El servidor no gana visibilidad con esto: recibe ciphertext y claves
-- envueltas, que es exactamente lo que ya almacenaba. Ni el contenido ni ninguna
-- privada pasan por aquí.
--
-- El hexadecimal va **sin el prefijo `\x`**: PostgREST no transporta `bytea` en
-- JSON, así que el contrato es hex pelado y `decode(…, 'hex')` de este lado.
-- Explícito para que nadie tenga que adivinar si el prefijo sobra o falta.
-- -----------------------------------------------------------------------------
create or replace function public.create_thread_item(
  p_thread_id  uuid,
  p_item_type  text,
  p_ciphertext text,
  p_iv         text,
  p_keys       jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  nuevo uuid;
begin
  -- Solo `MENSAJE` en el MVP, y se dice por qué en vez de fallar con un CHECK a
  -- medio camino: `CONSULTA` la crea el flujo de SRCH-01 —que hoy solo LEE
  -- `thread_items`, comprobado— y `OFERTA` es MSG-03, fuera del MVP
  -- (`CREATE_OFFER_DISABLED_REASON`). Cuando entren, pasan por aquí: necesitan
  -- sus claves envueltas igual que este.
  if p_item_type is distinct from 'MENSAJE' then
    raise exception
      'create_thread_item solo crea MENSAJE en el MVP (D-08-02). CONSULTA llega con el envio de SRCH-01 y OFERTA es MSG-03.';
  end if;

  -- Un elemento sin claves es el caso irreparable de arriba. Se rechaza aquí y
  -- no con un trigger porque el trigger no podría distinguir "todavia no" de
  -- "nunca": dentro de esta función sí se sabe.
  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
  values
    (p_thread_id, app.current_org_id(), auth.uid(), p_item_type,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'))
  returning id into nuevo;

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nuevo,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  return nuevo;
end;
$$;

revoke execute on function public.create_thread_item(uuid, text, text, text, jsonb) from public;
grant  execute on function public.create_thread_item(uuid, text, text, text, jsonb) to authenticated;

comment on function public.create_thread_item(uuid, text, text, text, jsonb) is
  'Crea un thread_item y sus CEK envueltas en UNA transaccion: un elemento sin claves seria ilegible para siempre y no se puede reparar. security invoker a proposito — pasa por RLS y por los triggers igual que un insert del navegador, y no concede ningun permiso.';


-- -----------------------------------------------------------------------------
-- 6 · Lo que esta migración NO hace, para que no se busque aquí
--
-- **No añade ninguna columna.** `members.public_key` ya existe desde 0001 y
-- `thread_item_keys` desde 0003.
--
-- **No toca `members_select_own_org`.** Sigue diciendo lo que decía: un miembro
-- ve a los de su organización y a nadie más. Lo que se abre es una ventana de
-- tres columnas, no la puerta.
--
-- **No añade forma de publicar la propia pública, porque ya la hay.**
-- `members_update_self` (0001:214) permite `update members set public_key = …
-- where id = auth.uid()`, y `app.guard_member_privileges` (0001:224) solo
-- bloquea `role`, `state` y `org_id`. Comprobado leyendo el trigger, no supuesto.
--
-- **No depende de nada de la plataforma Supabase**, a diferencia de 0011 con su
-- publicación: esto es Postgres pelado y corre igual en el `postgres:16-alpine`
-- de `supabase/tests/run.sh`. F-054 aplicado desde el principio esta vez.
-- -----------------------------------------------------------------------------
