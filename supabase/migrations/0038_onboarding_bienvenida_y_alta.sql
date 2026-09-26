-- =============================================================================
-- 0038 · Bienvenida del ADMIN y alta de usuarios adicionales (REG-09, FRU)
-- =============================================================================
-- REG-09 es la última pantalla del onboarding: el ADMIN acaba de dejar su clave
-- lista (`KEY_ACTIVE`) y decide si registra más usuarios antes de entrar. FRU es el
-- formulario con el que los registra. Ninguna de las dos tenía dónde apoyarse:
--
--   · Un miembro `KEY_ACTIVE` no pasa `app.is_active_member()`, así que la RLS no
--     le deja leer la lista de su organización y REG-09 no puede saber cuántas
--     plazas lleva ocupadas.
--   · `members.state` solo lo mueve el servidor (`guard_member_privileges`, 0001),
--     así que «No, ir al panel» --que pasa a `ACTIVE`-- necesita una función.
--   · Dar de alta a alguien exige crear su cuenta de Auth, y eso es de la API de
--     administración: lo hace la Edge Function `register-additional-member`, que
--     escribe la fila de `members` por `add_registered_member` (más abajo).
--
-- **Qué NO hace, y es deliberado.**
--   · No manda ningún correo (mismo criterio que INVT-01, F-212): no hay proveedor.
--     La cuenta se crea confirmada y el ADMIN debe pasarle las credenciales.
--   · No monta el flujo E2EE del nuevo usuario (REG-05, REG-06, REG-07 no existen):
--     queda `REGISTERED`, que no da acceso a ningún dato, hasta que ese flujo
--     exista. Tampoco existe el camino que lleva a nadie a `KEY_ACTIVE`: REG-09 se
--     ve hoy solo para un ADMIN que ya esté en ese estado.
--
-- **Quién puede qué.** `app.is_onboarding_admin()` es ADMIN en `KEY_ACTIVE` o
-- `ACTIVE`: el ADMIN que registra usuarios desde REG-09 aún no es `ACTIVE`, y el de
-- INVT-01 sí. Las tres funciones de cliente comprueban DENTRO que quien llama lo es.
-- =============================================================================

create or replace function app.is_onboarding_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
     where id = auth.uid() and role = 'ADMIN' and state in ('KEY_ACTIVE', 'ACTIVE')
  );
$$;

-- Plazas ocupadas de MI organización (miembros no revocados + invitaciones
-- pendientes): el contador de REG-09. Devuelve un número, no filas: un miembro
-- `KEY_ACTIVE` no puede leer `members`, y no hace falta que pueda.
create or replace function public.onboarding_seats_used()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_onboarding_admin() then
    raise exception 'Solo el administrador de la organización puede consultar sus plazas.';
  end if;
  return app.org_seats_used(app.current_org_id());
end;
$$;

-- «No, ir al panel»: KEY_ACTIVE → ACTIVE, y solo el propio ADMIN, y solo una vez.
create or replace function public.activate_own_membership()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update public.members
     set state = 'ACTIVE'
   where id = auth.uid() and role = 'ADMIN' and state = 'KEY_ACTIVE';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Tu cuenta no está pendiente de activación.';
  end if;
end;
$$;

-- «Este email ya tiene cuenta»: FRU lo comprueba en tiempo real igual que INVT-01,
-- pero desde REG-09 quien pregunta es un ADMIN `KEY_ACTIVE`. Mismo cuerpo que en
-- 0037; solo cambia la puerta.
create or replace function public.email_has_account(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not app.is_onboarding_admin() then
    raise exception 'Solo el administrador de la organización puede comprobar emails.';
  end if;
  return exists (select 1 from public.members where lower(email) = v_email)
      or exists (select 1 from auth.users where lower(email) = v_email);
end;
$$;

-- La fila de `members` del usuario adicional. **Solo `service_role`**: la llama la
-- Edge Function después de crear la cuenta de Auth, y por eso NO comprueba quién es
-- el que pide (lo hizo la función, con el JWT); sí aplica el límite de 5, que es una
-- regla del dato y no de quien lo pide. El rol lo pone `assign_member_role` (0001):
-- una organización con miembros solo recibe EDITOR.
create or replace function public.add_registered_member(
  p_id uuid, p_org uuid, p_email text, p_full_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if app.org_seats_used(p_org) >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios.';
  end if;
  insert into public.members (id, org_id, email, full_name, state, visibility_scope)
  values (p_id, p_org, lower(btrim(p_email)), btrim(p_full_name), 'REGISTERED', 'OWN');
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios (F-146, F-192: se leen del catálogo, no de este fichero)
-- -----------------------------------------------------------------------------
revoke execute on function app.is_onboarding_admin() from public, anon, authenticated;

revoke execute on function public.onboarding_seats_used()   from public, anon;
revoke execute on function public.activate_own_membership() from public, anon;
grant  execute on function public.onboarding_seats_used()   to authenticated;
grant  execute on function public.activate_own_membership() to authenticated;

revoke execute on function public.add_registered_member(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.add_registered_member(uuid, uuid, text, text) to service_role;
