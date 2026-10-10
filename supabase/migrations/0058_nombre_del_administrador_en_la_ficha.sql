-- =============================================================================
-- 0058 · DIR-02: el nombre de la persona administradora, en la ficha de la organización
-- =============================================================================
-- Decisión del PO, 10-oct-2026: la ficha pública enseña quién es el administrador de la empresa.
-- `members` solo es legible dentro de la propia organización (`members_select_own_org`), así que una
-- consulta directa desde otra empresa no devuelve nada. Esta función es la ÚNICA puerta, y devuelve
-- UN dato —el nombre— y nada más: ni el correo (que tiene su propio campo público), ni el id, ni las
-- claves.
--
-- Quién puede llamarla: un miembro ACTIVE de cualquier organización, y solo sobre organizaciones
-- APPROVED (las mismas que enseña el directorio). Si la organización no tiene un ADMIN ACTIVE con
-- nombre, devuelve NULL y la ficha pinta un guion. Con varios ADMIN, el más antiguo.
-- =============================================================================

create or replace function public.organization_admin_name(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(btrim(m.full_name), '')
    from public.members m
    join public.organizations o on o.id = m.org_id
   where m.org_id = p_org_id
     and o.status = 'APPROVED'
     and m.role = 'ADMIN'
     and m.state = 'ACTIVE'
     and (select app.is_active_member())
   order by m.created_at, m.id
   limit 1
$$;

revoke execute on function public.organization_admin_name(uuid) from public, anon;
grant  execute on function public.organization_admin_name(uuid) to authenticated;
