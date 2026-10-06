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

  /**
   * Un .xlsx real, hecho con el `zipfile` de Python (deflate): el lector usa `DecompressionStream`
   * y `DOMParser` del NAVEGADOR, que jsdom no tiene del todo; esto es lo que lo prueba de verdad.
   */
  test('un .xlsx se lee en el navegador y abre INV-02 con sus columnas', async ({ page }) => {
    await page.getByTestId('inventory-file-input').setInputFiles({
      name: 'inventario.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('UEsDBBQAAAAIAI9oRl3muHRrXgAAAGIAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbBXMyw2DMAwA0FVQ7sSBQw8VnyVYIIpcQMR2FFsobI/6BnjT2ih3N1Y9hWc3+ODWZdqegto1yqyzO8zKF0DTgRTVS0FulH9SKZp6qTuUmK64I4whfCAJG7L19j8cLC9QSwMEFAAAAAgAj2hGXRwwtSOzAAAADgEAAA8AAAB4bC93b3JrYm9vay54bWyNj81qwzAQhF9F7D2W3UMpxnIupeB7+wCKtY5FtLtmV039+IX83HMa+GC+YYbjTsVdUS0LB+iaFhzyLCnzOcDP99fhA47j8Cd6OYlc3E6FLcBa69Z7b/OKFK2RDXmnsohSrNaInr1tijHZilip+Le2ffcUM8Pd0OsrDlmWPOOnzL+EXO8SxRJrFrY1bwbjcFuwRzqOhAEmviLXqFnA3fiUAnTgtM8pgE6pAz8O/ln1z3fjP1BLAwQUAAAACACPaEZd9o1lO4cAAAC6AAAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzVc49DoMwDEDhq0Q+QBw6dKgIzKwVF4jAJYj8yY5oevtKncr0tk+vH1sM6iSWPScLnTYwDv2Tgqt7TuL3IqrFkMSCr7U8EGXxFJ3oXCi1GF6Zo6uiM29Y3HK4jfBmzB3534CrqabVAk9rB2r+FLLQQM2ON6oW3pkP8URV8JdOtxgAhx4vV8MXUEsDBBQAAAAIAI9oRl1JhI8dtAAAAB0BAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWxdzN0KgjAYxvFbGTvPmZBEzHkQdBJBVF7A0FcduM32voY31VV0YxH2hYf/HzyPzEfbsRsENN5lfBnFnIErfWVck/Hislusea4kIrHRdg4z3hL1GyGwbMFqjHwPbrRd7YPVhJEPjcA+gK6wBSDbiSSOU2G1cZyVfnCU8ZSzwZnrANtPK4lGSVInqKUgJcUrJzroUOo5FhXO6agf9xmGl6dJvJo4vGWRnM5f+Xs473e/vUAk9QRQSwMEFAAAAAgAj2hGXRzKF5b/AAAAGQIAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxlkU1uhDAMRq+CvOiuGMK06o/xqC30AtMeIGLCgEoSlETA8SuYCjF05/jF+Z5iOk66iwblfGtNDmmcQKRMZc+tueTw/fV5/wRHptG6H98oFaJJd8bn0ITQvyD6qlFa+tj2yky6q63TMvjYugv63il5XoZ0hyJJHlHL1gDT0itkkEzOjpHLIQWmai7eUohCDh6YBk4IByas/tj7lqW37GPLxC0rtixbGTo7rgJiFRCby4edwJY97ATmFwbOnnfZ15HWdK1Rp+CAqfVMgcsTYWDC+fTPJltt5mpgIUSyz7uSQ7zrF9nVcYmqGQq4k7p/hRII63miKHc/gJt14Lpn/gVQSwECFAAUAAAACACPaEZd5rh0a14AAABiAAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIAI9oRl0cMLUjswAAAA4BAAAPAAAAAAAAAAAAAACAAY8AAAB4bC93b3JrYm9vay54bWxQSwECFAAUAAAACACPaEZd9o1lO4cAAAC6AAAAGgAAAAAAAAAAAAAAgAFvAQAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAAUAAAACACPaEZdSYSPHbQAAAAdAQAAFAAAAAAAAAAAAAAAgAEuAgAAeGwvc2hhcmVkU3RyaW5ncy54bWxQSwECFAAUAAAACACPaEZdHMoXlv8AAAAZAgAAGAAAAAAAAAAAAAAAgAEUAwAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsFBgAAAAAFAAUATgEAAEkEAAAAAA==', 'base64'),
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeVisible();
    await expect(page.getByTestId('import-file')).toContainText('inventario.xlsx');
    await expect(page.getByTestId('import-file')).toContainText('2 filas');
    await expect(page.getByTestId('mapping-row')).toHaveCount(4);
    await expect(page.getByRole('combobox', { name: 'Campo en plataforma para Ref' })).toHaveValue('part_number');
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
