-- =============================================================================
-- 0017 · Índice para la derivación de la lista de hilos · Fundación V1
-- =============================================================================
-- ADR-002 §5, última fila: "Nuevo índice para la derivación de la lista de
-- hilos, en la dirección que filtra primero". Y ADR-002 §3, D-1: "Se diseña con
-- la dirección que filtra primero, se indexa, y se mide bajo carga. No se
-- supone." Este fichero hace la mitad que es código hoy: el índice. La otra
-- mitad —reescribir `threads_select_participant` para que derive de
-- `thread_item_keys` en vez de consultar `threads` directo— es la fila "Lista
-- de hilos" de la misma tabla, sigue 🔴, y no se toca aquí (FUNDACION-V1.md §3.3
-- ya lo separa así: el índice es lo barato que desbloquea la otra mitad).
--
-- LA DIRECCIÓN QUE FILTRA PRIMERO. La derivación futura parte de "¿qué
-- elementos puede leer este miembro?" —el lado más selectivo, un puñado de
-- filas por persona— y de ahí sube a `thread_items.thread_id` y a `threads`.
-- Eso es lo contrario de la política de hoy, que arranca en `threads` filtrando
-- por organización entera.
--
-- LO QUE YA HABÍA, COMPROBADO CONTRA `pg_indexes` DEL PROYECTO REAL
-- (`troxminloxkjwihwfevs`), NO CONTRA LA MIGRACIÓN: `thread_item_keys_recipient_idx
-- (recipient_member_id)`, de `0003`. Ya filtra por el lado correcto, pero es de
-- una sola columna: no cubre `item_id`, así que cada fila encontrada necesita un
-- viaje al heap a por él —exactamente para leer el único campo que la
-- derivación necesita de esta tabla, sin tocar `wrapped_cek` ni el resto—.
--
-- EL ARREGLO. Un índice compuesto con `recipient_member_id` primero (la
-- dirección que filtra) y `item_id` cubierto detrás: la consulta que traduzca
-- "mis elementos legibles" a `thread_id` se resuelve entera dentro del índice,
-- sin heap. El de una sola columna queda redundante —cualquier consulta que lo
-- usara sigue sirviéndose del compuesto, por la regla del prefijo de un
-- b-tree— y se retira para no mantener dos índices sobre el mismo filtro.
-- =============================================================================

create index thread_item_keys_recipient_item_idx
  on public.thread_item_keys (recipient_member_id, item_id);

drop index public.thread_item_keys_recipient_idx;
