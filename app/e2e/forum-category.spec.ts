import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-02 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `ForumCategory.test.tsx` mockea `fetchCategory`/`fetchThreads`, así que
 * pasaría entero aunque la pantalla ordenara en el cliente, contara las
 * respuestas con lo que tiene en memoria o filtrara la búsqueda sobre la página
 * que ya vio. Aquí todo sale de `forum_thread_list` (0030) y de la siembra
 * `supabase/seed/demo_forum.sql`, cuyas cifras están escritas en su cabecera:
 *
 *   Referencias técnicas (2 hilos), por actividad reciente:
 *     c004 · Juego interno C3 frente a CN...   · Rodamientos Ibéricos · 2 respuestas · 👍 1
 *     c003 · Equivalencia FAG 6205-2RS ↔ NSK... · Nordwälz Lager       · 3 respuestas · 👍 3
 *
 * Solo LEE: ni crea hilos ni reacciona. Los tiempos relativos no se comprueban
 * porque la siembra del foro no se re-ancla en cada corrida.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas FORO-02 no se prueba contra la base y el verde no significa nada.',
  );
}

const C003 = 'forum-thread-44440000-0000-4000-8000-00000000c003';
const C004 = 'forum-thread-44440000-0000-4000-8000-00000000c004';

test.describe('FORO-02 · lista de hilos real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Foros' }).click();
    await page.getByRole('button', { name: /Referencias técnicas/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Referencias técnicas' })).toBeVisible();
    // Se espera a una fila, no solo al título: leer antes de que llegue la
    // consulta encuentra cero y falla por carrera, no por defecto (F-159).
    await expect(page.getByTestId(C003)).toBeVisible();
  });

  test('pinta SOLO los hilos de su categoría, por actividad reciente', async ({ page }) => {
    const filas = page.locator('[data-testid^="forum-thread-"]');
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toHaveAttribute('data-testid', C004);
    await expect(filas.nth(1)).toHaveAttribute('data-testid', C003);
    await expect(page.getByText(/aranceles a Marruecos/)).toHaveCount(0);
  });

  test('los contadores salen de la base: respuestas sin la inicial y reacciones de todo el hilo', async ({ page }) => {
    const c003 = page.getByTestId(C003);
    await expect(c003.getByText('Nordwälz Lager')).toBeVisible();
    await expect(c003.getByText('3 respuestas')).toBeVisible();
    await expect(c003.getByText('👍 3')).toBeVisible();

    const c004 = page.getByTestId(C004);
    await expect(c004.getByText('Rodamientos Ibéricos')).toBeVisible();
    await expect(c004.getByText('2 respuestas')).toBeVisible();
    await expect(c004.getByText('👍 1')).toBeVisible();
  });

  test('la búsqueda va al servidor al pulsar Enter, y "Limpiar búsqueda" devuelve la lista', async ({ page }) => {
    const buscador = page.getByPlaceholder('Buscar en esta categoría...');
    await buscador.fill('Equivalencia');
    // Sin Enter, la lista no ha cambiado.
    await expect(page.locator('[data-testid^="forum-thread-"]')).toHaveCount(2);
    await buscador.press('Enter');
    await expect(page.locator('[data-testid^="forum-thread-"]')).toHaveCount(1);
    await expect(page.getByTestId(C003)).toBeVisible();

    await buscador.fill('zzz-no-existe');
    await buscador.press('Enter');
    await expect(page.getByText('No hemos encontrado hilos que coincidan con "zzz-no-existe".')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(page.locator('[data-testid^="forum-thread-"]')).toHaveCount(2);
  });

  test('el breadcrumb "Foros" vuelve a FORO-01', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button', { name: 'Foros' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Foro de la Comunidad' })).toBeVisible();
  });
});
