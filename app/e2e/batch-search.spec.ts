import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-02 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar.** `BatchSearch.test.tsx`
 * mockea `fetchBatchResults`, así que pasaría entero aunque cada referencia se
 * buscase mal contra el inventario ajeno (los tres filtros silenciosos de
 * `fetchResults`: sin el `.neq` propio, sin `PUBLISHED`, sin el embed nombrado),
 * aunque la RLS dejase ver stock de quien nos ha excluido, o aunque la tabla
 * expandida no se llenase.
 *
 * ⚠ **SOLO LEE.** La búsqueda por lotes no escribe nada; el único estado que toca
 * es local. Depende del catálogo sembrado (`catalog_demo.sql`): `6205-2RS` existe
 * en varios distribuidores; `ZZ-NO-EXISTE-9999` no existe en ninguno.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_*/E2E_BETA_*. Sin ellas SRCH-02 no se prueba contra la base y el verde no significa nada.',
  );
}

const CON_STOCK = '6205-2RS';
const SIN_STOCK = 'ZZ-NO-EXISTE-9999';

async function abrir(page: Page) {
  await topNav(page).getByRole('button', { name: 'Comprando' }).click();
  await page.getByRole('button', { name: 'Búsqueda por lotes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Búsqueda por lotes' })).toBeVisible();
}

async function buscar(page: Page, texto: string) {
  await page.getByLabel('Lista de referencias').fill(texto);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('list', { name: 'Resultados por referencia' })).toBeVisible();
}

test.describe('SRCH-02 · búsqueda por lotes real (ALPHA)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*/E2E_BETA_*');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await abrir(page);
  });

  test('el contador cuenta las referencias de la lista pegada, con cualquier separador', async ({ page }) => {
    await page.getByLabel('Lista de referencias').fill(`${CON_STOCK}, 6308-ZZ\t22316-E\n${CON_STOCK}`);
    await expect(page.getByTestId('reference-counter')).toHaveText('3 / 50 referencias');
  });

  test('busca de verdad: la de stock trae filas y la inexistente sale «Sin resultados»', async ({ page }) => {
    await buscar(page, `${CON_STOCK}\n${SIN_STOCK}`);
    await expect(page.getByText('2 referencias · 1 con stock · 1 sin resultados')).toBeVisible();
    const tarjetas = page.getByRole('article');
    await expect(tarjetas).toHaveCount(2);
    await expect(tarjetas.nth(1)).toContainText('Sin resultados');
    await expect(tarjetas.nth(1).getByRole('button', { name: `Crear watcher — ${SIN_STOCK}` })).toBeDisabled();
  });

  test('la primera tarjeta viene expandida con su tabla, y todas las filas cumplen la referencia y no son de mi organización', async ({ page }) => {
    await buscar(page, `${CON_STOCK}\n${SIN_STOCK}`);
    const tabla = page.getByRole('table');
    await expect(tabla).toHaveCount(1);
    const filas = tabla.getByRole('row');
    await expect(filas.nth(1)).toBeVisible();
    const n = await filas.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 1; i < n; i++) {
      const celdas = filas.nth(i).getByRole('cell');
      await expect(celdas.nth(1)).toContainText(CON_STOCK);
      await expect(celdas.nth(5)).not.toHaveText(ALPHA.org);
      await expect(celdas.nth(5)).not.toHaveText('—');
    }
  });

  test('la tarjeta de la referencia inexistente se expande sin tabla y sin romper nada', async ({ page }) => {
    await buscar(page, `${CON_STOCK}\n${SIN_STOCK}`);
    await page.getByRole('button', { name: `Expandir ${SIN_STOCK}` }).click();
    await expect(page.getByRole('table')).toHaveCount(1);
  });

  test('Exportar resumen descarga un CSV con la cabecera y una fila por referencia', async ({ page }) => {
    await buscar(page, `${CON_STOCK}\n${SIN_STOCK}`);
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar resumen' }).click()]);
    expect(descarga.suggestedFilename()).toMatch(/^resumen-busqueda-por-lotes-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await descarga.createReadStream();
    let texto = '';
    for await (const trozo of stream) texto += trozo.toString();
    const lineas = texto.trim().split('\n');
    expect(lineas[0]).toBe('referencia,distribuidores,cantidad_maxima,pais');
    expect(lineas).toHaveLength(3);
    expect(lineas[2]).toBe(`${SIN_STOCK},0,,`);
  });

  test('volver a Comprando desde otro ítem lleva a la búsqueda de siempre, no a los lotes', async ({ page }) => {
    await topNav(page).getByRole('button', { name: 'Panel' }).click();
    await topNav(page).getByRole('button', { name: 'Comprando' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
  });
});
