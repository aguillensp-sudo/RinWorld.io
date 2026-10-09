import './env';
import { expect, test, type Page } from '@playwright/test';
import { ALPHA, BETA, canResetFixture, haveCreds, NO_SESSION, signIn, topNav } from './fixtures';

/**
 * H5 · dos empresas negocian de punta a punta (plan-demo-h5.md, D3).
 *
 *   búsqueda (SRCH-01) → consulta → oferta (MSG-02) → contraoferta → aceptar → ACUERDO ALCANZADO
 *
 * Dos contextos de navegador independientes, uno por empresa, con sus propias claves en
 * memoria: BETA (Nordwälz Lager) compra y ALPHA (Rodamientos Ibéricos) vende. Es lo que
 * los tests de unidad no pueden probar: que el cifrado de uno lo descifra el otro y que
 * cada paso deja el hilo donde la máquina de estados dice.
 *
 * ⚠ ESCRIBE. Por eso se llama `zz-…`: con un solo worker los ficheros corren por orden
 * alfabético y este va el último, así que ninguna otra spec ve el hilo Alpha–Beta
 * cambiado. Al empezar VACÍA los elementos de ese hilo (clave de servicio, como
 * `fixture.setup.ts`) para partir de un hilo sin nada y no del de la siembra, que ya tiene
 * una oferta Pendiente; al acabar, `restore.teardown.ts` repone los elementos de los cinco
 * hilos de demo.
 *
 * ⚠ Se vacía el hilo, NO se borra: `demo-reset.mjs` repone los ELEMENTOS de `HILO_IDS` pero
 * da por hecho que los hilos existen. Borrarlo dejaba la reposición rota (FK de
 * `thread_items_thread_id_fkey`) y la siembra de `bearingworld-e2e` sin su hilo.
 *
 * La línea consultada, `32007` Koyo, es de ALPHA y solo la tiene otra organización más:
 * sale en pocas filas y no depende de que haya mucho stock.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_* y E2E_BETA_*. Sin ellas H5 no se prueba contra la base y el verde no significa nada.',
  );
}

const HILO_ALPHA_BETA = '11111111-0000-4000-8000-000000000001';
const REFERENCIA = '32007';

/** Las dos organizaciones del hilo de siembra (orden canónico: low < high). */
const ORG_ALPHA = 'a1000000-0000-4000-8000-000000000001';
const ORG_BETA = 'b2000000-0000-4000-8000-000000000002';

function credenciales() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

/** Borra el hilo Alpha–Beta entero (el de siembra o el que haya creado un test). */
async function borrarHiloAlphaBeta() {
  const { url, headers } = credenciales();
  const res = await fetch(`${url}/rest/v1/threads?org_low_id=eq.${ORG_ALPHA}&org_high_id=eq.${ORG_BETA}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`No se pudo borrar el hilo Alpha–Beta (HTTP ${res.status}).`);
}

/** Vuelve a poner la FILA del hilo de siembra, para que `demo-reset.mjs` pueda reponer sus elementos. */
async function reponerFilaDelHiloDeSiembra() {
  const { url, headers } = credenciales();
  const res = await fetch(`${url}/rest/v1/threads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: HILO_ALPHA_BETA,
      org_low_id: ORG_ALPHA,
      org_high_id: ORG_BETA,
      created_by_org_id: ORG_ALPHA,
      state: 'CON OFERTA PENDIENTE',
      created_at: '2026-08-10T08:39:23.981814+00:00',
    }),
  });
  if (!res.ok) throw new Error(`No se pudo reponer la fila del hilo de siembra (HTTP ${res.status}).`);
}

