import './env';
import { expect, test } from '@playwright/test';
import { NO_SESSION } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-00 · FSR, contra el build real y sin sesión (el de
 * REG-00-WAIT vive en `access-request-wait.spec.ts`, F-219).
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **NO ENVÍA**: enviar escribiría una fila en la cola del Operador (F-188). Lo que
 * escribe lo midió la Edge Function con `curl` en la base de e2e (envío, duplicado,
 * inválido, estado; la fila de prueba se borró).
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que quien no tiene sesión llegue al FSR desde el login y desde la URL;
 *   · que la página entera se pinte fuera del shell, sin menú y con el logo;
 *   · que el enlace de invitación devuelva al login.
 */

test.describe('REG-00 · FSR sin sesión', () => {
  test.use({ storageState: NO_SESSION });

  test('desde el login, Solicitud de Registro abre el FSR', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Solicitud de Registro' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Solicita acceso a Bearingworld.io' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bearingworld.io' })).toBeVisible();
    // Fuera del shell: ni navegación de miembro ni botón de cerrar sesión.
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('con #solicitud-de-registro en la URL se entra directo', async ({ page }) => {
    await page.goto('/#solicitud-de-registro');
    await expect(page.getByRole('heading', { level: 1, name: 'Solicita acceso a Bearingworld.io' })).toBeVisible();
  });

  test('rellenado entero, Enviar solicitud se habilita (y no se pulsa)', async ({ page }) => {
    await page.goto('/#solicitud-de-registro');
    const enviar = page.getByRole('button', { name: 'Enviar solicitud' });
    await expect(enviar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Email del solicitante' }).fill('john@bearings.com');
    await page.getByRole('textbox', { name: 'Nombre y apellidos' }).fill('John Reece');
    await page.getByRole('textbox', { name: 'Nombre de la organización' }).fill('Bearings');
    await page.getByRole('combobox', { name: 'País de la organización' }).selectOption('US');
    await page.getByRole('textbox', { name: 'Teléfono de contacto' }).fill('+1 555 010 0100');
    await page.getByRole('textbox', { name: 'Sitio web' }).fill('https://www.bearings.com');
    await expect(enviar).toBeEnabled();
  });

  test('el enlace de invitación vuelve al login', async ({ page }) => {
    await page.goto('/#solicitud-de-registro');
    await page.getByRole('button', { name: '¿Tienes un enlace de invitación? Accede directamente →' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });
});
