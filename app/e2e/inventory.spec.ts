import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, BETA, haveCreds, NO_SESSION, signIn, topNav } from './fixtures';

/**
 * PUERTA DE SALIDA DEL DÍA 3.
 *
 * `ESTADO.md`: "INV-01 renderiza el inventario real de la base de datos, con sus
 * tests en verde, y las dos organizaciones tienen catálogo con solape deliberado."
 *
 * Estos tests hablan con el Supabase de verdad. Lo que prueban y los de unidad no
 * pueden probar es justo lo que más importa aquí: que las políticas de RLS y las
 * consultas encajan. `Inventory.test.tsx` mockea `fetchPage`, así que un filtro
 * mal puesto pasaría los 95 tests de unidad y saldría en la demo.
 *
 * Igual que en `session.spec.ts` (F-015): si faltan credenciales en CI, esto es un
 * error duro. Un test que se salta la puerta y dice "passed" es peor que no tenerlo.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas no se prueba la puerta del día 3 y el verde no significa nada.',
  );
}

/** Cuántas líneas tiene Alpha, leído de la propia pantalla. */
async function totalFromFooter(text: string | null): Promise<number> {
  const m = /^([\d.]+)\s/.exec((text ?? '').trim());
  return m ? Number(m[1]?.replace(/\./g, '')) : 0;
}

