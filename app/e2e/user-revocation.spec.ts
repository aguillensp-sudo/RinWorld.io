import './env';
import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BETA, canResetFixture, haveCreds } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · `user-revocation#1` (revocación de acceso) · F-279.
 *
 * Escrito por Claude Code (`Plan §6`); el Coder no lo ve. Cierra el «falta solo e2e» de la matriz: contra el
 * proyecto real, el ADMIN revoca a un EDITOR y **Auth le rechaza el inicio de sesión**. `ban-revoked-member`
 * corre con la service key en Deno y no tiene test propio; `invitations.parciales.test.ts` mockea la red y
 * `0037` solo prueba la mitad SQL (`CANCELLED`).
 *
 * ── POR QUÉ UN EDITOR DESECHABLE Y NO `E2E_EDITOR` ──────────────────────────────────────────────────────
 * La CI no tiene `E2E_EDITOR_PASSWORD` (`invitations.spec.ts` se salta sin ella), y revocar al EDITOR
 * compartido deja `banned_until` puesto si la corrida se cae a medias: rompería `invitations` y `visibility`.
 * Aquí el miembro se crea con la service key, se revoca y se BORRA de Auth (cascada a `members`) en un
 * `finally`; el EDITOR de las demás pruebas ni se toca. Si una corrida se cayó antes del `finally`, el
 * principio del test borra al desechable que quedara.
 *
 * Lo único que se ejerce es el camino real: `remove_member` (RPC con la sesión del ADMIN, BETA) →
 * `ban-revoked-member` (Edge Function desplegada en esta instancia, `ci.yml`) → `signInWithPassword` del
 * revocado, que tiene que dar `user_banned`.
 */
if (process.env.CI && (!haveCreds || !canResetFixture)) {
  throw new Error(
    'En CI hacen falta E2E_BETA_* y SUPABASE_SERVICE_KEY. Sin ellas user-revocation#1 no se prueba contra la base y el verde no significa nada.',
  );
}

const URL = process.env.VITE_SUPABASE_URL ?? '';
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL = 'zz.revocado@bearingworld.test';
// Contraseña aleatoria de un solo uso: la cuenta no sobrevive al test.
const PASSWORD = `Zz-${crypto.randomUUID()}-Aa1!`;

const cliente = (key: string): SupabaseClient => createClient(URL, key, { auth: { persistSession: false } });

async function borrarDesechable(db: SupabaseClient) {
  const { data: miembro } = await db.from('members').select('id').eq('email', EMAIL).maybeSingle();
  if (miembro?.id) {
    const { error } = await db.auth.admin.deleteUser(miembro.id);
    if (error) throw new Error(`borrando al Editor desechable: ${error.message}`);
  }
}

test.describe('user-revocation#1 · revocar a un Editor le corta el inicio de sesión', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.skip(!canResetFixture, 'sin service key no se puede crear ni borrar al Editor desechable');

  test('remove_member + ban-revoked-member: Auth rechaza el login del revocado', async () => {
    const db = cliente(SERVICE);
    await borrarDesechable(db);

    const { data: admin } = await db.from('members').select('id, org_id').eq('email', BETA.email).single();
    expect(admin).not.toBeNull();

    try {
      const creado = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
      expect(creado.error).toBeNull();
      const editorId = creado.data.user!.id;
      const alta = await db
        .from('members')
        .insert({ id: editorId, org_id: admin!.org_id, email: EMAIL, full_name: 'Editor Revocado', role: 'EDITOR', state: 'ACTIVE' });
      expect(alta.error).toBeNull();

      // Antes de revocar, el Editor entra: si esto falla, el test no prueba nada de lo que sigue.
      const antes = await cliente(PUBLISHABLE).auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
      expect(antes.error).toBeNull();

      // El ADMIN (BETA) lo revoca con su propia sesión, como desde Configuración.
      const comoAdmin = cliente(PUBLISHABLE);
      const sesion = await comoAdmin.auth.signInWithPassword({ email: BETA.email, password: BETA.password });
      expect(sesion.error).toBeNull();
      const baja = await comoAdmin.rpc('remove_member', { p_member_id: editorId });
      expect(baja.error).toBeNull();
      const bloqueo = await comoAdmin.functions.invoke('ban-revoked-member', { body: { member_id: editorId } });
      expect(bloqueo.error).toBeNull();
      expect(bloqueo.data).toMatchObject({ banned: true });

      // Lo que la matriz pedía: Auth ya no le deja iniciar sesión.
      const despues = await cliente(PUBLISHABLE).auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
      expect(despues.data.session).toBeNull();
      expect(despues.error?.code).toBe('user_banned');
    } finally {
      await borrarDesechable(db);
    }
  });
});
