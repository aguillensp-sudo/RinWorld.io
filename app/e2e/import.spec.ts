import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * INV-02 · de la subida manual de INV-01 al mapeo, contra el build y la base de verdad.
 *
 * **No escribe nada, a propósito**: sube un CSV, comprueba el mapeo que se propone y
 * CANCELA. Importar cambia el inventario de la organización de demo (y un `Reemplazo
 * total` lo retiraría entero), y la suite e2e comparte esa base con la demo y con las
 * demás pruebas. Lo que escribe está medido en el banco de esquema (0044) y en el
 * cableado de `App.tsx` con la base mockeada (`AppImportMapping.test.tsx`).
 */

const CSV = ['Ref.;Fabricante;Uds.;País;PVP;Obs.', '6205-2RS/C3;SKF;850;ES;4.20;Stock almacén', 'NU216;FAG;5;DE;9.10;'].join('\n');

test.describe('INV-02 · mapeo de columnas', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Inventario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeVisible();
  });

  test('un CSV subido en INV-01 abre INV-02 con la propuesta, y cancelar vuelve sin escribir', async ({ page }) => {
    await page.getByTestId('inventory-file-input').setInputFiles({
      name: 'inventario_e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV, 'utf-8'),
    });

    await expect(page.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeVisible();
    await expect(page.getByTestId('import-file')).toContainText('inventario_e2e.csv');
    await expect(page.getByTestId('import-file')).toContainText('2 filas');
    await expect(page.getByTestId('mapping-row')).toHaveCount(6);
    await expect(page.getByRole('combobox', { name: 'Campo en plataforma para Ref.' })).toHaveValue('part_number');
    await expect(page.getByRole('combobox', { name: 'Campo en plataforma para País' })).toHaveValue('location_country');
    await expect(page.getByRole('combobox', { name: 'Campo en plataforma para PVP' })).toHaveValue('ignore');
    await expect(page.getByRole('button', { name: 'Confirmar e importar' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /Reemplazo total/ })).toBeChecked();

    await page.getByRole('button', { name: 'Cancelar y volver al inventario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeVisible();
  });

  test('el ítem de nav sigue siendo Inventario mientras se mapea', async ({ page }) => {
    await page.getByTestId('inventory-file-input').setInputFiles({
      name: 'inv.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV, 'utf-8'),
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeVisible();
    await expect(topNav(page).getByRole('button', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page');
  });
});
