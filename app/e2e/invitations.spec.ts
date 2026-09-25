import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA_STORAGE, BETA, canResetFixture, haveCreds, NO_SESSION, sidebar, signIn } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · INVT-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **SOLO LEE**: no invita, no reenvía y no elimina (F-188: las C5 y los e2e contra
 * producción no pulsan nada que escriba). Lo que escribe lo mide el banco de
 * esquema (`0037`, en `01_schema_smoke.sql`), no un navegador contra producción.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `Invitations.test.tsx` mockea las seis funciones de red, así que pasaría entero con:
 *
 *   · una pantalla que un ADMIN no puede abrir -sin `Configuración` cableado en el
 *     shell, INVT-01 no tiene ninguna ruta real-;
 *   · `0037` sin aplicar: `member_invitation_list` no existiría y la pantalla se
 *     quedaría en la alerta de carga;
 *   · un Editor que ve la pantalla de administración;
 *   · `Este email ya tiene cuenta` sin llamar de verdad a `email_has_account`.
 *
 * Los datos son los que `scripts/demo-reset.mjs` (`reponerInvitaciones`) siembra en
 * Nordwälz Lager: un ADMIN (BETA), un Editor y tres invitaciones -Pendiente,
 * Aceptada y Expirada-. Igual que en el resto de e2e (F-015): si faltan
 * credenciales en CI, esto es un error duro.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas INVT-01 no se prueba contra la base y el verde no significa nada.',
  );
}

const EDITOR = {
  email: process.env.E2E_EDITOR_EMAIL ?? 'editor@bearingworld.test',
  password: process.env.E2E_EDITOR_PASSWORD ?? '',
};

async function abrirInvitaciones(page: Page) {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await sidebar(page).getByRole('button', { name: 'Configuración' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gestión de invitaciones' })).toBeVisible();
  // Se espera a la tabla, no solo al título: leer filas antes de que llegue la
  // consulta encuentra cero y falla por carrera, no por defecto (F-159).
  await expect(page.getByTestId('capacity-count')).toBeVisible();
}

test.describe('INVT-01 · invitaciones reales · ADMIN de Nordwälz Lager', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.skip(!canResetFixture, 'sin service key no se puede reponer la siembra de invitaciones');
  test.use({ storageState: NO_SESSION });

  test.beforeEach(async ({ page }) => {
    await signIn(page, BETA);
    await abrirInvitaciones(page);
  });

  test('pinta la capacidad del ejemplo aprobado: 2/5, una pendiente, dos plazas libres', async ({ page }) => {
    await expect(page.getByTestId('capacity-count')).toHaveText('2/5');
    await expect(page.getByTestId('capacity-detail')).toContainText('1 invitación pendiente');
    await expect(page.getByTestId('capacity-detail')).toContainText('2 plazas libres');
    await expect(page.getByText(/ha alcanzado el límite de 5 usuarios/)).toHaveCount(0);
  });

  test('las invitaciones salen de la base: Pendiente, Aceptada y Expirada, y solo la expirada se reenvía', async ({ page }) => {
    const tabla = page.getByRole('table', { name: 'Invitaciones enviadas' });
    const pendiente = tabla.getByRole('row', { name: /carlos\.m@aceroindustrial\.com/ });
    await expect(pendiente).toContainText('Pendiente');
    await expect(pendiente).toContainText('5 días');
    await expect(tabla.getByRole('row', { name: /editor@bearingworld\.test/ })).toContainText('Aceptada');
    await expect(tabla.getByRole('row', { name: /m\.sanchez@aceroindustrial\.com/ })).toContainText('Expirada');
    await expect(tabla.getByRole('button')).toHaveCount(1);
    await expect(tabla.getByRole('button', { name: 'Reenviar m.sanchez@aceroindustrial.com' })).toBeVisible();
  });

  test('los usuarios salen de la base: el ADMIN sin botón y el Editor con «Eliminar»', async ({ page }) => {
    const tabla = page.getByRole('table', { name: 'Usuarios activos' });
    const admin = tabla.getByRole('row', { name: /beta@bearingworld\.test/ });
    await expect(admin).toContainText('Admin');
    await expect(admin.getByRole('button')).toHaveCount(0);
    const editor = tabla.getByRole('row', { name: /editor@bearingworld\.test/ });
    await expect(editor).toContainText('Editor');
    await expect(editor.getByRole('button', { name: /^Eliminar / })).toBeVisible();
  });

  test('«Eliminar» abre la confirmación y «Cancelar» la cierra SIN eliminar', async ({ page }) => {
    const tabla = page.getByRole('table', { name: 'Usuarios activos' });
    await tabla.getByRole('button', { name: /^Eliminar / }).click();
    const dialogo = page.getByRole('dialog', { name: 'Eliminar usuario' });
    await expect(dialogo).toContainText('Esta acción es irreversible. El usuario perderá acceso inmediatamente.');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Y sigue ahí: cancelar no toca la base.
    await expect(tabla.getByRole('button', { name: /^Eliminar / })).toBeVisible();
  });

  test('la comprobación «ya tiene cuenta» consulta de verdad la base, y un email libre habilita el envío (que NO se pulsa)', async ({ page }) => {
    const campo = page.getByRole('textbox', { name: 'Email del nuevo usuario' });
    const enviar = page.getByRole('button', { name: 'Enviar invitación' });
    await expect(enviar).toBeDisabled();

    await campo.fill('alpha@bearingworld.test');
    await expect(page.getByText('Este email ya tiene cuenta en Bearingworld.io.')).toBeVisible();
    await expect(enviar).toBeDisabled();

    await campo.fill('libre-e2e@empresa-inexistente.test');
    await expect(page.getByText('Este email ya tiene cuenta en Bearingworld.io.')).toHaveCount(0);
    await expect(enviar).toBeEnabled();
    // NO se pulsa: escribiría una invitación en producción (F-188).
  });
});

test.describe('INVT-01 · quién llega a la pantalla', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');

  test.describe('el ADMIN de Rodamientos Ibéricos', () => {
    test.use({ storageState: ALPHA_STORAGE });

    test('ve la pantalla desde «Configuración», con su propia organización: 1/5', async ({ page }) => {
      await page.goto('/');
      await abrirInvitaciones(page);
      await expect(page.getByTestId('capacity-count')).toHaveText('1/5');
      // Es SU lista, no la de Nordwälz: ni el editor ni las invitaciones sembradas de la otra.
      await expect(page.getByText('editor@bearingworld.test')).toHaveCount(0);
      await expect(page.getByText('carlos.m@aceroindustrial.com')).toHaveCount(0);
    });
  });

  test.describe('un Editor', () => {
    test.skip(!EDITOR.password, 'sin E2E_EDITOR_PASSWORD no hay cuenta de Editor con la que probarlo');
    test.use({ storageState: NO_SESSION });

    test('no tiene «Configuración»: no puede abrir la pantalla de administración', async ({ page }) => {
      await signIn(page, EDITOR);
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await expect(sidebar(page)).toBeVisible();
      await expect(sidebar(page).getByRole('button', { name: 'Configuración' })).toHaveCount(0);
    });
  });
});
