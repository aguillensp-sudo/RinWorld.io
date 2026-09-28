import './env';
import { expect, test, type Page } from '@playwright/test';
import { NO_SESSION } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · REG-00-WAIT · Espera de aprobación, contra el build real
 * y sin sesión.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 * **No escribe nada**: la solicitud en espera se pone en `sessionStorage` antes de
 * cargar (es lo que dejaría REG-00 al enviar) y la respuesta de la función
 * `access-request` se sustituye en el navegador. Una fila de verdad en la cola del
 * Operador para una prueba es lo que F-188 prohíbe; lo que la función devuelve de
 * verdad se midió con `curl` en la base de e2e.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe:**
 *   · que el wiring abra la espera, y no el login, cuando la pestaña tiene una
 *     solicitud en espera — también tras recargar;
 *   · que el estado llegue por la red a la pantalla;
 *   · que `Cerrar y esperar el email` la olvide: al recargar sale el login.
 */

const REQUEST = {
  id: 'fff5a901-bab2-4040-9d71-86da3fb02ff8',
  submittedAt: '2026-09-28T11:23:00Z',
  form: {
    email: 'carlos.ruiz@distribucionesruiz.com',
    fullName: 'Carlos Ruiz',
    orgName: 'Distribuciones Ruiz SL',
    country: 'ES',
    phone: '+34 963 456 789',
    website: 'https://www.distribucionesruiz.com',
  },
};

async function conSolicitudEnEspera(page: Page, estado: Record<string, unknown>) {
  await page.addInitScript((value) => {
    // Solo la primera carga de la pestaña: tras `Cerrar…` no se vuelve a poner.
    if (!sessionStorage.getItem('bw.e2e.sembrado')) {
      sessionStorage.setItem('bw.accessRequest', value);
      sessionStorage.setItem('bw.e2e.sembrado', '1');
    }
  }, JSON.stringify(REQUEST));
  await page.route(/\/functions\/v1\/access-request/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estado) }),
  );
}

test.describe('REG-00-WAIT · espera sin sesión', () => {
  test.use({ storageState: NO_SESSION });

  test('con una solicitud en espera, abre la espera con los datos enviados', async ({ page }) => {
    await conSolicitudEnEspera(page, { state: 'PENDING_REVIEW', rejection_reason: null });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu solicitud está en revisión' })).toBeVisible();
    await expect(page.getByTestId('status-badge')).toHaveText('EN REVISIÓN');
    const datos = page.getByRole('region', { name: 'Datos enviados' });
    await expect(datos.getByText('Distribuciones Ruiz SL')).toBeVisible();
    await expect(datos.getByText('España')).toBeVisible();
  });

  test('sobrevive a una recarga', async ({ page }) => {
    await conSolicitudEnEspera(page, { state: 'PENDING_REVIEW', rejection_reason: null });
    await page.goto('/');
    await expect(page.getByTestId('status-badge')).toHaveText('EN REVISIÓN');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tu solicitud está en revisión' })).toBeVisible();
  });

  test('rechazada: el motivo del Operador llega a la pantalla', async ({ page }) => {
    await conSolicitudEnEspera(page, {
      state: 'REJECTED',
      rejection_reason: 'La organización no cumple los requisitos de membresía actuales.',
    });
    await page.goto('/');
    await expect(page.getByTestId('status-badge')).toHaveText('NO APROBADO');
    await expect(page.getByTestId('status-notice')).toContainText(
      'La organización no cumple los requisitos de membresía actuales.',
    );
  });

  test('Cerrar y esperar el email la olvida: vuelve el login, también tras recargar', async ({ page }) => {
    await conSolicitudEnEspera(page, { state: 'PENDING_REVIEW', rejection_reason: null });
    await page.goto('/');
    await page.getByRole('button', { name: 'Cerrar y esperar el email' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });
});
