-- =============================================================================
-- 0015 · Las dos funciones que necesita el reseteo del entorno de demo · día 13
-- =============================================================================
-- `Plan §5`, día 13, segunda fila: *"Entorno de demo aislado, con siembra
-- congelada y reseteable"*. `Plan §12` lo tenía como mitigación del riesgo *"la
-- base de demo queda sucia del ensayo"*.
--
-- POR QUÉ EXISTEN, Y NO ES COMODIDAD. El reseteo se ejecuta desde Node con
-- `supabase-js` y la clave de servicio, porque **no hay `psql` en la máquina de
-- desarrollo ni en el runner** —el mismo motivo por el que `e2e/fixture.setup.ts`
-- repone la siembra por el cliente y no por SQL—. Y `supabase-js` no ejecuta SQL
-- arbitrario: solo tablas y RPC. Sin estas dos funciones, el re-anclaje de la
-- frescura habría que reimplementarlo en JavaScript, y entonces habría **dos
-- definiciones del mismo contrato** —la de `seed/reanchor_freshness.sql` y la de
-- JavaScript— divergiendo en silencio. Este repo ya sabe cómo acaba eso: es
-- F-012, F-089 y F-095, tres veces el mismo patrón.
--
-- Así que el contrato vive aquí, en la base, en un solo sitio, y lo llaman por
-- igual el script de reseteo, el `.sql` suelto y quien abra el editor SQL.
--
-- QUÉ NO HACEN. No tocan `threads` ni `thread_items`: reponer la siembra cifrada
-- exige la semilla E2EE, que vive en el cliente y **no puede vivir en la base**
-- sin romper el zero-knowledge (`CLAUDE.md` §4). Esa mitad la hace Node.
--
-- ⚠ POR QUÉ EN `public` Y NO EN `app`, QUE ES DONDE VIVEN LAS FUNCIONES.
-- `CLAUDE.md` §10.3 dice que `app` es el esquema de funciones, y lo es — para
-- las internas. Pero **PostgREST solo expone `public`**, y `supabase.rpc()`
-- resuelve ahí: por eso `counter_offer`, `create_inquiry` y `org_public_keys`
-- están en `public` y no en `app`. Estar en `public` significa estar al alcance
-- de cualquiera con sesión, así que el permiso se cierra a mano justo debajo de
-- cada una. El prefijo `demo_` es para que nadie las confunda con producto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · `demo_reanchor_freshness()` — el cuerpo de `seed/reanchor_freshness.sql`
-- -----------------------------------------------------------------------------
-- Mismo algoritmo y mismos umbrales que el script del día 12 (**F-094**), con
-- una diferencia deliberada: **devuelve el resultado en vez de solo anunciarlo
-- con `raise notice`**. Un `notice` no llega a `supabase-js`, y un reseteo que no
-- puede enseñar en qué estado ha dejado la base no sirve para el paso 0 del
-- guion de la sesión —que es, literalmente, *"comprobar la salida"*.
--
-- Lo que sí conserva es el fallo en voz alta: si la distribución resultante no
-- cumple el guion, esto **lanza excepción**. Un script de curación que no
-- comprueba su resultado es F-089 otra vez.
--
-- `security invoker` (el defecto) a propósito: quien la llama es `service_role`,
-- que ya salta RLS. Un `definer` aquí solo añadiría una vía de escalada para el
-- día en que alguien se equivoque con el `grant`.
-- -----------------------------------------------------------------------------
create or replace function public.demo_reanchor_freshness()
returns jsonb
language plpgsql
as $$
declare
  delta       interval;
  movidas     integer := 0;
  total       integer;
  frescas     integer;
  ref_frescas integer;
  ref_viejas  integer;
  viejas30    integer;
