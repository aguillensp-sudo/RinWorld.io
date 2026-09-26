import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, BETA, haveCreds, NO_SESSION, signIn } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-09 · contra el Supabase real (el de FRU vive en `additional-user.spec.ts`, F-219).
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **SOLO LEE**: no crea ninguna cuenta ni activa a nadie (F-188).
 *
 * **Cómo se llega a una pantalla que nadie ve hoy.** Ninguna cuenta de prueba está en
 * `KEY_ACTIVE` (el flujo que lleva hasta ahí, REG-05 a REG-07, no existe), y cambiar el
 * estado de una cuenta real rompería el resto de la suite. Así que el navegador
 * reescribe **solo el `state` de la respuesta del perfil** (`members?…organizations`):
 * la cuenta sigue siendo ACTIVE en la base, y por eso las funciones que consultan
 * (`onboarding_seats_used`, que acepta ADMIN `KEY_ACTIVE` o
 * `ACTIVE`, 0038) responden con datos REALES. Que un `KEY_ACTIVE` de verdad pueda
 * llamarlas lo mide el banco de esquema, no esto.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que el wiring ponga REG-09 en el panel de un ADMIN `KEY_ACTIVE`, y solo de él;
 *   · que las plazas salgan de la base (`3 de 5` en Nordwälz) y no del ejemplo;
 *
 * Datos de `scripts/demo-reset.mjs`: Nordwälz Lager (BETA) tiene un ADMIN, un Editor y
 * una invitación pendiente = 3 plazas. Rodamientos Ibéricos (ALPHA) solo su ADMIN.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas REG-09 no se prueba contra la base y el verde no significa nada.',
  );
}

const EDITOR = {
  email: process.env.E2E_EDITOR_EMAIL ?? 'editor@bearingworld.test',
  password: process.env.E2E_EDITOR_PASSWORD ?? '',
};

/** Reescribe SOLO el estado del perfil. Se registra ANTES de iniciar sesión. */
async function comoKeyActive(page: Page) {
  await page.route(/\/rest\/v1\/members\?.*organizations/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
    const parche = (fila: Record<string, unknown>) => ({ ...fila, state: 'KEY_ACTIVE' });
    await route.fulfill({ response, json: Array.isArray(body) ? body.map(parche) : parche(body) });
  });
}

test.describe('REG-09 · bienvenida · ADMIN en KEY_ACTIVE', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('un ADMIN solo: título de bienvenida, su organización, los dos botones y SIN contador', async ({ page }) => {
    await comoKeyActive(page);
    await signIn(page, ALPHA);
    await expect(page.getByRole('heading', { level: 1, name: /^¡Bienvenido a Bearingworld\.io, .+!$/ })).toBeVisible();
    await expect(page.getByText(/ya está activa\. Antes de ir al panel/)).toContainText('Rodamientos Ibéricos');
    await expect(page.getByText('¿Deseas añadir usuarios ahora?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sí, añadir un usuario ahora' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Ir al panel' })).toBeEnabled();
    await expect(page.getByTestId('user-counter')).toHaveCount(0);
  });

  test('las plazas salen de la base: en Nordwälz (ADMIN, Editor y una pendiente) dice «3 de 5»', async ({ page }) => {
    await comoKeyActive(page);
    await signIn(page, BETA);
    await expect(page.getByRole('heading', { level: 1, name: '¿Quieres añadir otro usuario?' })).toBeVisible();
    await expect(page.getByTestId('user-counter')).toHaveText('3 de 5 usuarios registrados');
    await expect(page.getByRole('button', { name: 'Sí, añadir un usuario ahora' })).toBeVisible();
  });

  test('VERA dice «Asistente de registro»', async ({ page }) => {
    await comoKeyActive(page);
    await signIn(page, ALPHA);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Asistente de registro')).toBeVisible();
    // «Ir al panel» NO se pulsa: activaría la cuenta en producción (F-188).
  });
});

test.describe('REG-09 · quién NO la ve', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');

  test.describe('un Editor, aunque su perfil dijera KEY_ACTIVE', () => {
    test.skip(!EDITOR.password, 'sin E2E_EDITOR_PASSWORD no hay cuenta de Editor con la que probarlo');
    test.use({ storageState: NO_SESSION });

    test('entra en el shell normal: el onboarding es solo del ADMIN', async ({ page }) => {
      await comoKeyActive(page);
      await signIn(page, EDITOR);
      await expect(page.getByRole('heading', { name: /Bienvenido a Bearingworld\.io/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sí, añadir un usuario ahora' })).toHaveCount(0);
    });
  });

  test.describe('un ADMIN ACTIVE normal', () => {
    test.use({ storageState: NO_SESSION });

    test('entra en su panel, no en la bienvenida', async ({ page }) => {
      await signIn(page, ALPHA);
      await expect(page.getByRole('heading', { name: /Bienvenido a Bearingworld\.io/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Ir al panel' })).toHaveCount(0);
    });
  });
});