/** Vacía de elementos el hilo de la siembra entre las dos (por cascada, sus claves). */
async function vaciarHiloDeSiembra() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  const res = await fetch(`${url}/rest/v1/thread_items?thread_id=eq.${HILO_ALPHA_BETA}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`No se pudo vaciar el hilo de siembra (HTTP ${res.status}).`);
}

/** Entra en Hilos y abre el hilo con esa organización. */
async function abrirHilo(page: Page, org: string) {
  await topNav(page).getByRole('button', { name: 'Hilos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hilos' })).toBeVisible();
  await expect(page.getByRole('listitem').first()).toBeVisible();
  await page.getByRole('button', { name: new RegExp(org) }).click();
  await expect(page.getByTestId('thread-body')).toBeVisible();
}

test.describe('H5 · negociación de punta a punta', () => {
  test.skip(!haveCreds || !canResetFixture, 'sin credenciales E2E_* o sin clave de servicio para reponer la siembra');
  test.use({ storageState: NO_SESSION });

  test('consulta → oferta → contraoferta → aceptar: el hilo acaba en ACUERDO ALCANZADO', async ({ browser }) => {
    test.setTimeout(240_000);
    await vaciarHiloDeSiembra();

    const ctxBeta = await browser.newContext();
    const ctxAlpha = await browser.newContext();
    const beta = await ctxBeta.newPage();
    const alpha = await ctxAlpha.newPage();

    try {
      // 1 · BETA busca la referencia y consulta SOLO la línea de ALPHA.
      await signIn(beta, BETA);
      await topNav(beta).getByRole('button', { name: 'Comprando' }).click();
      await expect(beta.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
      await beta.getByRole('button', { name: 'Añadir filtro' }).click();
      await beta.getByLabel('Campo').selectOption('Ref');
      await beta.getByLabel('Valor').fill(REFERENCIA);
      await beta.getByRole('button', { name: 'Añadir', exact: true }).click();
      const fila = beta.getByRole('row').filter({ hasText: ALPHA.org });
      await expect(fila).toHaveCount(1);
      await fila.getByRole('checkbox').check();
      await fila.getByRole('button', { name: 'Consultar' }).click();
      await expect(beta.getByRole('status').filter({ hasText: /consulta/i }).first()).toBeVisible();

      // 2 · ALPHA ve la consulta y responde con una oferta.
      await signIn(alpha, ALPHA);
      await abrirHilo(alpha, BETA.org);
      await expect(alpha.getByRole('button', { name: 'Responder con oferta' })).toBeVisible();
      await alpha.getByRole('button', { name: 'Responder con oferta' }).click();
      const dialogoAlpha = alpha.getByRole('dialog');
      await dialogoAlpha.getByLabel('Precio unitario').fill('12,50');
      await dialogoAlpha.getByRole('button', { name: 'Enviar oferta' }).click();
      await expect(dialogoAlpha).toBeHidden();
      await expect(alpha.getByText('Respondida con oferta')).toBeVisible();

      // 3 · BETA ve la oferta y contraoferta.
      await topNav(beta).getByRole('button', { name: 'Panel' }).click();
      await abrirHilo(beta, ALPHA.org);
      await expect(beta.getByRole('button', { name: 'Contra-ofertar' })).toBeVisible();
      await beta.getByRole('button', { name: 'Contra-ofertar' }).click();
      const dialogoBeta = beta.getByRole('dialog');
      await dialogoBeta.getByLabel('Precio unitario').fill('11,80');
      await dialogoBeta.getByRole('button', { name: 'Enviar contraoferta' }).click();
      await expect(dialogoBeta).toBeHidden();
      await expect(beta.getByText('Superada por contraoferta')).toBeVisible();

      // 4 · ALPHA acepta la contraoferta; el hilo pasa a ACUERDO ALCANZADO.
      await topNav(alpha).getByRole('button', { name: 'Panel' }).click();
      await abrirHilo(alpha, BETA.org);
      await expect(alpha.getByRole('button', { name: 'Aceptar oferta' })).toBeVisible();
      await alpha.getByRole('button', { name: 'Aceptar oferta' }).click();
      await expect(alpha.getByText('ACUERDO ALCANZADO').first()).toBeVisible();

      // 5 · BETA ve el mismo estado desde su lado.
      await topNav(beta).getByRole('button', { name: 'Panel' }).click();
      await abrirHilo(beta, ALPHA.org);
      await expect(beta.getByText('ACUERDO ALCANZADO').first()).toBeVisible();
    } finally {
      await ctxBeta.close();
      await ctxAlpha.close();
    }
  });

  test('Contactar sin hilo previo: escribe el primer mensaje y el otro lo lee (F-211)', async ({ browser }) => {
    test.setTimeout(180_000);
    // Sin hilo entre las dos: se borra la fila entera, y se repone en `finally` para que la
    // restauración de la siembra encuentre su hilo (ver arriba).
    await borrarHiloAlphaBeta();

    const ctxBeta = await browser.newContext();
    const ctxAlpha = await browser.newContext();
    const beta = await ctxBeta.newPage();
    const alpha = await ctxAlpha.newPage();
    const MENSAJE = 'Hola, somos Nordwälz y queremos hablar de stock de 32007.';

    try {
      await signIn(beta, BETA);
      await topNav(beta).getByRole('button', { name: 'Empresas' }).click();
      await expect(beta.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
      await expect(beta.getByRole('row').nth(1)).toBeVisible();
      await beta.getByRole('button', { name: ALPHA.org, exact: true }).click();
      await expect(beta.getByRole('heading', { level: 1, name: ALPHA.org })).toBeVisible();

      const contactar = beta.getByRole('button', { name: 'Contactar' });
      await expect(contactar).toBeEnabled();
      await contactar.click();
      await beta.getByLabel('Primer mensaje').fill(MENSAJE);
      await beta.getByRole('button', { name: 'Enviar y abrir el hilo' }).click();

      // Se abre el hilo recién creado, con el mensaje descifrado en el lado de quien lo escribió.
      await expect(beta.getByTestId('thread-body')).toBeVisible();
      await expect(beta.getByText(MENSAJE)).toBeVisible();

      // Y la otra empresa lo ve, descifrado con SU clave.
      await signIn(alpha, ALPHA);
      await abrirHilo(alpha, BETA.org);
      await expect(alpha.getByText(MENSAJE)).toBeVisible();
    } finally {
      await ctxBeta.close();
      await ctxAlpha.close();
      await borrarHiloAlphaBeta();
      await reponerFilaDelHiloDeSiembra();
    }
  });
});
