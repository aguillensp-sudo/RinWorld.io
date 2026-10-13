import './env';
import { expect, test } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * INV-04 · canal de ingestión por email, contra la base de verdad (proyecto aislado de e2e).
 *
 * `IngestChannel.test.tsx` mockea las seis funciones de red, así que no puede cazar lo que más
 * importa aquí: que `ensure_ingest_channel`/`rotate_ingest_address`/`add_ingest_sender` existen y
 * se dejan llamar a un ADMIN con sesión, y que las políticas de `select` de las tres tablas le
 * devuelven sus filas. Lo que NO prueba, y no puede probar sin una cuenta de AWS, es que un correo
 * real llegue: eso se comprobó a mano el 13-oct-2026 (`ingest_events`).
 *
 * Deja datos: el canal queda abierto para la organización de Alpha y rotado. Es idempotente y el
 * proyecto de e2e es solo de pruebas.
 */
if (process.env.CI && !haveCreds) {
  throw new Error('En CI hacen falta E2E_ALPHA_*. Sin ellas INV-04 no se prueba contra la base y el verde no significa nada.');
}

const DIRECCION = /^ingest-[a-km-np-z2-9]{12}@[a-z0-9.-]+$/;

test.describe('INV-04 · canal de ingestión', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Inventario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeVisible();
    await page.getByRole('button', { name: 'Gestionar canal email' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Canal de ingestión por email' })).toBeVisible();
    await expect(page.getByTestId('ingest-address')).toHaveValue(DIRECCION);
  });

  test('el ADMIN ve su dirección, a sí mismo como remitente protegido y un historial', async ({ page }) => {
    await expect(page.getByText('Administrador — no eliminable')).toBeVisible();
    await expect(page.getByText(ALPHA.email.toLowerCase(), { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Eliminar ${ALPHA.email.toLowerCase()}` })).toBeDisabled();
    // Una tabla de historial o su mensaje de vacío: nunca ninguna de las dos cosas ausente.
    await expect(page.getByRole('table').or(page.getByText('Todavía no se ha recibido ningún correo'))).toBeVisible();
  });

  test('reabrir la pantalla devuelve la MISMA dirección (ensure es idempotente)', async ({ page }) => {
    const antes = await page.getByTestId('ingest-address').inputValue();
    await topNav(page).getByRole('button', { name: 'Inventario' }).click();
    await page.getByRole('button', { name: 'Gestionar canal email' }).click();
    await expect(page.getByTestId('ingest-address')).toHaveValue(antes);
  });

  test('añadir y quitar un remitente pasa por la base', async ({ page }) => {
    const email = `prueba-${Date.now()}@e2e.test`;
    await page.getByRole('button', { name: '+ Añadir remitente' }).click();
    await page.getByLabel('Email del remitente').fill(email);
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Eliminar ${email}` }).click();
    await expect(page.getByText(email, { exact: true })).toHaveCount(0);
  });

  test('rotar cambia la dirección tras confirmar y cancelar no la toca', async ({ page }) => {
    const antes = await page.getByTestId('ingest-address').inputValue();

    await page.getByRole('button', { name: 'Rotar dirección' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('ingest-address')).toHaveValue(antes);

    await page.getByRole('button', { name: 'Rotar dirección' }).click();
    await page.getByRole('button', { name: 'Sí, rotar' }).click();
    await expect(page.getByRole('status')).toContainText('La anterior ya no es válida');
    const despues = await page.getByTestId('ingest-address').inputValue();
    expect(despues).toMatch(DIRECCION);
    expect(despues).not.toBe(antes);
  });
});
