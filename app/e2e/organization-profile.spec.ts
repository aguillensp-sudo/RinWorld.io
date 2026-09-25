import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · DIR-02 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **SOLO LEE**: no pulsa nada que escriba (F-188). `Contactar` con hilo previo solo
 * ABRE un hilo que ya existe.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `OrganizationProfile.test.tsx` mockea `fetchOrganizationProfile` y
 * `fetchThreadWithOrg`, así que pasaría entero con:
 *
 *   · una ficha que nunca llega a montarse de verdad -sin el wiring de
 *     `Empresas` → nombre de la fila, DIR-02 no tiene ninguna ruta real-;
 *   · una ficha que pinte el ejemplo del HTML aprobado (`NSK Europe Ltd`) en vez de
 *     la fila de la base;
 *   · `0036` sin aplicar: la consulta pide `address`/`city`/`postal_code` y, si no
 *     existen, PostgREST devuelve error y la ficha se queda en la alerta;
 *   · `Contactar` que no encuentre el hilo real entre las dos organizaciones -el
 *     orden canónico `org_low_id < org_high_id` es fácil de escribir al revés-.
 *
 * Igual que en el resto de e2e (F-015): si faltan credenciales en CI, esto es un
 * error duro.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas DIR-02 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Los datos de `supabase/seed/demo_orgs.sql` para Cuscinetti Padana. */
const PADANA = {
  name: 'Cuscinetti Padana',
  pais: 'Italia',
  calle: "Via dell'Industria 8",
  ciudad: '41122 Módena',
  cp: '41122',
  telefono: '+39 02 4567 8900',
  telHref: 'tel:+390245678900',
  email: 'info@cuscinettipadana.it',
};

async function abrirFicha(page: Page, nombre: string) {
  await page.goto('/');
  await topNav(page).getByRole('button', { name: 'Empresas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await page.getByRole('button', { name: nombre, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
}

test.describe('DIR-02 · ficha pública real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test('pinta la fila de la base -no el ejemplo del HTML aprobado-', async ({ page }) => {
    await abrirFicha(page, PADANA.name);
    await expect(page.getByText('NSK Europe Ltd')).toHaveCount(0);

    await expect(page.getByTestId('org-country')).toHaveText(PADANA.pais);
    await expect(page.getByText('ACTIVA', { exact: true })).toBeVisible();
    await expect(page.getByText(/^★ \d+ favoritos?$/)).toBeVisible();

    const general = page.getByRole('region', { name: 'Información general' });
    await expect(general).toContainText(PADANA.calle);
    await expect(general).toContainText(PADANA.ciudad);
    await expect(general.locator('dd', { hasText: /^\s*41122\s*$/ })).toBeVisible();
    await expect(general).toContainText(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) 20\d\d/);
  });

  test('el contacto público es un enlace tel: y otro mailto:', async ({ page }) => {
    await abrirFicha(page, PADANA.name);
    const contacto = page.getByRole('region', { name: 'Contacto público' });
    await expect(contacto.getByRole('link', { name: PADANA.telefono })).toHaveAttribute('href', PADANA.telHref);
    await expect(contacto.getByRole('link', { name: PADANA.email })).toHaveAttribute('href', `mailto:${PADANA.email}`);
  });

  test('Contactar abre el hilo que ya existe con esa organización', async ({ page }) => {
    await abrirFicha(page, PADANA.name);
    const contactar = page.getByRole('button', { name: 'Contactar' });
    await expect(contactar).toBeEnabled();
    await contactar.click();
    await expect(page.getByTestId('thread-body')).toBeVisible();
    // Y se ha cambiado de ítem de nav: MSG-02 vive en `Hilos`, y su breadcrumb
    // (`ThreadHeader`) tiene un botón `Hilos` que la ficha no tiene.
    await expect(page.getByRole('navigation', { name: 'Ruta' }).getByRole('button', { name: 'Hilos' })).toBeVisible();
  });

  test('el breadcrumb «Empresas» vuelve al directorio', async ({ page }) => {
    await abrirFicha(page, PADANA.name);
    await page.getByRole('navigation', { name: 'Ruta' }).getByRole('button', { name: 'Empresas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('en la ficha de la propia organización Contactar está deshabilitado', async ({ page }) => {
    await abrirFicha(page, ALPHA.org);
    const contactar = page.getByRole('button', { name: 'Contactar' });
    await expect(contactar).toBeDisabled();
    await expect(contactar).toHaveAttribute('title', 'Es tu propia organización.');
  });
});
