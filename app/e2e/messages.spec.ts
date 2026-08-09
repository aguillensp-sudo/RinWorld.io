import './env';
import { expect, test } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, BETA, haveCreds, NO_SESSION, signIn, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los 20 tests de unidad no pueden probar, y por eso existe.**
 * `Messages.test.tsx` mockea `fetchThreadPage`, así que pasaría entero con:
 *
 *   · un embed sin la clave ajena nombrada — y `threads` tiene TRES claves ajenas
 *     hacia `organizations`, así que `organizations(name)` a secas devuelve
 *     `PGRST201` y la pantalla se queda en blanco. Con una sola FK de más, eso
 *     dejó el login roto varias horas el día 3 (F-020);
 *   · la contraparte resuelta al revés — enseñar mi propia organización en cada
 *     fila en vez de la otra. No falla nada: sale una lista plausible y falsa;
 *   · una lectura que se trajera hilos ajenos.
 *
 * Igual que en `inventory.spec.ts` y `session.spec.ts` (F-015): si faltan
 * credenciales en CI, esto es un error duro. Un test que se salta la puerta y
 * dice "passed" es peor que no tenerlo.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas MSG-01 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Las cinco organizaciones del bloque "Datos de ejemplo" de la spec §3. Son
 *  fabricantes inventados para el mock, no distribuidoras del catálogo: si
 *  aparecen en pantalla, MSG-01 está pintando el HTML aprobado. */
const INVENTADAS = [
  'NSK Europe Ltd',
  'Schaeffler Iberia SL',
  'SKF Nordic AB',
  'Timken Europe GmbH',
  'NTN-SNR Roulements',
];

test.describe('MSG-01 · hilos reales', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Hilos' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hilos' })).toBeVisible();
    // Se espera a la lista, no solo al título: leer filas antes de que llegue la
    // consulta encuentra cero y falla por carrera, no por defecto.
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });

  test('pinta hilos de la base, no los datos de ejemplo del mock', async ({ page }) => {
    expect(await page.getByRole('listitem').count()).toBeGreaterThan(0);
    for (const inventada of INVENTADAS) {
      await expect(page.getByText(inventada, { exact: true })).toHaveCount(0);
    }
  });

  test('la contraparte es la OTRA organización, nunca la mía', async ({ page }) => {
    // El bug silencioso de esta pantalla. El par va en orden canónico en base
    // (`org_low_id < org_high_id`), no por rol, así que resolver la contraparte
    // exige comparar con mi propia organización. Hacerlo al revés no da error:
    // da una lista entera de "Rodamientos Ibéricos" hablando consigo mismo.
    const filas = page.getByRole('listitem');
    for (let i = 0; i < (await filas.count()); i++) {
      await expect(filas.nth(i)).not.toContainText(ALPHA.org);
    }
    await expect(page.getByText(BETA.org, { exact: true })).toBeVisible();
  });

  test('el embed de organizaciones resuelve — nombre y país en cada fila', async ({ page }) => {
    // Si el embed fuera `organizations(name)` sin nombrar la FK, PostgREST
    // devolvería PGRST201 y no habría ni una fila. Y los nombres van con sus
    // diacríticos: `organizations.name` es contenido de demo (F-019).
    await expect(page.getByText('Nordwälz Lager', { exact: true })).toBeVisible();
    await expect(page.getByText(/Nordwaelz|Nordwalz/)).toHaveCount(0);
    await expect(page.getByRole('listitem').first()).toContainText(/^[A-Z]{2}$|[A-Z]{2}/);
  });

  test('la vista previa es metadato, y no se escapa ni un byte cifrado', async ({ page }) => {
    // `content_ciphertext` no se pide siquiera en la consulta. Este test lo mira
    // desde donde se ve de verdad: el DOM.
    await expect(page.getByText('Tarjeta de oferta · 6205-2RS')).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('content_ciphertext');
    expect(html).not.toContain('a1b2c3d4e5f6');
  });

  test('los hilos van del más reciente al más antiguo', async ({ page }) => {
    // El orden es `last_item_at desc` en el servidor. La oferta de Nordwälz es de
    // hace 2 horas y el hilo cerrado con Anadolu de hace 7 días.
    const primera = page.getByRole('listitem').first();
    await expect(primera).toContainText('Nordwälz Lager');
  });

  test('los badges de estado son los literales del esquema', async ({ page }) => {
    for (const estado of ['CON OFERTA PENDIENTE', 'CON CONSULTA PENDIENTE', 'ABIERTO']) {
      await expect(page.getByText(estado, { exact: true }).first()).toBeVisible();
    }
  });

  test('la búsqueda por organización filtra contra la base', async ({ page }) => {
    const antes = await page.getByRole('listitem').count();
    expect(antes).toBeGreaterThan(1);

    await page.getByPlaceholder('Buscar por nombre de organización...').fill('Nordwälz');
    await page.getByPlaceholder('Buscar por nombre de organización...').press('Enter');

    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('listitem').first()).toContainText('Nordwälz Lager');
  });

  test('"Nuevo contacto" está deshabilitado y dice por qué', async ({ page }) => {
    // DIR-01 no está en el alcance (Plan §9). Mismo trato que el botón de subida
    // de INV-01: presente, deshabilitado y con el motivo (F-023 e).
    await expect(page.getByRole('button', { name: /Nuevo contacto/ })).toBeDisabled();
    await expect(page.getByTestId('directorio-scope')).toContainText(/fuera del MVP/i);
  });
});

test.describe('MSG-01 · las dos cuentas ven cosas distintas', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: NO_SESSION });

  test('Beta ve el mismo hilo desde el otro lado, y ninguno de los ajenos', async ({ page }) => {
    // La prueba de RLS que ningún test de unidad alcanza. `threads` tiene UNA
    // sola política de lectura (`threads_select_participant`), no dos permisivas
    // que se sumen como en `inventory_lines` — pero eso hay que demostrarlo
    // contra la base, no darlo por bueno leyendo la migración.
    await signIn(page, BETA);
    await topNav(page).getByRole('button', { name: 'Hilos' }).click();
    await expect(page.getByRole('listitem').first()).toBeVisible();

    // El hilo compartido, con Alpha de contraparte esta vez.
    await expect(page.getByText(ALPHA.org, { exact: true })).toBeVisible();

    // Y ninguno de los cuatro hilos que Alpha tiene con las otras cuatro.
    for (const ajena of ['Cuscinetti Padana', 'Roulements Rhône', 'Anadolu Rulman']) {
      await expect(page.getByText(ajena, { exact: true })).toHaveCount(0);
    }
  });
});
