import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `Forum.test.tsx` mockea `fetchCategories`/`fetchRecentThreads`, así que
 * pasaría entero con las cuatro categorías escritas a mano en el componente en
 * vez de leídas de `forum_category_stats` -exactamente el error contra el que
 * avisa la spec §7: "Las categorías son datos de configuración... El equipo de
 * producto puede añadir, renombrar o archivar categorías sin despliegue"-.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas FORO-01 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Las cuatro categorías de lanzamiento, migración `0029` -- no datos de demo. */
const CATEGORIAS = ['General', 'Referencias técnicas', 'Logística y aduanas', 'Plataforma y soporte'];

test.describe('FORO-01 · foro real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Foros' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Foro de la Comunidad' })).toBeVisible();
    // Se espera a una tarjeta, no solo al título: leerlas antes de que llegue
    // la consulta encuentra cero y falla por carrera, no por defecto (F-159).
    await expect(page.getByRole('button', { name: /General/ })).toBeVisible();
  });

  test('pinta las cuatro categorías de la base, cada una con hilos de verdad', async ({ page }) => {
    for (const nombre of CATEGORIAS) {
      const tarjeta = page.getByRole('button', { name: new RegExp(nombre) });
      await expect(tarjeta).toBeVisible();
      // demo_forum.sql siembra exactamente dos hilos por categoría.
      await expect(tarjeta.getByText('2 hilos')).toBeVisible();
    }
  });

  test('el aviso de confidencialidad está siempre visible, sin botón para cerrarlo', async ({ page }) => {
    await expect(
      page.getByText('Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.'),
    ).toBeVisible();
  });

  test('la actividad reciente pinta el hilo real más nuevo de la siembra, no la organización autora del mock', async ({
    page,
  }) => {
    // demo_forum.sql: el hilo de aranceles a Marruecos es el de post más
    // reciente de las ocho semillas (hace ~2h, re-anclado cada corrida), y su
    // autor real es Rodamientos Ibéricos (orgA) -- el HTML aprobado atribuye
    // ese mismo hilo a "Rodamientos del Sur SL", que no existe en la siembra.
    await expect(page.getByText('Actividad reciente')).toBeVisible();
    await expect(page.getByRole('button', { name: /aranceles a Marruecos/ })).toBeVisible();
    await expect(page.getByText('Rodamientos del Sur SL')).not.toBeVisible();
  });

  test('ni las categorías ni los hilos recientes navegan todavía -FORO-02 no existe-', async ({ page }) => {
    const tarjeta = page.getByRole('button', { name: /General/ });
    await expect(tarjeta).toBeDisabled();
    const urlAntes = page.url();
    await tarjeta.click({ force: true });
    expect(page.url()).toBe(urlAntes);
  });
});
