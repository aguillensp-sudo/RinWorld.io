import './env';
import { expect, test } from '@playwright/test';
import { haveOperatorCreds, OPERATOR, signIn } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `AdminRequests.test.tsx` mockea las cinco funciones de red, así que pasaría
 * entero aunque la RLS de `registration_requests` no filtrara nada, aunque no
 * existiera ninguna cuenta de Operador, o aunque el orden "más antigua primero"
 * dependiera de un `ORDER BY` que nadie escribió.
 *
 * ⚠ **NADA DE ESTE FICHERO MUTA EL ESTADO DE UNA SOLICITUD.** Aprobar, rechazar
 * o devolver a revisión de verdad dejaría la semilla de `demo_registration_
 * requests.sql` descuadrada -esa siembra se re-ancla solo si alguien la vuelve
 * a correr a mano, no hay ningún `teardown` que lo haga por cada corrida de
 * Playwright, al contrario que la siembra de mensajería (`fixture.setup.ts`)-.
 * El camino de escritura (Aprobar/Rechazar/Volver a revisión) ya está probado
 * con mocks en `AdminRequests.test.tsx`; lo que este fichero prueba es lectura:
 * datos reales, orden real, RLS real.
 */
if (process.env.CI && !haveOperatorCreds) {
  throw new Error(
    'En CI hacen falta E2E_OPERATOR_EMAIL/PASSWORD. Sin ellas ADMIN-01 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Los nombres de fantasía del HTML aprobado -- si aparecen, ADMIN-01 está
 *  pintando el mock en vez de la cola real. Los tres nombres de organización
 *  SÍ coinciden con la siembra a propósito (`demo_registration_requests.sql`);
 *  lo que NO coincide, y por eso se comprueba aquí, son los correos. */
const CORREOS_INVENTADOS = [
  'jalvarez@distribalvarez.com',
  'info@nordicbearings.se',
  'contact@roulementsfrance.fr',
];

async function nombresVisibles(page: import('@playwright/test').Page): Promise<string[]> {
  const filas = page.getByRole('row');
  const n = await filas.count();
  const out: string[] = [];
  for (let i = 1; i < n; i++) {
    out.push(((await filas.nth(i).getByRole('cell').first().textContent()) ?? '').trim());
  }
  return out;
}

test.describe('ADMIN-01 · cola de solicitudes real', () => {
  test.skip(!haveOperatorCreds, 'sin credenciales E2E_OPERATOR_*');

  test.beforeEach(async ({ page }) => {
    await signIn(page, OPERATOR);
    await expect(page.getByTestId('operator-home')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Cola de solicitudes de registro' })).toBeVisible();
    // Se espera a la tabla, no solo al título: leer filas antes de que llegue
    // la consulta encuentra cero y falla por carrera, no por defecto (F-159).
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('pinta las tres solicitudes reales, ordenadas de más antigua a más reciente', async ({ page }) => {
    expect(await nombresVisibles(page)).toEqual([
      'Distribuciones Álvarez SL',
      'Nordic Bearings AB',
      'Roulements France SAS',
    ]);
  });

  test('los correos son los de la siembra real (dominio .test), no los inventados del mock', async ({ page }) => {
    const cuerpo = await page.getByRole('table').textContent();
    for (const falso of CORREOS_INVENTADOS) expect(cuerpo).not.toContain(falso);
    expect(cuerpo).toContain('jalvarez@distribalvarez.test');
  });

  test('pulsar una fila abre el panel con los datos del FSR', async ({ page }) => {
    await page.getByRole('button', { name: 'Nordic Bearings AB' }).click();
    const panel = page.getByText('Detalle de solicitud').locator('..');
    await expect(panel.getByText('Nordic Bearings AB')).toBeVisible();
    await expect(page.getByText('Sven Lindqvist')).toBeVisible();
    await expect(page.getByText('info@nordicbearings.test')).toBeVisible();
  });

  test('el filtro "Aprobadas" no enseña las tres pendientes de la siembra', async ({ page }) => {
    await page.getByRole('button', { name: 'Aprobadas' }).click();
    await expect(page.getByText('No hay solicitudes pendientes de revisión.')).toBeVisible();
    await expect(page.getByText('Distribuciones Álvarez SL')).not.toBeVisible();
  });
});
