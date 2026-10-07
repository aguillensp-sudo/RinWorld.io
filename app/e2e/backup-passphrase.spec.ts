import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, haveCreds, NO_SESSION, signIn, rewriteProfileState } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-06 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **SOLO LEE**: REG-06 no escribe nada (la frase se queda en memoria hasta REG-07).
 * Se llega igual que en REG-05: el navegador reescribe solo el `state` del perfil de
 * ALPHA a `REGISTERED`; la cuenta sigue ACTIVE en la base.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que zxcvbn de verdad se carga en el navegador y mide;
 *   · que la frase se compara con la contraseña con la que se ENTRÓ de verdad;
 *   · que **ninguna petición de red lleva la frase** (ADR-001, *server-blind*);
 *   · que tras una recarga (sin huella de la contraseña) se pide entrar de nuevo;
 *   · que `Continuar` lleva a REG-07.
 *
 * Desde que REG-07 existe, `Continuar` arranca la generación de claves y su subida.
 * Aquí se CORTAN las dos llamadas que escriben (`store_key_backup`,
 * `confirm_key_backup`): REG-06 sigue sin escribir nada. REG-07 tiene su e2e propio.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas REG-06 no se prueba contra la base y el verde no significa nada.',
  );
}

const FRASE = 'mesa perro azul lluvia cobre';
const TITULO = 'Crea tu frase de seguridad';
const CASILLA =
  'Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente.';

/** Reescribe SOLO el estado del perfil, y corta las escrituras de REG-07. Antes de iniciar sesión. */
async function comoRegistered(page: Page) {
  await page.route(/\/rest\/v1\/rpc\/(store_key_backup|confirm_key_backup)/, (route) => route.abort());
  await rewriteProfileState(page, () => 'REGISTERED');
}

/** Login → REG-05 → REG-06. */
async function hastaReg06(page: Page) {
  await comoRegistered(page);
  await signIn(page, ALPHA);
  await page.getByRole('button', { name: 'Entendido, crear mi frase de seguridad' }).click();
  await expect(page.getByRole('heading', { level: 1, name: TITULO })).toBeVisible();
}

test.describe('REG-06 · frase de seguridad · ADMIN en REGISTERED', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('desde REG-05 se llega a REG-06, dentro del shell con VERA «Asistente de registro»', async ({ page }) => {
    await hastaReg06(page);
    await expect(page.getByText('Asistente de registro')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('zxcvbn mide en el navegador: una contraseña predecible no llega a Fuerte', async ({ page }) => {
    await hastaReg06(page);
    await page.getByLabel('Backup passphrase', { exact: true }).fill('Qwerty123456!');
    await expect(page.getByTestId('strength-label')).toHaveText(/^(Muy débil|Débil|Aceptable)$/);
    await expect(page.getByText('La frase necesita ser más fuerte para continuar')).toBeVisible();
  });

  test('la contraseña con la que se entró no vale como frase', async ({ page }) => {
    await hastaReg06(page);
    await page.getByLabel('Backup passphrase', { exact: true }).fill(ALPHA.password);
    await expect(page.getByText('La frase de seguridad debe ser diferente a tu contraseña de acceso')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('una frase buena + repetida + casilla: «Continuar» lleva a REG-07 y NINGUNA petición lleva la frase', async ({
    page,
  }) => {
    const filtradas: string[] = [];
    page.on('request', (req) => {
      const cuerpo = req.postData() ?? '';
      if (req.url().includes(FRASE) || req.url().includes(encodeURIComponent(FRASE)) || cuerpo.includes(FRASE)) {
        filtradas.push(`${req.method()} ${req.url()}`);
      }
    });
    await hastaReg06(page);
    await page.getByLabel('Backup passphrase', { exact: true }).fill(FRASE);
    await expect(page.getByTestId('strength-label')).toHaveText(/^(Fuerte|Muy fuerte)$/);
    await page.getByLabel('Repetir backup passphrase', { exact: true }).fill(FRASE);
    await page.getByRole('checkbox', { name: CASILLA }).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Generando tus claves de seguridad' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toHaveCount(0);
    expect(filtradas).toEqual([]);
  });

  test('tras recargar no hay huella de la contraseña: se cierra la sesión y se pide entrar de nuevo', async ({ page }) => {
    await comoRegistered(page);
    await signIn(page, ALPHA);
    await expect(page.getByRole('button', { name: 'Entendido, crear mi frase de seguridad' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Entendido, crear mi frase de seguridad' }).click();
    await expect(page.getByText('Por seguridad, vuelve a iniciar sesión para crear tu frase de seguridad.')).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toHaveCount(0);
  });

  test('la pantalla tiene scroll propio: en una ventana baja «Continuar» se alcanza con la rueda', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await hastaReg06(page);
    const boton = page.getByRole('button', { name: 'Continuar' });
    await expect(boton).not.toBeInViewport();
    await page.getByRole('heading', { level: 1, name: TITULO }).hover();
    await page.mouse.wheel(0, 2000);
    await expect(boton).toBeInViewport();
  });
});
