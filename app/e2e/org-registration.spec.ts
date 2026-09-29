import './env';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { NO_SESSION } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-01 · FRO, contra el build real y sin sesión.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve. **NO CREA
 * NADA**: la Edge Function `register-organization` se INTERCEPTA con `page.route` y contesta
 * lo que este fichero dice (F-188: crear una cuenta y una organización en la base que el
 * navegador tiene delante no se hace desde un test). Lo que la función escribe lo midió el
 * banco de esquema (`0041`) y la propia función con `curl` contra una solicitud sintética,
 * borrada después.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que el enlace `#registro?token=…` lleve a la pantalla, y que uno que no vale no;
 *   · que la página entera se pinte fuera del shell, con el logo y sin menú;
 *   · que el formulario funcione en el build real con lo que devuelve la función;
 *   · que un enlace que no vale se pueda abandonar y la URL quede limpia.
 */

const TOKEN = 'ef'.repeat(32);
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const PREFILL = {
  org_name: 'Rodamientos del Sur SL',
  country: 'ES',
  applicant_full_name: 'Juan Martínez Herrera',
  applicant_email: 'juan@rodamientosdelsur.test',
  applicant_phone: '+34 954 123 456',
  website: 'https://www.rodamientosdelsur.test',
  expires_at: '2099-01-01T00:00:00Z',
};

type Respuesta = { status: number; body: Record<string, unknown> };

