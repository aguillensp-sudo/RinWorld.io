-- =============================================================================
-- 10 · Clave normalizada de la referencia (`0073`–`0075`, F-254)
-- =============================================================================
-- La tabla de casos es la misma que la del test de paridad de `normalizeRef()` en la app: si una
-- cambia, cambia la otra. Fixture propia (prefijo `10a`) dentro de una transacción que se deshace;
-- no depende de 01 ni de 07.
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

insert into public.organizations (id, name, country, continent, status)
values ('10a00000-0000-4000-8000-000000000001', 'Diez', 'ES', 'EU', 'APPROVED');

-- -----------------------------------------------------------------------------
-- 1 · Cada grafía da su clave
-- -----------------------------------------------------------------------------
do $$
declare
  caso record;
  clave text;
begin
  for caso in
    select * from (values
      ('NU 2224 ECJ C3',  'NU2224ECJC3'),
      ('NU-2224-ECJC3',   'NU2224ECJC3'),
      ('NU2224.ECJ/C3',   'NU2224ECJC3'),
      ('nu2224ecj c3',    'NU2224ECJC3'),
      ('6205_2RS',        '62052RS'),
      ('6205-2RS/C3',     '62052RSC3'),
      ('S-6204-2RS',      'S62042RS'),
      ('22210 E1 TVP2',   '22210E1TVP2'),
      ('  6204  ',        '6204'),
      ('(6204)*',         '6204'),
      ('NU2224ECJC3W64',  'NU2224ECJC3W64'),
      -- 0074: la barra entre dos dígitos es el diámetro y se conserva; si no, se quita
      ('320/28X',         '320/28X'),
      ('320 / 28X',       '320/28X'),
      ('630/8-2RS',       '630/82RS'),
      ('239/500 MB C3',   '239/500MBC3'),
      ('30/5B-2RS',       '30/5B2RS'),
      ('6205-2RS/C3',     '62052RSC3'),
      ('6205-2RS / C3',   '62052RSC3'),
      ('/6204/',          '6204'),
      ('6204//C3',        '6204C3'),
      -- 0075: el punto y la coma entre dos dígitos son decimales y se conservan; la coma pasa a punto
      ('FRM-12.5/140',    'FRM12.5/140'),
      ('FRM 12,5/140',    'FRM12.5/140'),
      ('FRM-4.85/180',    'FRM4.85/180'),
      ('DH-515.207',      'DH515.207'),
      ('6205.2RS',        '6205.2RS'),
      ('6205-2RS.C3',     '62052RSC3'),
      ('NU2224,ECJ',      'NU2224ECJ'),
      ('6204.',           '6204')
    ) as t(part_number, esperada)
  loop
    insert into public.inventory_lines
      (org_id, part_number, brand, quantity, location_country, product_family, status)
    values ('10a00000-0000-4000-8000-000000000001', caso.part_number, 'SKF', 1, 'ES', 'F', 'PUBLISHED')
    returning part_key into clave;

    if clave is distinct from caso.esperada then
      raise exception '0073: % dio la clave %, se esperaba %', caso.part_number, clave, caso.esperada;
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 2 · La clave sigue a la referencia al editarla, y nadie la escribe a mano
-- -----------------------------------------------------------------------------
do $$
declare clave text;
begin
  update public.inventory_lines set part_number = '6305 ZZ'
   where org_id = '10a00000-0000-4000-8000-000000000001' and part_number = '6205_2RS'
  returning part_key into clave;
  if clave is distinct from '6305ZZ' then
    raise exception '0073: al editar la referencia la clave quedó en %, se esperaba 6305ZZ', clave;
  end if;

  begin
    update public.inventory_lines set part_key = 'OTRA'
     where org_id = '10a00000-0000-4000-8000-000000000001';
    raise exception '0073: se pudo escribir part_key a mano';
  exception when generated_always then
    null;  -- lo esperado
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 2b · Lo que fundía `0073` y ya no funde: diámetro con barra frente a la serie sin ella
-- -----------------------------------------------------------------------------
do $$
begin
  insert into public.inventory_lines
    (org_id, part_number, brand, quantity, location_country, product_family, status)
  values ('10a00000-0000-4000-8000-000000000001', '6308-2RS', 'SKF', 1, 'ES', 'F', 'PUBLISHED'),
         ('10a00000-0000-4000-8000-000000000001', '32028X',   'SKF', 1, 'ES', 'F', 'PUBLISHED');

  if exists (
    select part_key from public.inventory_lines
     where org_id = '10a00000-0000-4000-8000-000000000001'
       and part_number in ('630/8-2RS', '6308-2RS', '320/28X', '32028X')
     group by part_key having count(distinct part_number) > 1
  ) then
    raise exception '0074: una referencia con barra de diámetro comparte clave con otra sin ella';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3 · Los dos índices existen, son parciales a PUBLISHED y van sobre part_key
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'inventory_lines_part_key_prefix'
       and indexdef like '%(part_key text_pattern_ops)%' and indexdef like '%PUBLISHED%'
  ) then
    raise exception '0073: falta el índice de prefijo sobre part_key';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'inventory_lines_part_key_trgm'
       and indexdef like '%gin (part_key extensions.gin_trgm_ops)%' and indexdef like '%PUBLISHED%'
  ) then
    raise exception '0073: falta el índice trigrama sobre part_key';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4 · `authenticated` lee la columna (0071 dejó los privilegios de tabla)
-- -----------------------------------------------------------------------------
do $$
begin
  if not has_column_privilege('authenticated', 'public.inventory_lines', 'part_key', 'select') then
    raise exception '0073: authenticated no puede leer part_key';
  end if;
  if has_column_privilege('anon', 'public.inventory_lines', 'part_key', 'select') then
    raise exception '0073: anon puede leer part_key';
  end if;
end
$$;

rollback;
