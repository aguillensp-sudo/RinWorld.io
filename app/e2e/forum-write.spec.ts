import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-02/03 · crear hilo, editar y eliminar · contra el Supabase real.
 *
 * Escrito por Claude Code. El Coder no lo ve. Cubre lo que los mocks de `ForumNewThread.test.tsx` y
 * `ForumThread.test.tsx` no pueden: que la base crea el hilo y su publicación inicial a nombre de la
 * organización (`forum_create_thread`, 0078), que el UPDATE solo toca el cuerpo, y que el DELETE respeta
 * la regla de la publicación inicial.
 *
 * **Se limpia solo, en la misma corrida, y por eso se puede escribir aquí** (a diferencia de «Publicar
 * respuesta», que antes de 0078 se quedaba para siempre): el test crea un hilo con título único, lo edita,
 * le añade una respuesta, y lo elimina entero por la interfaz. Eliminar también devuelve el cupo de
 * RNG-FORO-06 (el límite cuenta las publicaciones que existen en la hora natural). Va en «Plataforma y
 * soporte», no en las categorías que otros e2e leen contando hilos.
 *
 * ⚠ Si el test cae a la mitad, el hilo se queda: el siguiente `forum.spec.ts` verá «3 hilos» en esa
 * categoría. Se limpia a mano; el título lleva el prefijo `E2E hilo`.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas crear, editar y eliminar en el foro no se prueban contra la base y el verde no significa nada.',
  );
}

test.describe('FORO · crear, editar y eliminar contra la base real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test('crear un hilo, editarlo, responder y eliminarlo, con la regla de la publicación inicial', async ({ page }) => {
    const titulo = `E2E hilo ${Date.now()}`;
    const cuerpo = 'Cuerpo inicial del hilo de prueba de extremo a extremo.';
    const cuerpoEditado = 'Cuerpo editado por el test de extremo a extremo.';

    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Foros' }).click();
    await page.getByRole('button', { name: /Plataforma y soporte/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Plataforma y soporte' })).toBeVisible();

    // ── Crear (thread-and-reply-creation#1) ────────────────────────────────
    await page.getByRole('button', { name: 'Crear hilo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo hilo en Plataforma y soporte' })).toBeVisible();
    const publicar = page.getByRole('button', { name: 'Publicar hilo' });
    await expect(publicar).toBeDisabled();
    await page.getByLabel('Título del hilo').fill(titulo);
    await page.getByLabel('Cuerpo del hilo').fill(cuerpo);
    await expect(publicar).toBeEnabled();
    await publicar.click();

    // Abre el hilo recién creado, con su inicial a nombre de la ORGANIZACIÓN.
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    const filas = page.locator('[data-testid^="forum-post-"]');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText('Rodamientos Ibéricos');
    await expect(filas.first()).toContainText(cuerpo);
    await expect(page.getByText('Todavía no hay respuestas. Sé el primero en responder.')).toBeVisible();

    // ── Editar la inicial (own-content-editing#1) ──────────────────────────
    await filas.first().getByRole('button', { name: 'Editar' }).click();
    await filas.first().getByRole('textbox', { name: 'Editar publicación' }).fill(cuerpoEditado);
    await filas.first().getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(filas.first()).toContainText(cuerpoEditado);
    await expect(filas.first()).not.toContainText(cuerpo);

    // ── Con una respuesta, la inicial no se puede eliminar ─────────────────
    await page.getByPlaceholder('Escribe tu respuesta...').fill('Respuesta de prueba del e2e.');
    await page.getByRole('button', { name: 'Publicar respuesta' }).click();
    await expect(filas).toHaveCount(2);
    await expect(filas.first().getByRole('button', { name: 'Eliminar' })).toBeDisabled();

    // ── Eliminar la respuesta: pregunta, y es irreversible (own-content-editing#2) ──
    await filas.nth(1).getByRole('button', { name: 'Eliminar' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('¿Eliminar esta publicación? Esta acción es irreversible.');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(filas).toHaveCount(2); // cancelar no borra
    await filas.nth(1).getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(filas).toHaveCount(1);

    // ── Sin respuestas, la inicial se elimina y se lleva el hilo ───────────
    await expect(filas.first().getByRole('button', { name: 'Eliminar' })).toBeEnabled();
    await filas.first().getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();

    // Vuelve a la categoría y el hilo ya no está.
    await expect(page.getByRole('heading', { level: 1, name: 'Plataforma y soporte' })).toBeVisible();
    await expect(page.getByRole('button', { name: titulo })).toHaveCount(0);
  });
});
