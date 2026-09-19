import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, haveCreds, haveOperatorCreds, NO_SESSION, OPERATOR, signIn, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-02 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar.** `AdminBilling.test.tsx`
 * mockea las seis funciones de red, así que pasaría entero aunque la vista
 * `billing_org_status` no calculase bien los estados, aunque la RLS de `0034` dejase
 * leer los cobros a cualquier miembro, o aunque el orden "días restantes
 * ascendente" no lo hiciera nadie.
 *
 * ⚠ **NADA DE ESTE FICHERO ESCRIBE.** `billing_payments` no admite DELETE para nadie
 * salvo `postgres` (`0034` solo da INSERT a `service_role`), así que un solo
 * "Marcar pago recibido" real dejaría un pago permanente y descuadraría la siembra
 * sin remedio desde Playwright -mismo criterio que ADMIN-01 (F-169)-. El camino de
 * escritura ya está probado con mocks; aquí se prueba lectura, y el modal solo se
 * abre y se cancela.
 *
 * ⚠ **DEPENDE DE `supabase/seed/demo_billing.sql`, y las fechas de esa siembra
 * envejecen** (Cuscinetti sale de `Próximos a vencer` a los ~10 días). Por eso los
 * chips se prueban por PROPIEDAD -cada fila visible cumple la regla del chip y el
 * recuento coincide con el de `Todos`-, no contra nombres fijos; y un test aparte
 * (`la siembra está anclada`) falla en voz alta, con la instrucción de resembrar, si
 * falta alguno de los cuatro estados, en vez de dejar pasar en verde un chip vacío.
 */
if (process.env.CI && !haveOperatorCreds) {
  throw new Error(
    'En CI hacen falta E2E_OPERATOR_EMAIL/PASSWORD. Sin ellas ADMIN-02 no se prueba contra la base y el verde no significa nada.',
  );
}

interface Fila {
  nombre: string;
  estado: string;
  dias: number;
}

async function filas(page: Page): Promise<Fila[]> {
  const rows = page.getByRole('row');
  const n = await rows.count();
  const out: Fila[] = [];
  for (let i = 1; i < n; i++) {
    const celdas = rows.nth(i).getByRole('cell');
    if ((await celdas.count()) < 7) continue; // la fila de "vacío" ocupa una sola celda
    const texto = async (c: number) => ((await celdas.nth(c).textContent()) ?? '').trim();
    out.push({
      nombre: await texto(0),
      estado: await texto(2),
      dias: Number.parseInt((await texto(5)).replace(/\s*días?$/, ''), 10),
    });
  }
  return out;
}

const SIEMBRA_HINT =
  'Resiembra con supabase/seed/demo_billing.sql (las fechas de la siembra son relativas a hoy y envejecen).';

