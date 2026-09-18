import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-03 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `ForumThread.test.tsx` mockea `fetchThread`/`fetchThreadPosts`, así que
 * pasaría entero aunque el orden de las publicaciones o las reacciones
 * salieran de un cálculo en el cliente. Aquí todo sale de `forum_post_detail`
 * (0033) y de la siembra `supabase/seed/demo_forum.sql`, cuyo hilo
 * `44440000-0000-4000-8000-00000000c003` tiene, por orden de publicación:
 *
 *   1 (inicial) · Nordwälz Lager · DE · 👍 2 (memA + memB)
 *   2           · Rodamientos Ibéricos · ES · 👍 1 (solo memB -- ALPHA/memA
 *                 NO ha reaccionado a esta, y es la que usa el test de
 *                 reaccionar, precisamente por eso)
 *   3           · Nordwälz Lager · DE · 👍 0
 *
 * ⚠ **PUBLICAR UNA RESPUESTA NO SE PRUEBA AQUÍ, y es a propósito, mismo
 * criterio que `ADMIN-01` (F-169).** `forum_posts` no tiene ningún `DELETE` ni
 * `UPDATE` (`0029`) y `resetDemo` no toca el foro: una respuesta real
 * publicada por esta suite se quedaría para siempre, y además consumiría el
 * cupo de `RNG-FORO-06` de la organización de `ALPHA`, hasta dejar sin
 * publicaciones disponibles a una corrida futura dentro de la misma hora. El
 * camino de escritura de "Publicar respuesta" está cubierto con mocks en
 * `ForumThread.test.tsx`.
 *
 * **Reaccionar SÍ se prueba, porque es autolimpiable**: el test reacciona y
 * quita la reacción en la misma corrida, dejando el recuento exactamente como
 * lo encontró -- no hace falta ningún teardown.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas FORO-03 no se prueba contra la base y el verde no significa nada.',
  );
}

const TITULO_HILO = 'Equivalencia FAG 6205-2RS ↔ NSK: ¿alguien la ha montado?';
const P1 = 'forum-post-'; // prefijo; los ids reales los pone la base

test.describe('FORO-03 · vista de un hilo real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Foros' }).click();
    await page.getByRole('button', { name: /Referencias técnicas/ }).click();
    await page.getByRole('button', { name: TITULO_HILO }).click();
    // Se espera a una publicación, no solo al título: leer antes de que
    // llegue la consulta encuentra cero y falla por carrera, no por defecto
    // (F-159, mismo criterio que FORO-02).
    await expect(page.locator(`[data-testid^="${P1}"]`).first()).toBeVisible();
  });

  test('cabecera: h1 con el título completo y breadcrumb con las dos categorías', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: TITULO_HILO })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(nav.getByRole('button', { name: 'Foros' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Referencias técnicas' })).toBeVisible();
  });

  test('las publicaciones salen en orden cronológico, con organización, país y reacciones de la base', async ({ page }) => {
    const filas = page.locator(`[data-testid^="${P1}"]`);
    await expect(filas).toHaveCount(4);

    const inicial = filas.nth(0);
    await expect(inicial.getByText('Nordwälz Lager')).toBeVisible();
    await expect(inicial.getByText('DE', { exact: true })).toBeVisible();
    await expect(inicial.getByRole('button', { name: '👍 2' })).toBeVisible();

    const segunda = filas.nth(1);
    await expect(segunda.getByText('Rodamientos Ibéricos')).toBeVisible();
    await expect(segunda.getByRole('button', { name: '👍 1' })).toBeVisible();
  });

  test('"3 respuestas": las publicaciones MENOS la inicial, calculado en la base', async ({ page }) => {
    await expect(page.getByText('3 respuestas')).toBeVisible();
  });

  test('Editar/Eliminar solo aparecen, apagados, en las publicaciones de la propia organización', async ({ page }) => {
    const filas = page.locator(`[data-testid^="${P1}"]`);
    const propia = filas.nth(1); // Rodamientos Ibéricos == ALPHA
    await expect(propia.getByRole('button', { name: 'Editar' })).toBeDisabled();
    await expect(propia.getByRole('button', { name: 'Eliminar' })).toBeDisabled();

    const ajena = filas.nth(0); // Nordwälz Lager
    await expect(ajena.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  });

  test('reaccionar y quitar la reacción se refleja de inmediato y no deja residuo', async ({ page }) => {
    const segunda = page.locator(`[data-testid^="${P1}"]`).nth(1);
    const boton = segunda.getByRole('button', { name: /^👍/ });

    await expect(boton).toHaveText('👍 1');
    await expect(boton).toHaveAttribute('aria-pressed', 'false');

    await boton.click();
    await expect(boton).toHaveText('👍 2');
    await expect(boton).toHaveAttribute('aria-pressed', 'true');

    // Se quita en la misma corrida: el recuento vuelve a como estaba antes de
    // que este test lo tocara.
    await boton.click();
    await expect(boton).toHaveText('👍 1');
    await expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  test('el breadcrumb "Referencias técnicas" vuelve a FORO-02, con sus dos hilos', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button', { name: 'Referencias técnicas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Referencias técnicas' })).toBeVisible();
  });

  test('el breadcrumb "Foros" vuelve a FORO-01', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button', { name: 'Foros' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Foro de la Comunidad' })).toBeVisible();
  });
});
