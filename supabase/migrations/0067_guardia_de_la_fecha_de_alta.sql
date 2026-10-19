-- 0067 · F-273 · la fecha de alta de la organización no la mueve el cliente.
--
-- `organizations.created_at` es el inicio de la prueba de 90 días: de ella salen `billing_org_status`
-- (`trial_ends_at`, `EN PRUEBA`) y `app.billing_evaluate_expirations`. El guardia de `0036` protegía nombre,
-- país, estado, contacto y dirección, pero no esta columna, y un ADMIN con RLS (`organizations_update_visibility_admin`)
-- la movía hacia el futuro: prórroga de la prueba sin límite, que la spec de `billing-subscription`
-- («ausencia absoluta de extensión manual») prohíbe.
--
-- Idéntico al de `0036` más una comparación. Sigue SIN `security definer` (ancla de F-155 en
-- `01_schema_smoke.sql`). Comprobado el 19-oct con SQL en producción: ninguna organización tiene el alta en el futuro.
create or replace function app.guard_organization_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  if new.name   is distinct from old.name
  or new.legal_name is distinct from old.legal_name
  or new.country is distinct from old.country
  or new.continent is distinct from old.continent
  or new.status is distinct from old.status
  or new.created_at is distinct from old.created_at
  or new.favorite_count is distinct from old.favorite_count
  or new.contact_phone is distinct from old.contact_phone
  or new.contact_email is distinct from old.contact_email
  or new.address is distinct from old.address
  or new.city is distinct from old.city
  or new.postal_code is distinct from old.postal_code then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode y visibility_scope_enabled; el resto es del operador o derivado';
  end if;
  return new;
end;
$$;