/** Intercepta la función de borde: `responder` decide por la acción del cuerpo. */
async function interceptar(page: Page, responder: (accion: string) => Respuesta) {
  await page.route('**/functions/v1/register-organization', async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const cuerpo = route.request().postDataJSON() as { action?: string };
    const { status, body } = responder(cuerpo.action ?? '');
    await route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
}

const valido = (accion: string): Respuesta =>
  accion === 'validate'
    ? { status: 200, body: { prefill: PREFILL } }
    : accion === 'check_email'
      ? { status: 200, body: { available: true } }
      : { status: 200, body: { registered: true } };

test.describe('REG-01 · FRO sin sesión', () => {
  test.use({ storageState: NO_SESSION });

  test('con un enlace que no tiene forma de enlace se ve el login, no el formulario', async ({ page }) => {
    await page.goto('/#registro?token=abc');
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });

  test('un enlace que no vale enseña «Este enlace no es válido» y se puede abandonar dejando la URL limpia', async ({ page }) => {
    await interceptar(page, () => ({ status: 404, body: { error: 'El enlace no es válido o ha caducado.' } }));
    await page.goto(`/#registro?token=${TOKEN}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Este enlace no es válido' })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);

    await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    expect(page.url()).not.toContain('registro');
  });

  test('con un enlace válido se ve el formulario entero, fuera del shell y con lo del FSR ya puesto', async ({ page }) => {
    await interceptar(page, valido);
    await page.goto(`/#registro?token=${TOKEN}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Crear tu cuenta en Bearingworld.io' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bearingworld.io' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0); // fuera del shell
    await expect(page.getByText('VERA')).toHaveCount(0);

    await expect(page.getByRole('textbox', { name: 'Nombre legal de la empresa' })).toHaveValue('Rodamientos del Sur SL');
    await expect(page.getByRole('combobox', { name: 'País de sede' })).toHaveValue('ES');
    await expect(page.getByRole('combobox', { name: 'Prefijo telefónico' })).toHaveValue('ES');
    await expect(page.getByRole('textbox', { name: 'Teléfono de contacto público' })).toHaveValue('954 123 456');
    await expect(page.getByRole('textbox', { name: 'Email del administrador' })).toHaveValue('juan@rodamientosdelsur.test');
    await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
  });

  test('la página entera se puede recorrer: el botón final se alcanza con scroll', async ({ page }) => {
    await interceptar(page, valido);
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`/#registro?token=${TOKEN}`);
    const crear = page.getByRole('button', { name: 'Crear mi cuenta' });
    await crear.scrollIntoViewIfNeeded();
    await expect(crear).toBeInViewport();
  });

  test('rellenado y con los términos, «Crear mi cuenta» se habilita; un email ocupado se avisa al salir del campo', async ({ page }) => {
    let ocupado = false;
    await interceptar(page, (accion) =>
      accion === 'check_email' ? { status: 200, body: { available: !ocupado } } : valido(accion),
    );
    await page.goto(`/#registro?token=${TOKEN}`);
    await page.getByRole('textbox', { name: /^NIF \/ CIF/ }).fill('B-12345678');
    await page.getByRole('textbox', { name: 'Dirección' }).fill('Calle Industria, 47, Nave 3');
    await page.getByRole('textbox', { name: 'Código postal' }).fill('41900');
    await page.getByRole('textbox', { name: 'Email de contacto público' }).fill('info@sur.test');
    await page.getByLabel(/^Contraseña\s*\*?$/).fill('Correcta-2026!');
    await page.getByLabel(/^Repetir contraseña\s*\*?$/).fill('Correcta-2026!');
    const crear = page.getByRole('button', { name: 'Crear mi cuenta' });
    await expect(crear).toBeDisabled();
    await page.getByRole('checkbox', { name: /Acepto los Términos y Condiciones/ }).check();
    await expect(crear).toBeEnabled();

    ocupado = true;
    const email = page.getByRole('textbox', { name: 'Email del administrador' });
    await email.fill('ocupado@sur.test');
    await email.blur();
    await expect(page.getByText('Este email ya tiene cuenta en Bearingworld.io')).toBeVisible();
  });

  test('países y marcas se añaden con Intro y se quitan, sin enviar el formulario', async ({ page }) => {
    await interceptar(page, valido);
    await page.goto(`/#registro?token=${TOKEN}`);
    const paises = page.getByRole('textbox', { name: 'Países de operación' });
    await paises.fill('Alemania');
    await paises.press('Enter');
    // El texto `Alemania (DE)` también es una <option> de los desplegables: se mide por el botón.
    await expect(page.getByRole('button', { name: 'Eliminar Alemania (DE)' })).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar Alemania (DE)' }).click();
    await expect(page.getByRole('button', { name: 'Eliminar Alemania (DE)' })).toHaveCount(0);

    const marcas = page.getByRole('textbox', { name: 'Marcas principales que distribuye' });
    await marcas.fill('SKF');
    await marcas.press('Enter');
    await expect(page.getByRole('button', { name: 'Eliminar SKF' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Crear tu cuenta en Bearingworld.io' })).toBeVisible();
  });

  test('si la función da de alta y el inicio de sesión falla, lo dice sin fingir que salió mal', async ({ page }) => {
    // La función está interceptada: no se crea nada. El inicio de sesión sí es real y falla,
    // porque esa cuenta no existe: es exactamente la rama «alta correcta, sesión no».
    await interceptar(page, valido);
    await page.goto(`/#registro?token=${TOKEN}`);
    await page.getByRole('textbox', { name: /^NIF \/ CIF/ }).fill('B-12345678');
    await page.getByRole('textbox', { name: 'Dirección' }).fill('Calle Industria, 47, Nave 3');
    await page.getByRole('textbox', { name: 'Código postal' }).fill('41900');
    await page.getByRole('textbox', { name: 'Email de contacto público' }).fill('info@sur.test');
    await page.getByLabel(/^Contraseña\s*\*?$/).fill('Correcta-2026!');
    await page.getByLabel(/^Repetir contraseña\s*\*?$/).fill('Correcta-2026!');
    await page.getByRole('checkbox', { name: /Acepto los Términos y Condiciones/ }).check();
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click();

    await expect(page.getByRole('alert')).toContainText('Tu cuenta se ha creado, pero no se pudo iniciar sesión');
    await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeEnabled();
  });
});
