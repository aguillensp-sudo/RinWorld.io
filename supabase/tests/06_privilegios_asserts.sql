-- =============================================================================
-- 06 · Invariantes de privilegios en `public` (F-192, va con 0071)
-- =============================================================================
-- Llamado desde run.sh justo después de 01_schema_smoke.sql (fase 1, base `postgres`).
-- El stub (`00_auth_stub.sql`) da a las tablas nuevas lo mismo que la plataforma.
--
-- No enumera tablas: mide REGLAS, así que una tabla nueva que nazca abierta lo
-- hace fallar sin que nadie se acuerde de añadirla aquí (F-136: una evidencia
-- que depende de que alguien se acuerde no es evidencia).
--
--   A. `anon` no tiene nada en ninguna tabla, vista, columna ni secuencia.
--   B. `authenticated` no tiene TRUNCATE, REFERENCES, TRIGGER ni MAINTAIN (Postgres 17) en nada.
--   C. Cada SELECT/INSERT/UPDATE/DELETE de `authenticated` sobre una tabla
--      (también por columna) lo usa al menos una política suya o de `public`
--      con ese comando o con ALL. Un privilegio sin política está muerto: o
--      sobra, o falta la política.
--   D. Las vistas son `security_invoker` y `authenticated` solo las lee.
--   E. Todas las tablas tienen RLS activa.
--   F. Las DEFAULT PRIVILEGES de `postgres` en `public` no regalan tablas ni
--      secuencias a `anon` ni a `authenticated`.
--   G. `anon` no ejecuta ninguna función de `public` (tampoco a través de PUBLIC).
--
-- Se lee de `relacl`/`attacl`/`pg_default_acl` y no de information_schema, que
-- filtra por los roles del que pregunta (F-146: privilegios, contra el catálogo).
-- =============================================================================

do $$
declare
  fallos text[] := '{}';
  r record;
begin
  -- A + B + C + D sobre privilegios de tabla y de vista
  for r in
    select c.relname, c.relkind, c.relrowsecurity, c.reloptions,
           pg_get_userbyid(a.grantee) as grantee, a.privilege_type as priv
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
      and a.grantee <> 0
      and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
  loop
    if r.grantee = 'anon' then
      fallos := fallos || format('A: anon tiene %s en %s', r.priv, r.relname);
    elsif r.relkind = 'S' then
      fallos := fallos || format('A: authenticated tiene %s en la secuencia %s', r.priv, r.relname);
    elsif r.priv in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN') then
      fallos := fallos || format('B: authenticated tiene %s en %s', r.priv, r.relname);
    elsif r.relkind in ('v', 'm') then
      if r.priv <> 'SELECT' then
        fallos := fallos || format('D: authenticated tiene %s en la vista %s', r.priv, r.relname);
      end if;
    elsif not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = r.relname
        and p.cmd in (r.priv, 'ALL')
        and p.roles && array['authenticated', 'public']::name[]
    ) then
      fallos := fallos || format('C: authenticated tiene %s en %s y ninguna política lo usa', r.priv, r.relname);
    end if;
  end loop;

  -- A + C sobre privilegios por columna (members los tiene)
  for r in
    select c.relname, att.attname, pg_get_userbyid(a.grantee) as grantee, a.privilege_type as priv
    from pg_attribute att
    join pg_class c on c.oid = att.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(att.attacl) a
    where n.nspname = 'public' and att.attnum > 0 and not att.attisdropped
      and att.attacl is not null
      and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
  loop
    if r.grantee = 'anon' then
      fallos := fallos || format('A: anon tiene %s en %s.%s', r.priv, r.relname, r.attname);
    elsif not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = r.relname
        and p.cmd in (r.priv, 'ALL')
        and p.roles && array['authenticated', 'public']::name[]
    ) then
      fallos := fallos || format('C: authenticated tiene %s en %s.%s y ninguna política lo usa',
                                 r.priv, r.relname, r.attname);
    end if;
  end loop;

  -- D: toda vista de public es security_invoker
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)
  loop
    fallos := fallos || format('D: la vista %s no es security_invoker', r.relname);
  end loop;

  -- E: toda tabla de public tiene RLS
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    fallos := fallos || format('E: la tabla %s no tiene RLS', r.relname);
  end loop;

  -- F: las tablas nuevas no nacen abiertas
  for r in
    select d.defaclobjtype as tipo, pg_get_userbyid(a.grantee) as grantee, a.privilege_type as priv
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclobjtype in ('r', 'S')
      and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
  loop
    fallos := fallos || format('F: las %s nuevas nacen con %s para %s',
                               case r.tipo when 'r' then 'tablas' else 'secuencias' end, r.priv, r.grantee);
  end loop;

  -- G: anon no ejecuta nada de public (has_function_privilege cuenta también PUBLIC)
  for r in
    select p.oid::regprocedure::text as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
      -- Las de una extensión no son nuestras (en el banco `pgcrypto` cae en public; en Supabase, en
      -- `extensions`), y `expect_fail`/`expect_denied` son ayudas de 01_schema_smoke.sql, sin migración.
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                        and d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('expect_fail', 'expect_denied')
  loop
    fallos := fallos || format('G: anon ejecuta %s', r.fn);
  end loop;

  if cardinality(fallos) > 0 then
    raise exception E'06 · privilegios: % fallo(s)\n  %', cardinality(fallos), array_to_string(fallos, E'\n  ');
  end if;
  raise notice '06 · privilegios: OK';
end
$$;
