import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, BETA, haveCreds, NO_SESSION, signIn, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-03 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar.** `Watchers.test.tsx`
 * mockea las seis funciones de red, así que pasaría entero aunque la vista
 * `watcher_list` no calculase bien el estado efectivo, aunque la RLS de `0035`
 * dejase ver los watchers de otra organización, o aunque `watcher_set_paused` no
 * moviese nada en la base.
 *
 * ⚠ **DEPENDE DE `supabase/seed/demo_watchers.sql`, y las fechas envejecen**: el
 * PENDIENTE RENOVACIÓN dura 3 días desde la siembra y el PAUSED 12. Por eso los
 * chips se prueban por PROPIEDAD, no contra referencias fijas, y un test aparte
 * (`la siembra está anclada`) falla en voz alta, con la instrucción de resembrar.
 * El PENDIENTE no se exige: es el que primero caduca.
 *
 * ⚠ **LO ÚNICO QUE ESCRIBE ES REVERSIBLE**: pausar y reactivar un watcher, con la
 * reactivación en un `finally`. `Eliminar`, `Editar` y `Mantener activo` dejan
 * huella (borran, o mueven `expires_at`) y solo se prueban con mocks.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_*/E2E_BETA_*. Sin ellas SRCH-03 no se prueba contra la base y el verde no significa nada.',
  );
}

const SIEMBRA_HINT =
  'Resiembra con supabase/seed/demo_watchers.sql (las fechas de la siembra son relativas a hoy y envejecen).';

interface Tarjeta {
  ref: string;
  estado: string;
}

async function tarjetas(page: Page): Promise<Tarjeta[]> {
  const cards = page.getByRole('article');
  const n = await cards.count();
  const out: Tarjeta[] = [];
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    out.push({
      ref: ((await card.getAttribute('aria-label')) ?? '').replace('Watcher ', ''),
      estado: (await card.getAttribute('data-state')) ?? '',
    });
  }
  return out;
}

async function abrirWatchers(page: Page) {
  await topNav(page).getByRole('button', { name: 'Comprando' }).click();
  await page.getByRole('button', { name: 'Mis watchers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis watchers' })).toBeVisible();
  // A una TARJETA, no solo al título: leer antes de que llegue la consulta
  // encuentra cero y falla por carrera (F-159).
  await expect(page.getByRole('article').first()).toBeVisible();
}

test.describe('SRCH-03 · watchers reales (ALPHA)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*/E2E_BETA_*');
  // EN SERIE: el test de Pausar cambia el unico ACTIVE de la siembra y, en paralelo,
  // el de anclaje y el del contador lo leerian pausado (F-183: defecto del contrato,
  // no del artefacto).
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await abrirWatchers(page);
  });

  test('la siembra está anclada: ACTIVE, PAUSED y TRIGGERED', async ({ page }) => {
    const estados = new Set((await tarjetas(page)).map((t) => t.estado));
    for (const e of ['ACTIVE', 'PAUSED', 'TRIGGERED']) {
      expect(estados.has(e), `falta el estado ${e}. ${SIEMBRA_HINT}`).toBe(true);
    }
  });

  test('el contador coincide con las tarjetas ACTIVE', async ({ page }) => {
    const activos = (await tarjetas(page)).filter((t) => t.estado === 'ACTIVE').length;
    await expect(page.getByTestId('watcher-counter')).toHaveText(`${activos} / 50 watchers activos`);
  });

  test('los chips filtran de verdad: cada tarjeta visible cumple la regla del chip', async ({ page }) => {
    const todas = await tarjetas(page);
    const reglas: [string, string][] = [
      ['Activos', 'ACTIVE'],
      ['Pausados', 'PAUSED'],
      ['Disparados', 'TRIGGERED'],
      ['Pendientes de renovación', 'PENDIENTE RENOVACIÓN'],
      ['Expirados', 'EXPIRED'],
    ];
    for (const [chip, estado] of reglas) {
      await page.getByRole('button', { name: new RegExp(`^${chip} \\d+$`) }).click();
      const esperadas = todas.filter((t) => t.estado === estado).map((t) => t.ref);
      const visibles = (await tarjetas(page)).map((t) => t.ref);
      expect(visibles, `chip «${chip}»`).toEqual(esperadas);
    }
    await page.getByRole('button', { name: /^Todos \d+$/ }).click();
    expect((await tarjetas(page)).map((t) => t.ref)).toEqual(todas.map((t) => t.ref));
  });

  test('los días restantes solo salen en ACTIVE y PAUSED, y el disparo lleva su texto', async ({ page }) => {
    for (const estado of ['TRIGGERED', 'EXPIRED']) {
      const card = page.locator(`article[data-state="${estado}"]`).first();
      if (await card.count()) await expect(card).not.toContainText('restantes');
    }
    const trig = page.locator('article[data-state="TRIGGERED"]').first();
    await expect(trig).toContainText('Stock detectado el');
    await expect(trig.getByRole('button', { name: 'Ver resultados' })).toBeVisible();
  });

  test('Pausar y Reactivar mueven el estado de verdad (y se deja como estaba)', async ({ page }) => {
    const activa = page.locator('article[data-state="ACTIVE"]').first();
    const ref = ((await activa.getAttribute('aria-label')) ?? '').replace('Watcher ', '');
    expect(ref, SIEMBRA_HINT).not.toBe('');
    try {
      await page.getByRole('button', { name: `Pausar — ${ref}` }).click();
      await expect(page.getByRole('article', { name: `Watcher ${ref}` })).toHaveAttribute('data-state', 'PAUSED');
    } finally {
      const reactivar = page.getByRole('button', { name: `Reactivar — ${ref}` });
      if (await reactivar.count()) await reactivar.click();
    }
    await expect(page.getByRole('article', { name: `Watcher ${ref}` })).toHaveAttribute('data-state', 'ACTIVE');
  });

  test('Ver resultados lleva a SRCH-01 con la referencia del watcher precargada', async ({ page }) => {
    const trig = page.locator('article[data-state="TRIGGERED"]').first();
    const ref = ((await trig.getAttribute('aria-label')) ?? '').replace('Watcher ', '');
    await trig.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
    await expect(page.getByText(ref, { exact: false }).first()).toBeVisible();
  });

  test('volver a Comprando desde otro ítem lleva a la búsqueda, no a la lista de watchers', async ({ page }) => {
    await topNav(page).getByRole('button', { name: 'Panel' }).click();
    await topNav(page).getByRole('button', { name: 'Comprando' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
  });
});

test.describe('SRCH-03 · aislamiento por RLS (BETA)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*/E2E_BETA_*');
  // F-166 · el proyecto entero arranca con la sesión de ALPHA.
  test.use({ storageState: NO_SESSION });

  test('BETA no ve ningún watcher de ALPHA, y solo los suyos', async ({ page }) => {
    await signIn(page, BETA);
    await topNav(page).getByRole('button', { name: 'Comprando' }).click();
    await page.getByRole('button', { name: 'Mis watchers' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mis watchers' })).toBeVisible();
    // Sin datos de ALPHA: ni por referencia, ni por estar la organización mezclada.
    await expect(page.getByRole('button', { name: /^Todos \d+$/ })).toBeVisible();
    const refs = (await tarjetas(page)).map((t) => t.ref);
    for (const ajena of ['6308-ZZ', 'NU2210-E-TVP2', '22316-E', '7210-BECBP', '6205-2RS']) {
      expect(refs, `BETA ve el watcher ${ajena} de ${ALPHA.org}`).not.toContain(ajena);
    }
  });
});
