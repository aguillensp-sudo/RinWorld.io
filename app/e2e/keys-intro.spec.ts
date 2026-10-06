import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, haveCreds, NO_SESSION, signIn } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-05 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **SOLO LEE**: no crea ninguna cuenta ni cambia el estado de nadie (F-188). REG-05
 * no escribe nada, así que pulsar su botón es seguro: lleva al marcador de REG-06.
 *
 * **Cómo se llega.** Un ADMIN nace `REGISTERED` en REG-01 (F-226), pero ninguna
 * cuenta de prueba lo está, y cambiar una de verdad rompería el resto de la suite.
 * Igual que en REG-09 (`onboarding.spec.ts`), el navegador reescribe **solo el
 * `state` de la respuesta del perfil**: la cuenta sigue ACTIVE en la base.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que el wiring ponga REG-05 en el panel de un ADMIN `REGISTERED`, y solo de él;
 *   · que vaya dentro del shell con VERA `Asistente de registro`;
 *   · que el botón lleve a REG-06.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas REG-05 no se prueba contra la base y el verde no significa nada.',
  );
}

const EDITOR = {
  email: process.env.E2E_EDITOR_EMAIL ?? 'editor@bearingworld.test',
  password: process.env.E2E_EDITOR_PASSWORD ?? '',
};

const TITULO = /^Antes de continuar,\s*una cosa importante$/;
const BOTON = 'Entendido, crear mi frase de seguridad';

/** Reescribe SOLO el estado del perfil. Se registra ANTES de iniciar sesión. */
async function comoRegistered(page: Page) {
  await page.route(/\/rest\/v1\/members\?.*organizations/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
    const parche = (fila: Record<string, unknown>) => ({ ...fila, state: 'REGISTERED' });
    await route.fulfill({ response, json: Array.isArray(body) ? body.map(parche) : parche(body) });
  });
}

test.describe('REG-05 · introducción a las claves · ADMIN en REGISTERED', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('ve el título, los tres bloques, el aviso y el botón, con «Seguridad» como paso actual', async ({ page }) => {
    await comoRegistered(page);
    await signIn(page, ALPHA);
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Tus negociaciones son privadas',
      'Tú tienes la llave',
      'Necesitas una frase de seguridad',
    ]);
    await expect(page.getByText('Anota tu frase de seguridad en un lugar seguro.')).toBeVisible();
    const pasos = page.getByRole('list', { name: 'Pasos del registro' });
    await expect(pasos.locator('li[aria-current="step"]')).toContainText('Seguridad');
    await expect(page.getByRole('button', { name: BOTON })).toBeEnabled();
  });

  test('va dentro del shell: VERA dice «Asistente de registro»', async ({ page }) => {
    await comoRegistered(page);
    await signIn(page, ALPHA);
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toBeVisible();
    await expect(page.getByText('Asistente de registro')).toBeVisible();
  });

  test('el botón lleva a REG-06 (hoy, su marcador) y REG-05 desaparece', async ({ page }) => {
    await comoRegistered(page);
    await signIn(page, ALPHA);
    await page.getByRole('button', { name: BOTON }).click();
    // El marcador mientras REG-06 no exista; su título cuando exista (ampliado el 6-oct
    // al preparar REG-06: la tarea de REG-06 sustituye el marcador).
    await expect(
      page.getByTestId('reg06-placeholder').or(page.getByRole('heading', { level: 1, name: 'Crea tu frase de seguridad' })),
    ).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toHaveCount(0);
  });

  test('la pantalla tiene scroll propio: en una ventana baja el botón se alcanza', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await comoRegistered(page);
    await signIn(page, ALPHA);
    const boton = page.getByRole('button', { name: BOTON });
    // Con la rueda y no con `scrollIntoViewIfNeeded`: este último desplaza también un
    // contenedor `overflow: hidden`, y la prueba pasaría sin scroll propio.
    await expect(boton).not.toBeInViewport();
    await page.getByRole('heading', { level: 1, name: TITULO }).hover();
    await page.mouse.wheel(0, 2000);
    await expect(boton).toBeInViewport();
  });
});

test.describe('REG-05 · quién NO la ve', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');

  test.describe('un Editor, aunque su perfil dijera REGISTERED', () => {
    test.skip(!EDITOR.password, 'sin E2E_EDITOR_PASSWORD no hay cuenta de Editor con la que probarlo');
    test.use({ storageState: NO_SESSION });

    test('no entra en la fase de claves: es solo del ADMIN (F-217)', async ({ page }) => {
      await comoRegistered(page);
      await signIn(page, EDITOR);
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
      await expect(page.getByText('Asistente de registro')).toHaveCount(0);
      await expect(page.getByRole('button', { name: BOTON })).toHaveCount(0);
    });
  });

  test.describe('un ADMIN ACTIVE normal', () => {
    test.use({ storageState: NO_SESSION });

    test('entra en su panel, no en la introducción a las claves', async ({ page }) => {
      await signIn(page, ALPHA);
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
      await expect(page.getByRole('heading', { name: TITULO })).toHaveCount(0);
      await expect(page.getByRole('button', { name: BOTON })).toHaveCount(0);
    });
  });
});