test.describe('INV-01 · inventario real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // INV-01 cuelga de "Vendiendo", no de "Inventario" (spec §2).
    await topNav(page).getByRole('button', { name: 'Vendiendo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeVisible();
    // Y se espera a la tabla, no solo al título: `allTextContents()` no
    // auto-espera, así que un test que lea columnas antes de que llegue la
    // consulta encuentra un array vacío y falla por carrera, no por defecto.
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByTestId('pag-info')).toBeVisible();
  });

  test('pinta líneas de la base, no datos de ejemplo del HTML aprobado', async ({ page }) => {
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    // Al menos una fila de verdad.
    const rows = table.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);

    // Los cinco literales del bloque "Datos de ejemplo" de la spec §3. Ninguno
    // sale de la base: si aparecen, la pantalla está pintando el mock.
    for (const ejemplo of ['6205-2RS/C3', 'NU2210-E-TVP2', '7210-BECBP', '6305-ZZ', '22316-E']) {
      await expect(page.getByText(ejemplo, { exact: true })).toHaveCount(0);
    }
    // Y tampoco el 1.247 ni el 892 de las tarjetas de ejemplo.
    await expect(page.getByTestId('stat-published')).not.toHaveText('1.247');
    await expect(page.getByTestId('stat-visits')).toHaveText('—');
  });

  test('las siete columnas de la spec, en orden', async ({ page }) => {
    const heads = await page.getByRole('columnheader').allTextContents();
    expect(heads).toEqual([
      'Referencia',
      'Marca',
      'Cantidad',
      'País',
      'Estado',
      'Antigüedad',
      'Acciones',
    ]);
  });

  /**
   * EL TEST QUE JUSTIFICA QUE ESTO SEA e2e Y NO UNIDAD.
   *
   * `inventory_lines` tiene DOS políticas de lectura permisivas que se suman: el
   * inventario propio en cualquier estado, y el PUBLISHED de las demás
   * organizaciones. Sin el `.eq('org_id', …)` explícito de `fetchPage`, "Mi
   * inventario" mostraría también las 196 líneas publicadas del catálogo del día 3
   * — sin error, sin aviso, y con toda la pinta de funcionar.
   */
  test('solo muestra inventario propio, aunque la RLS permita ver el ajeno', async ({ page }) => {
    const total = await totalFromFooter(await page.getByTestId('pag-info').textContent());
    // Alpha tiene del orden de 15 líneas; el catálogo entero pasa de 200.
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(100);

    // Y ninguna fila puede ser de una referencia que solo existe en otra
    // organización: 'Anadolu Rulman' siembra en TR, y Alpha no tiene stock en TR.
    await expect(page.getByText('TR', { exact: true })).toHaveCount(0);
  });

  test('el resumen cuadra con lo que la tabla dice de sí misma', async ({ page }) => {
    const published = Number(
      ((await page.getByTestId('stat-published').textContent()) ?? '0').replace(/\./g, ''),
    );
    const total = await totalFromFooter(await page.getByTestId('pag-info').textContent());
    // `Todos` incluye DRAFT y ARCHIVED además de PUBLISHED, así que publicadas
    // nunca puede superar el total del filtro Todos.
    expect(published).toBeLessThanOrEqual(total);
    expect(published).toBeGreaterThan(0);
  });

  test('el filtro Publicados reduce o iguala, y nunca vacía un inventario que tiene stock', async ({
    page,
  }) => {
    const todos = await totalFromFooter(await page.getByTestId('pag-info').textContent());
    await page.getByRole('button', { name: 'Publicados' }).click();
    await expect(page.getByRole('button', { name: 'Publicados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const publicados = await totalFromFooter(await page.getByTestId('pag-info').textContent());
    expect(publicados).toBeGreaterThan(0);
    expect(publicados).toBeLessThanOrEqual(todos);
    // Y todos los badges visibles dicen Published.
    const badges = await page.locator('tbody tr td:nth-child(5)').allTextContents();
    expect(new Set(badges)).toEqual(new Set(['Published']));
  });

  test('la búsqueda es server-side y NO se lanza al teclear', async ({ page }) => {
    const antes = await totalFromFooter(await page.getByTestId('pag-info').textContent());
    const box = page.getByRole('searchbox', { name: /buscar/i });

    await box.fill('6205');
    // Sin Enter no cambia nada: la spec §3 lo pide explícitamente por el volumen
    // potencial de hasta 500.000 líneas.
    await expect(page.getByTestId('pag-info')).toContainText(String(antes));

    await box.press('Enter');
    // Se espera a que la primera fila sea ya del resultado. Sin esta espera, la
    // lectura cae en el hueco de "Cargando inventario…" y el test falla por
    // carrera en vez de por defecto — es el mismo tropiezo que en `beforeEach`.
    const firstRef = page.locator('tbody tr td:nth-child(1)').first();
    await expect(firstRef).toContainText('6205');

    const refs = await page.locator('tbody tr td:nth-child(1)').allTextContents();
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(r).toContain('6205');
  });

  test('una búsqueda sin resultados dice que es el filtro, no que no hay inventario', async ({
    page,
  }) => {
    await page.getByRole('searchbox', { name: /buscar/i }).fill('REFERENCIA-QUE-NO-EXISTE-9999');
    await page.getByRole('searchbox', { name: /buscar/i }).press('Enter');
    await expect(page.getByTestId('inventory-empty')).toHaveText(
      'Ninguna línea coincide con el filtro.',
    );
  });

  /**
   * Una coma en el buscador no puede convertirse en otro filtro. `or=(…)` es un
   * mini-lenguaje de PostgREST y la coma es su separador: sin saneado esto
   * devolvería un 400 o, peor, otro resultado.
   */
  test('un término con caracteres del lenguaje de filtros no rompe la consulta', async ({
    page,
  }) => {
    await page.getByRole('searchbox', { name: /buscar/i }).fill('6205,brand.eq.SKF)');
    await page.getByRole('searchbox', { name: /buscar/i }).press('Enter');
    // Ni error rojo ni tabla en blanco por un 400.
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  /** INV-01 §5: "Subtítulo del panel: `Agente de inventario`". Ver F-025. */
  test('VERA lleva el subtítulo de esta pantalla, no el del shell base', async ({ page }) => {
    await expect(page.getByTestId('vera-subtitle')).toHaveText('Agente de inventario');
  });

  test('los canales de actualización dicen que están fuera del MVP', async ({ page }) => {
    await expect(page.getByTestId('channels-scope')).toContainText('fuera del alcance del MVP');
    await expect(page.getByText('Fuera del MVP')).toHaveCount(2);
    // El HTML aprobado promete un canal "Activo" y una dirección de ingestión.
    // Ninguna de las dos existe, y la pantalla no finge que sí.
    await expect(page.getByText('Activo', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('ingest-addr')).toHaveText('—');
  });
});

/**
 * La otra mitad de la puerta: el solape del catálogo. No es una comprobación de
 * INV-01 sino del dato, y por eso va con las dos cuentas.
 */
test.describe('catálogo del día 3 · las dos organizaciones tienen stock', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('Alpha y Beta ven inventario propio, y no es el mismo', async ({ browser }) => {
    const alphaCtx = await browser.newContext({ storageState: NO_SESSION });
    const betaCtx = await browser.newContext({ storageState: NO_SESSION });
    const alphaPage = await alphaCtx.newPage();
    const betaPage = await betaCtx.newPage();

    async function openInventory(page: Page): Promise<string[]> {
      await topNav(page).getByRole('button', { name: 'Vendiendo' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Mi inventario' })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      return page.locator('tbody tr td:nth-child(1)').allTextContents();
    }

    await Promise.all([signIn(alphaPage, ALPHA), signIn(betaPage, BETA)]);
    const refsA = await openInventory(alphaPage);
    const refsB = await openInventory(betaPage);

    expect(refsA.length).toBeGreaterThan(0);
    expect(refsB.length).toBeGreaterThan(0);
    // Solape deliberado del guion: 6205-2RS está en las dos.
    expect(refsA).toContain('6205-2RS');
    expect(refsB).toContain('6205-2RS');
    // Pero los catálogos no son idénticos: si lo fueran, la columna Empresa de
    // SRCH-01 no tendría nada que contar el día 6.
    expect(refsA.join('|')).not.toBe(refsB.join('|'));

    await alphaCtx.close();
    await betaCtx.close();
  });
});
