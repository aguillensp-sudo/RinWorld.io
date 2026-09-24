import './env';
import { expect, test, type Page } from '@playwright/test';
import { haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · INV-07 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar.** `Visibility.test.tsx`
 * mockea las siete funciones de red, así que pasaría entero aunque la RLS de
 * `inventory_exclusions` no dejase escribir al ADMIN, aunque el `insert` mandase la
 * columna equivocada, o aunque una exclusión no llegase a persistir.
 *
 * ⚠ **EL MODO GUARDADO SE CAMBIA SOLO UN INSTANTE, Y SE REVIERTE EN UN `finally`.** La siembra deja
 * `Asia` y `Rusia` excluidas (`demo_exclusions.sql`): con el modo restringido solo dejarian de ver el
 * stock las organizaciones con sede ahi (`Anadolu Rulman`, sin cuenta).
 * `RESTRINGIDA` con la lista vacía sigue mostrando el stock a todos
 * (`app.can_view_inventory_of`: solo excluye a quien esté en la lista), así que no
 * descuadra los e2e de SRCH-01, DIR-01 y de los hilos. **Nunca se guarda `RESTRINGIDA`
 * con una exclusión puesta.** Las exclusiones se añaden y se quitan con el modo
 * guardado en el abierto, donde son inocuas.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_*/E2E_BETA_*. Sin ellas INV-07 no se prueba contra la base y el verde no significa nada.',
  );
}

const CANDIDATA = 'Cuscinetti Padana';

async function abrirVisibilidad(page: Page) {
  await topNav(page).getByRole('button', { name: 'Inventario' }).click();
  await page.getByRole('button', { name: 'Visibilidad' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Visibilidad del inventario' })).toBeVisible();
  // A los radios, no solo al título: leer antes de que llegue la consulta lee el defecto.
  await expect(page.getByRole('radiogroup', { name: 'Modo de visibilidad' })).toBeVisible();
}

async function quitarSiExiste(page: Page) {
  // Las exclusiones llegan de la base tras montar: contar antes de que lleguen daria 0 y dejaria la
  // exclusion puesta (F-183).
  await page.waitForLoadState('networkidle');
  const quitar = page.getByRole('button', { name: `Quitar ${CANDIDATA}` });
  if (await quitar.count()) {
    await page.getByRole('radio', { name: /Visibilidad restringida/ }).check();
    await quitar.click();
    await expect(page.getByText(CANDIDATA)).toHaveCount(0);
  }
}

test.describe('INV-07 · visibilidad real (ALPHA, administrador)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*/E2E_BETA_*');
  // EN SERIE: los dos tests tocan la misma lista de exclusiones.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await abrirVisibilidad(page);
  });

  test('carga el modo real: exactamente un radio marcado, y el bloque de efecto inmediato', async ({ page }) => {
    const marcados = await page.getByRole('radio', { checked: true }).count();
    expect(marcados).toBe(1);
    await expect(page.getByText(/Los cambios en la visibilidad tienen efecto inmediato/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled();
  });

  test('el selector de continentes ofrece los seis de la spec y el de país solo aparece tras elegir uno', async ({ page }) => {
    await page.getByRole('radio', { name: /Visibilidad restringida/ }).check();
    const sel = page.getByLabel('Excluir por continente');
    await expect(sel.locator('option')).toHaveText([
      'Selecciona un continente',
      'Europa',
      'Asia',
      'América del Norte',
      'América del Sur',
      'África',
      'Oceanía',
    ]);
    await expect(page.getByLabel('Refinar por país')).toHaveCount(0);
    await sel.selectOption('EU');
    // Solo países con alguna organización: el directorio tiene España y Alemania en Europa.
    const paises = page.getByLabel('Refinar por país').locator('option');
    await expect(paises.first()).toHaveText('Todos los países del continente');
    // Los países llegan de la base DESPUÉS de elegir el continente: se espera, no se cuenta ya (F-183).
    // Con la suite entera contra la base compartida la consulta tarda mas de los 5 s por defecto
    // (aislado, el artefacto pasa): plazo generoso y la red en reposo antes de contar.
    await page.waitForLoadState('networkidle');
    await expect.poll(() => paises.count(), { timeout: 20_000 }).toBeGreaterThan(1);
  });

  test('Guardar configuración persiste el modo tras recargar (y se revierte)', async ({ page }) => {
    // Regresion del PO (24-sep): «aunque guardes configuración, no se guardan los cambios».
    const modoGuardado = () => page.locator('[data-saved-mode]').getAttribute('data-saved-mode');
    try {
      await quitarSiExiste(page); // ojo: la siembra deja Asia y Rusia puestas (demo_exclusions.sql); solo afectan a Anadolu (TR, AS), sin cuenta
      await page.getByRole('radio', { name: /Visibilidad restringida/ }).check();
      await page.getByRole('button', { name: 'Guardar configuración' }).click();
      await expect(page.getByRole('status')).toHaveText('Configuración guardada. Los cambios tienen efecto inmediato.');
      await page.reload();
      await abrirVisibilidad(page);
      // Se espera al radio ANTES de leer el atributo: hasta que llega la consulta el modo es el del defecto.
      await expect(page.getByRole('radio', { name: /Visibilidad restringida/ })).toBeChecked();
      await expect.poll(modoGuardado).toBe('RESTRINGIDA');
    } finally {
      await page.getByRole('radio', { name: /Visible para todos/ }).check();
      await page.getByRole('button', { name: 'Guardar configuración' }).click();
      await expect(page.getByRole('status')).toBeVisible();
    }
    await page.reload();
    await abrirVisibilidad(page);
    await expect(page.getByRole('radio', { name: /Visible para todos/ })).toBeChecked();
    await expect.poll(modoGuardado).toBe('VISIBLE_TODOS');
  });

  test('añadir una exclusión de organización persiste tras recargar, y se quita (se deja como estaba)', async ({ page }) => {
    try {
      await quitarSiExiste(page); // por si un test anterior murió a medias
      await page.getByRole('radio', { name: /Visibilidad restringida/ }).check();
      await page.getByPlaceholder('Buscar organización por nombre...').fill('cuscinetti');
      await page.getByRole('button', { name: CANDIDATA }).click();
      await expect(page.getByRole('button', { name: `Quitar ${CANDIDATA}` })).toBeVisible();

      // Persistió: una pantalla nueva la lee de la base.
      await page.reload();
      await abrirVisibilidad(page);
      await expect(page.getByText(CANDIDATA)).toBeVisible();
    } finally {
      await quitarSiExiste(page);
    }
    await page.reload();
    await abrirVisibilidad(page);
    await expect(page.getByText(CANDIDATA)).toHaveCount(0);
  });
});
