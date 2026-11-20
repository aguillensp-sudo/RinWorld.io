import './env';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirComprando, ALPHA, ALPHA_STORAGE, BETA, buscarReferencia, haveCreds, signIn, verOfertasDeTodas } from './fixtures';

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
 * Desde el 26-oct-2026 llega a la tabla por la búsqueda en dos fases (`amend-srch01-busqueda-en-dos-fases`):
 * busca `6205-2RS`, la referencia con más distribuidoras de la siembra, y abre las ofertas de todas las claves.
 *
 * Igual que el resto de e2e (F-015): sin credenciales en CI esto es un error duro.
 */
if (process.env.CI && !haveCreds) {
  throw new Error('En CI hacen falta E2E_ALPHA_* y E2E_BETA_*. Sin ellas SRCH-01 no se prueba contra la base.');
}

/** `yaDentro`: la página ya tiene la sesión abierta (acaba de pasar por `signIn`); recargar la perdería. */
async function abrirBusqueda(page: Page, yaDentro = false) {
  await abrirComprando(page, yaDentro);
  await buscarReferencia(page, '6205-2RS');
  await verOfertasDeTodas(page);
}

/** Las filas de datos, sin la cabecera. */
/** Referencia y marca de una fila de resultados (columnas 2 y 3: tras la casilla). */
async function referenciaDe(fila: Locator): Promise<{ ref: string; marca: string }> {
  const ref = ((await fila.getByRole('cell').nth(1).textContent()) ?? '').trim();
  const marca = ((await fila.getByRole('cell').nth(2).textContent()) ?? '').trim();
  return { ref, marca };
}

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
    const fila = filas(page).first();
    const { ref, marca } = await referenciaDe(fila);
    await fila.getByRole('button', { name: 'Contactar' }).click();
    await expect(page.getByTestId('thread-body')).toBeVisible();
    // No se ha quedado en la ficha.
    await expect(page.getByText('Directorio de Organizaciones')).toHaveCount(0);
    // PO, 20-nov-2026 (0083): filtrado y etiquetado con la referencia de esa fila.
    await expect(page.getByText(`Referencia: ${ref} · ${marca}`)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Escribe un mensaje' })).toHaveAttribute(
      'placeholder',
      `Escribe sobre ${ref} · ${marca}: el mensaje irá etiquetado con esta referencia`,
    );
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

    const { ref, marca } = await referenciaDe(fila!);
    await fila!.getByRole('button', { name: 'Contactar' }).click();
    await expect(page.getByLabel('Primer mensaje')).toBeVisible();
    // PO, 20-nov-2026 (0083): el primer mensaje sale etiquetado con la referencia de esa fila.
    await expect(page.getByLabel('Primer mensaje')).toHaveAttribute(
      'placeholder',
      `Escribe sobre ${ref} · ${marca}: el mensaje irá etiquetado con esta referencia`,
    );
    // Sin enviar nada: no se escribe en la base.
  });
});