begin
  select now() - max(last_upload_at) into delta from public.inventory_lines;

  if delta is null then
    raise exception 'RE-ANCLAJE ABORTADO · no hay ni una línea en inventory_lines. ¿Base equivocada?';
  end if;

  -- Idempotente dentro del mismo día: por debajo de 12 horas no toca nada.
  if delta >= interval '12 hours' then
    update public.inventory_lines
       set last_upload_at = last_upload_at + delta;
    get diagnostics movidas = row_count;
  end if;

  select count(*),
         count(*) filter (where last_upload_at >= now() - interval '7 days')
    into total, frescas
    from public.inventory_lines;

  select count(*) filter (where last_upload_at >= now() - interval '7 days'),
         count(*) filter (where last_upload_at <  now() - interval '7 days')
    into ref_frescas, ref_viejas
    from public.inventory_lines
   where part_number = '6205-2RS';

  select count(*) into viejas30
    from public.inventory_lines
   where last_upload_at < now() - interval '30 days';

  if frescas * 100 < total * 60 then
    raise exception 'RE-ANCLAJE FALLIDO · solo % de % líneas bajan de 7 días (hace falta 60%%). La columna Antigüedad seguiría casi toda en naranja.', frescas, total;
  end if;

  if ref_frescas < 6 then
    raise exception 'RE-ANCLAJE FALLIDO · solo % líneas de 6205-2RS bajan de 7 días (hacen falta 6). Es la tabla que ve el socio en el paso 1 del guion.', ref_frescas;
  end if;

  if ref_viejas < 2 then
    raise exception 'RE-ANCLAJE FALLIDO · % líneas de 6205-2RS por encima de 7 días (hacen falta 2). Sin ninguna en naranja, el indicador tampoco se ve.', ref_viejas;
  end if;

  if viejas30 < 1 then
    raise exception 'RE-ANCLAJE FALLIDO · ninguna línea pasa de 30 días. El rojo de antigüedad no aparecería en toda la demo.';
  end if;

  return jsonb_build_object(
    'movidas',     movidas,
    'desfase',     delta::text,
    'total',       total,
    'frescas',     frescas,
    'ref_frescas', ref_frescas,
    'ref_viejas',  ref_viejas,
    'viejas30',    viejas30
  );
end $$;

comment on function public.demo_reanchor_freshness() is
  'Re-ancla last_upload_at del catálogo de demo y verifica el guion (F-094). Lanza si no cumple. Solo service_role.';

-- ⚠ ESTA FUNCIÓN ESCRIBE EN TODO EL CATÁLOGO. Si `authenticated` pudiera
-- llamarla, cualquier cuenta con sesión desplazaría las fechas de las 221 líneas
-- de una vez. `revoke` primero de `public` —el rol pseudo, que es de donde
-- cuelga el `execute` por defecto— y solo después el `grant` acotado.
revoke all on function public.demo_reanchor_freshness() from public;
revoke all on function public.demo_reanchor_freshness() from anon, authenticated;
grant execute on function public.demo_reanchor_freshness() to service_role;

-- -----------------------------------------------------------------------------
-- 2 · `demo_state()` — la foto que se enseña, no la que se recuerda
-- -----------------------------------------------------------------------------
-- **F-012, F-089 y F-095 son tres veces el mismo hallazgo:** alguien afirmó un
-- estado de la base que la base no tenía, porque lo reconstruyó de memoria entre
-- sesiones en vez de consultarlo. `CLAUDE.md` §10.4 lo dejó como regla —*"un
-- estado de la base que se afirme se consulta con SQL en el momento de
-- afirmarlo"*—, pero una regla que obliga a escribir la consulta a mano cada vez
-- se acaba saltando.
--
-- Esto es esa consulta, escrita una vez. El reseteo la imprime al terminar, así
-- que el estado queda dicho por la base y no por quien lo escribe.
--
-- Es de solo lectura. Se cierra igual porque enumera los hilos de todas las
-- organizaciones, y eso es precisamente lo que RLS impide ver a un usuario.
-- -----------------------------------------------------------------------------
create or replace function public.demo_state()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'medido_en', now(),
    'catalogo', (
      select jsonb_build_object(
        'total',   count(*),
        'frescas', count(*) filter (where last_upload_at >= now() - interval '7 days'),
        'naranja', count(*) filter (where last_upload_at <  now() - interval '7 days'
                                      and last_upload_at >= now() - interval '30 days'),
        'roja',    count(*) filter (where last_upload_at <  now() - interval '30 days'),
        'futuro',  count(*) filter (where last_upload_at >  now())
      )
      from public.inventory_lines
    ),
    'referencia', (
      select jsonb_build_object(
        'total',   count(*),
        'frescas', count(*) filter (where last_upload_at >= now() - interval '7 days'),
        'naranja', count(*) filter (where last_upload_at <  now() - interval '7 days'
                                      and last_upload_at >= now() - interval '30 days'),
        'roja',    count(*) filter (where last_upload_at <  now() - interval '30 days')
      )
      from public.inventory_lines where part_number = '6205-2RS'
    ),
    'hilos', (
      select coalesce(jsonb_agg(h order by h->>'contraparte'), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'contraparte', oh.name,
                 'estado',      t.state,
                 'elementos',   (select count(*) from public.thread_items ti where ti.thread_id = t.id)
               ) as h
        from public.threads t
        join public.organizations oh on oh.id = t.org_high_id
      ) s
    )
  );
$$;

comment on function public.demo_state() is
  'Foto de solo lectura del estado de demo: catálogo, referencia 6205-2RS y los hilos con su estado. Solo service_role.';

revoke all on function public.demo_state() from public;
revoke all on function public.demo_state() from anon, authenticated;
grant execute on function public.demo_state() to service_role;
