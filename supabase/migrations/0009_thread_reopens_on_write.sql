-- =============================================================================
-- 0009 · Un hilo cerrado se reabre cuando alguien vuelve a escribir en él
-- =============================================================================
-- Fuente de verdad: DECISIÓN DEL PO del 11-ago-2026, registrada en
--                   `openspec/mvp/Dia-07_decisiones_producto.md` · F-045.
--
--   *"Un hilo cerrado sólo se reabre cuando uno de los dos usuarios vuelve a
--   escribir en él. No hay más opciones."*
--
-- POR QUÉ ESTA MIGRACIÓN CITA UNA DECISIÓN Y NO UN SPEC.
--
-- Es el primer cambio del MVP que **contradice specs de pantalla aprobadas**, y
-- conviene que quede escrito aquí y no solo en un documento aparte. Cuatro decían
-- lo contrario:
--
--   MSG-02 · tabla de acciones · *"CERRADO SIN ACUERDO (irreversible)"*
--   MSG-02 §6 · *"El campo de mensaje y el botón Crear oferta desaparecen"*
--   MSG-02 §7 y MSG-03 §7 · *"El único estado irreversible es CERRADO SIN ACUERDO"*
--   MSG-01 §3 · badge tachado, *"solo lectura"*
--
-- **La capability cerrada, en cambio, no dice nada.** `thread-lifecycle` menciona
-- `CERRADO SIN ACUERDO` una sola vez (`messaging-and-negotiation/spec.md:225`) y
-- es para hablar del marcado de líneas consultadas: **no declara el estado
-- irreversible en ninguna parte**. Así que esto no rompe ninguna de las nueve
-- capabilities — se aparta de cuatro specs de pantalla, que es un grado distinto y
-- mucho más barato. Los HTML aprobados no se tocan (`CLAUDE.md` §1): la
-- divergencia se anota, como se hizo con F-025.
--
-- LA REGLA QUE SE CAE CON ELLA, Y NO ES OPCIONAL.
--
-- Si el campo de mensaje desaparece en un hilo cerrado, **nadie puede volver a
-- escribir y la reapertura no puede ocurrir nunca**. La decisión del PO obliga por
-- tanto a que MSG-02 mantenga el campo de mensaje visible en CERRADO SIN ACUERDO.
-- No es una interpretación: es la única forma de que la regla tenga efecto.
--
-- QUÉ CUENTA COMO "VOLVER A ESCRIBIR": UN ELEMENTO NUEVO. NADA MÁS.
--
-- El trigger se dispara con `insert or update or delete`, y las tres cosas son
-- escrituras para Postgres pero no para una persona. Solo el **INSERT** reabre:
--
--   · INSERT  -> alguien ha escrito. Reabre.
--   · UPDATE  -> alguien ha tocado un elemento que ya existía (marcar una consulta
--                respondida, sellar un puntero de contraoferta, un backfill).
--                Eso no es escribir en el hilo. NO reabre.
--   · DELETE  -> menos todavía.
--
-- Si el UPDATE reabriera, cualquier mantenimiento sobre `thread_items` resucitaría
-- hilos cerrados en silencio y sin que nadie hubiera dicho nada — que es
-- exactamente el tipo de estado que deja de significar lo que dice (F-023, F-044).
--
-- A QUÉ ESTADO REABRE.
--
-- Al que digan sus filas, porque el estado es una función de las filas y no un
-- valor que alguien escribe (0007). Con un mensaje suelto sale `ABIERTO`; si el
-- hilo se cerró teniendo una oferta aceptada y vigente, sale `ACUERDO ALCANZADO`.
-- No se fuerza `ABIERTO`: forzarlo sería reintroducir por la puerta de atrás un
-- estado que contradice sus propios elementos.
-- =============================================================================

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

  -- Decisión del PO (11-ago): el cierre deja de ser pegajoso, pero solo lo
  -- levanta un elemento NUEVO. Ver la cabecera.
  if actual = 'CERRADO SIN ACUERDO' and tg_op <> 'INSERT' then
    return null;
  end if;

  nuevo := app.derive_thread_state(t_id);
  if nuevo is distinct from actual then
    update public.threads set state = nuevo where id = t_id;
  end if;
  return null;
end;
$$;

comment on function app.sync_thread_state() is
  'Deriva threads.state desde los elementos del hilo. Un hilo CERRADO SIN ACUERDO se reabre solo con un elemento NUEVO (decision del PO 11-ago, F-045); un update o un delete sobre lo que ya habia no lo reabre.';
