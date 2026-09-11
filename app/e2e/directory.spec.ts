import './env';
import { expect, test } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · DIR-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `Directory.test.tsx` mockea `fetchOrganizations`/`fetchDirectoryCountries`, así
 * que pasaría entero con:
 *
 *   · una pantalla que nunca llega a montarse de verdad -sin el ítem "Empresas"
 *     wireado en `App.tsx`, DIR-01 no tiene ninguna ruta real que visitar-;
 *   · un desplegable de país con los ~250 códigos ISO en vez de los que de
 *     verdad tiene el directorio (`directory.ts`, punto de por qué);
 *   · un filtro de país o de nombre que no filtre de verdad en el servidor: un
 *     `.eq`/`.ilike` que se cae devuelve TODAS las filas, y parece correcto.
 *
 * Igual que en el resto de e2e (F-015): si faltan credenciales en CI, esto es un
 * error duro. Un test que se salta la puerta y dice "passed" es peor que no
 * tenerlo.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas DIR-01 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Las cinco organizaciones de ejemplo del HTML aprobado. Inventadas para el
 *  mock, no las seis de `demo_orgs.sql`: si aparecen en pantalla, DIR-01 está
 *  pintando el HTML aprobado en vez del directorio real. */
const INVENTADAS = ['Acme Bearings Ltd', 'Distribuciones Ruiz SL', 'Rodamientos del Sur SL'];

/** Las seis de `supabase/seed/demo_orgs.sql`, todas `APPROVED`. */
const SEMBRADAS = [
  'Rodamientos Ibéricos',
  'Nordwälz Lager',
  'Cuscinetti Padana',
  'Łożyska Wschód',
  'Roulements Rhône',
  'Anadolu Rulman',
];

/** El nombre (columna 1) de cada fila visible, cabecera excluida. */
async function nombres(page: import('@playwright/test').Page): Promise<string[]> {
  const filas = page.getByRole('row');
  const n = await filas.count();
  const out: string[] = [];
  for (let i = 1; i < n; i++) {
    out.push(((await filas.nth(i).getByRole('cell').first().textContent()) ?? '').trim());
  }
  return out;
}

test.describe('DIR-01 · directorio real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Empresas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
    // Se espera a la tabla, no solo al título: leer filas antes de que llegue la
    // consulta encuentra cero y falla por carrera, no por defecto (F-159).
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('pinta las organizaciones de la base, no las cinco de ejemplo del mock', async ({ page }) => {
    const vistas = await nombres(page);
    for (const falsa of INVENTADAS) expect(vistas).not.toContain(falsa);
    for (const real of SEMBRADAS) expect(vistas).toContain(real);
    expect(vistas).toHaveLength(SEMBRADAS.length);
    // Al contrario que SRCH-01 -que excluye el inventario propio-, DIR-01 es un
    // directorio público: la organización de quien mira también sale.
    expect(vistas).toContain(ALPHA.org);
  });

  test('el filtro de país es de verdad server-side: Italia deja solo a Cuscinetti Padana', async ({ page }) => {
    await page.getByRole('combobox', { name: 'País' }).selectOption('IT');
    await expect(page.getByRole('button', { name: 'Limpiar filtros' })).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2); // cabecera + una fila
    expect(await nombres(page)).toEqual(['Cuscinetti Padana']);
  });

  test('la búsqueda por nombre espera a Enter -no es live search- y encuentra coincidencia parcial', async ({
    page,
  }) => {
    const buscador = page.getByPlaceholder('Buscar organización...');
    await buscador.fill('wälz');
    // Sin pulsar Enter ni la lupa, la tabla no ha cambiado todavía.
    await expect(page.getByRole('row')).toHaveCount(SEMBRADAS.length + 1);

    await buscador.press('Enter');
    await expect(page.getByRole('row')).toHaveCount(2);
    expect(await nombres(page)).toEqual(['Nordwälz Lager']);

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByRole('row')).toHaveCount(SEMBRADAS.length + 1);
  });

  test('pulsar "Nombre" invierte el orden -deja de ser el alfabético por defecto-', async ({ page }) => {
    const antes = await nombres(page);
    await page.getByRole('columnheader', { name: 'Nombre' }).getByRole('button').click();
    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'descending');
    const despues = await nombres(page);
    expect(despues).not.toEqual(antes);
    expect(despues.slice().sort()).toEqual(antes.slice().sort()); // mismas seis, otro orden
  });

  test('el nombre no lleva a ninguna parte todavía -DIR-02 no existe- y lo dice', async ({ page }) => {
    const primera = page.getByRole('row').nth(1).getByRole('button').first();
    await expect(primera).toBeDisabled();
    await expect(primera).toHaveAttribute('title', 'La ficha de organización (DIR-02) llega en una próxima versión.');
    const urlAntes = page.url();
    await primera.click({ force: true });
    expect(page.url()).toBe(urlAntes);
  });
});
