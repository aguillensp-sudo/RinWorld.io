import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, BETA, haveCreds, signIn, topNav } from './fixtures';

/**
 * SRCH-01 · `Consultar` y `Contactar` de fila, de extremo a extremo (10-oct-2026).
 *
 * Los dos botones se "estropearon" más de una vez sin que nada fallara: los tests de unidad
 * mockean la capa de datos y no ven el flujo completo (marcar la fila → el botón se habilita;
 * pulsar Contactar → cae donde dice la spec). Esto lo ve.
 *
 * **Solo lee.** No pulsa `Consultar` ni envía el primer mensaje: ninguno de los tres casos deja
 * nada en la base, así que no hace falta reponer nada y puede correr en cualquier orden.
 *
 *   · Consultar: apagado hasta marcar la fila; con la fila marcada, habilitado.
 *   · Contactar con hilo previo (ALPHA tiene hilo con todas las organizaciones de demo):
 *     abre ese hilo (MSG-02), no la ficha.
 *   · Contactar sin hilo previo (BETA solo tiene hilo con ALPHA): abre la ficha de la empresa
 *     con el cuadro «Primer mensaje» ya desplegado.
 *
 * Igual que el resto de e2e (F-015): sin credenciales en CI esto es un error duro.
 */
if (process.env.CI && !haveCreds) {
  throw new Error('En CI hacen falta E2E_ALPHA_* y E2E_BETA_*. Sin ellas SRCH-01 no se prueba contra la base.');
}

/** `yaDentro`: la página ya tiene la sesión abierta (acaba de pasar por `signIn`); recargar la perdería. */
async function abrirBusqueda(page: Page, yaDentro = false) {
  if (!yaDentro) await page.goto('/');
  await topNav(page).getByRole('button', { name: 'Comprando' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
  // A la tabla, no solo al título: leer filas antes de que llegue la consulta falla por carrera.
  await expect(page.getByRole('row').nth(1)).toBeVisible();
}

/** Las filas de datos, sin la cabecera. */
const filas = (page: Page) => page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Contactar' }) });

test.describe('SRCH-01 · Consultar y Contactar (ALPHA, con hilo con las demás)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => abrirBusqueda(page));

  test('Consultar sigue apagado hasta marcar la fila, y entonces se habilita', async ({ page }) => {
    // Una fila que ALPHA no haya consultado ya: en esas `Consultar` queda apagado a propósito.
    const todas = filas(page);
    const n = await todas.count();
    let fila = null;
    for (let i = 0; i < n; i++) {
      const candidata = todas.nth(i);
      const titulo = (await candidata.getByRole('button', { name: 'Consultar' }).getAttribute('title')) ?? '';
      if (!/Ya consultada/i.test(titulo)) {
        fila = candidata;
        break;
      }
    }
    expect(fila, 'hace falta alguna fila sin consultar para probar el flujo').not.toBeNull();

    const consultar = fila!.getByRole('button', { name: 'Consultar' });
    await expect(consultar).toBeDisabled();

    await fila!.getByRole('checkbox').check();
    await expect(consultar).toBeEnabled();

    // Y al desmarcar vuelve a apagarse.
    await fila!.getByRole('checkbox').uncheck();
    await expect(consultar).toBeDisabled();
  });

  test('Contactar con hilo previo abre ese hilo, no la ficha de la empresa', async ({ page }) => {
    await filas(page).first().getByRole('button', { name: 'Contactar' }).click();
    await expect(page.getByTestId('thread-body')).toBeVisible();
    // No se ha quedado en la ficha.
    await expect(page.getByText('Directorio de Organizaciones')).toHaveCount(0);
  });
});

test.describe('SRCH-01 · Contactar sin hilo previo (BETA)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  // Sesión propia: BETA solo tiene hilo con ALPHA.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Contactar abre la ficha con el cuadro «Primer mensaje» ya desplegado', async ({ page }) => {
    await signIn(page, BETA);
    await abrirBusqueda(page, true);

    // La primera fila que no sea de ALPHA: con ninguna otra tiene hilo BETA.
    const todas = filas(page);
    const n = await todas.count();
    let fila = null;
    for (let i = 0; i < n; i++) {
      const candidata = todas.nth(i);
      const empresa = ((await candidata.getByRole('cell').nth(5).textContent()) ?? '').trim();
      if (empresa !== ALPHA.org) {
        fila = candidata;
        break;
      }
    }
    expect(fila, 'hace falta alguna fila de una empresa distinta de ALPHA').not.toBeNull();

    await fila!.getByRole('button', { name: 'Contactar' }).click();
    await expect(page.getByLabel('Primer mensaje')).toBeVisible();
    // Sin enviar nada: no se escribe en la base.
  });
});