test.describe('ADMIN-02 · gestión de cobros real', () => {
  test.skip(!haveOperatorCreds, 'sin credenciales E2E_OPERATOR_*');
  // F-166 · el proyecto entero arranca con la sesión de ALPHA; sin esto `signIn`
  // espera un formulario de login que nunca aparece.
  test.use({ storageState: NO_SESSION });

  test.beforeEach(async ({ page }) => {
    await signIn(page, OPERATOR);
    await expect(page.getByTestId('operator-home')).toBeVisible();
    await topNav(page).getByRole('button', { name: 'Cobros' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gestión de cobros' })).toBeVisible();
    // A la tabla, no solo al título: leer filas antes de que llegue la consulta
    // encuentra cero y falla por carrera, no por defecto (F-159).
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('la siembra está anclada: aparecen los cuatro estados de la spec', async ({ page }) => {
    const estados = new Set((await filas(page)).map((f) => f.estado));
    for (const e of ['ACTIVE', 'SUSPENDED', 'EN PRUEBA', 'CANDIDATA A BORRADO']) {
      expect(estados.has(e), `falta el estado ${e}. ${SIEMBRA_HINT}`).toBe(true);
    }
    const proximas = (await filas(page)).filter((f) => f.estado === 'ACTIVE' && f.dias >= 0 && f.dias <= 15);
    expect(proximas.length, `ninguna ACTIVE vence en 15 días. ${SIEMBRA_HINT}`).toBeGreaterThan(0);
  });

  test('el orden por defecto es días restantes ascendente: la más vencida primero', async ({ page }) => {
    const dias = (await filas(page)).map((f) => f.dias);
    expect(dias.length).toBeGreaterThanOrEqual(8);
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
    expect(dias[0]).toBeLessThan(0);
  });

  test('los cinco chips filtran de verdad: cada fila visible cumple la regla del chip', async ({ page }) => {
    const todas = await filas(page);
    const reglas: [string, (f: Fila) => boolean][] = [
      ['Próximos a vencer', (f) => f.estado === 'ACTIVE' && f.dias >= 0 && f.dias <= 15],
      ['Suspendidos', (f) => f.estado === 'SUSPENDED'],
      ['Candidatas a borrado', (f) => f.estado === 'CANDIDATA A BORRADO'],
      ['En periodo de prueba', (f) => f.estado === 'EN PRUEBA'],
    ];
    for (const [chip, regla] of reglas) {
      await page.getByRole('button', { name: new RegExp(`^${chip} \\d+$`) }).click();
      const esperadas = todas.filter(regla).map((f) => f.nombre);
      const visibles = (await filas(page)).map((f) => f.nombre);
      expect(visibles, `chip «${chip}»`).toEqual(esperadas);
    }
    await page.getByRole('button', { name: /^Todos \d+$/ }).click();
    expect((await filas(page)).map((f) => f.nombre)).toEqual(todas.map((f) => f.nombre));
  });

  test('los contadores de los chips coinciden con las filas que dejan pasar', async ({ page }) => {
    const todas = await filas(page);
    await expect(page.getByRole('button', { name: `Todos ${todas.length}` })).toBeVisible();
    const susp = todas.filter((f) => f.estado === 'SUSPENDED').length;
    await expect(page.getByRole('button', { name: `Suspendidos ${susp}` })).toBeVisible();
  });

  test('las dos suspendidas de la siembra: Ruiz suspendida, Timken candidata a borrado', async ({ page }) => {
    const todas = await filas(page);
    expect(todas.find((f) => f.nombre === 'Distribuciones Ruiz SL')?.estado, SIEMBRA_HINT).toBe('SUSPENDED');
    expect(todas.find((f) => f.nombre === 'Timken Europe GmbH')?.estado, SIEMBRA_HINT).toBe('CANDIDATA A BORRADO');
  });

  test('la sección "Candidatas a borrado" lista a Timken, con Iniciar borrado deshabilitado', async ({ page }) => {
    const seccion = page.getByRole('region', { name: 'Candidatas a borrado' });
    await expect(seccion.getByText('Timken Europe GmbH')).toBeVisible();
    await expect(seccion.getByText('6 meses en SUSPENDED')).toBeVisible();
    await expect(seccion.getByRole('button', { name: /Iniciar borrado/ })).toBeDisabled();
  });

  test('el panel de una organización con pagos muestra el email y los dos pagos sembrados', async ({ page }) => {
    await page.getByRole('button', { name: 'Cuscinetti Padana' }).click();
    const panel = page.getByRole('complementary', { name: 'Detalle de organización' });
    await expect(panel.getByRole('heading', { name: 'Cuscinetti Padana' })).toBeVisible();
    await expect(panel.getByText('info@cuscinettipadana.it')).toBeVisible();
    const pagos = panel.getByRole('list', { name: 'Historial de pagos' }).getByRole('listitem');
    await expect(pagos).toHaveCount(2);
    await expect(pagos.first()).toContainText('Demo: transferencia del segundo ciclo');
  });

  test('el panel de una suspendida enseña la transición automática', async ({ page }) => {
    await page.getByRole('button', { name: 'Distribuciones Ruiz SL' }).click();
    const panel = page.getByRole('complementary', { name: 'Detalle de organización' });
    const estados = panel.getByRole('list', { name: 'Historial de estados' });
    await expect(estados.getByRole('listitem').first()).toContainText('ACTIVE → SUSPENDED');
    await expect(estados.getByRole('listitem').first()).toContainText('Automático');
    await expect(panel.getByText('Sin pagos confirmados.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Reactivar' })).toBeVisible();
  });

  test('la fila sombreada es la clicada (F-179), sobre datos reales', async ({ page }) => {
    await page.getByRole('button', { name: 'Timken Europe GmbH' }).click();
    const actual = page.locator('tr[aria-current="true"]');
    await expect(actual).toHaveCount(1);
    await expect(actual).toContainText('Timken Europe GmbH');
  });

  test('el modal de pago se abre con la fecha de hoy y se cancela SIN escribir nada', async ({ page }) => {
    const antes = await filas(page);
    await page.getByRole('button', { name: 'Marcar pago recibido — Cuscinetti Padana' }).click();
    const modal = page.getByRole('dialog', { name: 'Marcar pago recibido' });
    await expect(modal.getByLabel('Fecha del pago')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
    expect(await filas(page)).toEqual(antes);
  });

  test('no hay ningún campo de tarjeta: cobro por transferencia, sin pasarela', async ({ page }) => {
    await expect(page.getByLabel(/tarjeta|card|cvv/i)).toHaveCount(0);
  });
});

test.describe('ADMIN-02 · la RLS de 0034 esconde los cobros a quien no es Operador', () => {
  // Va con la sesión de ALPHA que ya trae el proyecto (`storageState`): NO se hace
  // un login por contraseña aquí, porque `trace: on-first-retry` guarda el cuerpo
  // de cada petición y la contraseña acabaría en un artefacto público de la CI (F-038).
  test.skip(!haveCreds, 'sin credenciales E2E_ALPHA_*');

  test('un miembro no ve ninguna fila de los cuatro objetos de billing', async ({ page }) => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!url || !key, 'sin VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY');

    await page.goto('/');
    await expect(page.getByTestId('nav-org')).toContainText(ALPHA.org);
    const token = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (/^sb-.*-auth-token$/.test(k)) return (JSON.parse(localStorage.getItem(k) ?? '{}') as { access_token?: string }).access_token;
      }
      return undefined;
    });
    expect(token, 'la sesión de ALPHA no dejó token en localStorage').toBeTruthy();

    const headers = { apikey: key as string, Authorization: `Bearer ${token as string}` };
    for (const tabla of ['billing_org_status', 'billing_payments', 'billing_status_events', 'billing_accounts']) {
      const res = await page.request.get(`${url}/rest/v1/${tabla}?select=*`, { headers });
      expect(res.ok(), `${tabla} debería responder 200 con cero filas, no un error`).toBe(true);
      expect(await res.json(), `${tabla} no debe filtrar filas a un miembro`).toEqual([]);
    }
  });
});
