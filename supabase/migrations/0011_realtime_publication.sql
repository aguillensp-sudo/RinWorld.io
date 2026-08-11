-- =============================================================================
-- 0011 · Realtime: `threads` y `thread_items` a la publicación
-- =============================================================================
-- Fuente de verdad: `Plan §3`, fila del día 7 — *"Realtime: hilos y mensajes
--                   propagando entre sesiones"*. SP-3 (día 1) ya midió que la
--                   infraestructura sirve: 20/20 sin perder ninguno, latencia
--                   media 327 ms, máxima 598 ms, y reconecta sola.
--
-- LO QUE FALTABA, Y NO ESTABA ESCRITO EN NINGUNA PARTE.
--
-- `supabase_realtime` estaba **vacía**. Comprobado contra el proyecto real antes
-- de escribir esto, no supuesto:
--
--   select p.pubname, c.relname from pg_publication p
--     left join pg_publication_rel pr on pr.prpubid = p.oid
--     left join pg_class c on c.oid = pr.prrelid;
--   -> ('supabase_realtime', NULL)
--
-- O sea: un `postgres_changes` sobre `threads` **habría conectado, devuelto
-- SUBSCRIBED y no habría entregado nunca un evento.** Ese es el fallo silencioso
-- de esta migración: no hay error, no hay excepción, no hay nada — solo una
-- pantalla que no se entera. Es la forma de F-023 aplicada al transporte.
--
-- SP-3 no lo destapó porque creó su propia tabla `spike_messages` con su propia
-- migración, y la CLI de Supabase añade a la publicación por defecto cuando se
-- crea una tabla desde el panel. Las diez tablas del esquema del MVP se crearon
-- por SQL, y por SQL no se añade nadie solo. **Un spike que se monta su propio
-- entorno mide la tecnología, no la instalación** — apuntado como hallazgo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Las dos tablas, y solo las dos
--
-- `threads` porque su `state` lo escribe un trigger (0007): cuando la otra parte
-- acepta una oferta, la fila de la que cambia el badge no la toca nadie desde el
-- navegador, así que sin este evento el estado se queda rancio hasta que alguien
-- recargue.
--
-- `thread_items` porque es donde aparecen los elementos nuevos.
--
-- Las otras ocho no entran. `inventory_lines` sería la siguiente candidata y no
-- es del día 7; `organizations` y `members` no cambian en sesión. Publicar una
-- tabla que nadie escucha es coste de WAL sin lector.
-- -----------------------------------------------------------------------------
do $$
begin
  -- ⚠ LA PUBLICACIÓN PUEDE NO EXISTIR, y esto lo enseñó la suite de esquema al
  -- primer intento: `supabase_realtime` la crea la PLATAFORMA de Supabase, no
  -- Postgres. En el `postgres:16-alpine` pelado que levanta `supabase/tests/
  -- run.sh` no hay ninguna, así que el `alter publication` moría con
  -- `publication "supabase_realtime" does not exist` y se llevaba por delante la
  -- fase 1 entera — o sea el trabajo `Esquema` de la CI.
  --
  -- Es la forma de F-054 en SQL: **una migración que solo se ha ejecutado contra
  -- el remoto es una hipótesis sobre el resto de entornos.** Crearla cuando falta
  -- la hace portable y no cambia nada donde ya está.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
     where p.pubname = 'supabase_realtime' and c.relname = 'threads'
  ) then
    alter publication supabase_realtime add table public.threads;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
     where p.pubname = 'supabase_realtime' and c.relname = 'thread_items'
  ) then
    alter publication supabase_realtime add table public.thread_items;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2 · ⚠ NO se toca la REPLICA IDENTITY, y es una decisión, no un olvido
--
-- Las dos se quedan en `d` (la clave primaria), que es el valor por defecto.
--
-- Lo que se pierde: **los eventos DELETE no llegan filtrados por RLS.** Realtime
-- evalúa la política de lectura sobre las columnas del registro, y en un DELETE
-- solo dispone de las de la identidad de réplica — con la PK sola no puede
-- comprobar `app.current_org_id() in (org_low_id, org_high_id)`, así que no
-- entrega el evento. Para recuperarlo haría falta `REPLICA IDENTITY FULL`.
--
-- Y no se pone, por dos razones:
--
--   1. **No hay borrados que escuchar.** Ningún camino del MVP borra un elemento
--      ni un hilo, y la decisión D-07-01 lo dice explícitamente al acotar qué
--      reabre un hilo: *"DELETE → menos todavía"*. Suscribirse a un evento que
--      nadie produce no es cautela, es ruido.
--   2. **`FULL` mandaría el `content_ciphertext` VIEJO en cada UPDATE.** La
--      identidad de réplica completa incluye la fila anterior entera, y la fila
--      anterior de un `thread_items` lleva el blob cifrado. Marcar una consulta
--      como respondida pasaría a empujar el ciphertext por el socket, a todos los
--      suscriptores que pasen RLS, en cada cambio de metadato. Va cifrado y no es
--      una fuga — pero es superficie y son bytes, a cambio de un evento que no se
--      usa.
--
-- Si algún día entra un borrado de verdad, esto se revisa **junto con** qué se
-- publica, no por separado.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 3 · Lo que esta migración NO hace, para que no se busque aquí
--
-- **No cambia ni una política.** Realtime reutiliza las de `select` que ya
-- existen desde 0003 (`threads_select_participant`,
-- `thread_items_select_participant`), y eso es exactamente lo que se quiere: un
-- canal que entregue lo que la pantalla ya podría leer, ni una fila más. Si
-- hiciera falta una política nueva para Realtime, sería la señal de que el canal
-- enseña algo que la consulta no enseña.
-- -----------------------------------------------------------------------------
