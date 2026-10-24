import './env';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { canResetFixture, haveOperatorCreds, NO_SESSION, OPERATOR, signIn } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · `dual-entry-routes#2` (ruta 00.2, usuario desconocido) · F-279.
 *
 * Escrito por Claude Code (`Plan §6`); el Coder no lo ve. Cierra el «falta solo e2e» de la matriz: un
 * desconocido envía el FSR **de verdad** (navegador → Edge Function `access-request` desplegada → fila en
 * `registration_requests`) y la solicitud llega a la cola de ADMIN-01 como pendiente. Ningún test de unidad
 * lo prueba: `AccessRequest.test` y `AdminRequests.test` mockean la red cada uno por su lado.
 *
 * ⚠ ESTE FICHERO ESCRIBE, A DIFERENCIA DE `access-request.spec.ts` Y `admin-requests.spec.ts`, que son de solo
 * lectura y esperan exactamente las tres solicitudes de la siembra. Por eso:
 *   · la fila lleva un nombre y un correo fijos y reconocibles, y se borra con la service key en un `finally`;
 *   · se borra también ANTES de empezar, por si una corrida anterior se cayó sin llegar al `finally`;
 *   · `playwright.config.ts` corre con `workers: 1`, así que ningún otro test ve la fila en medio.
 * Sin service key el test se salta con motivo a la vista: sin ella no se puede garantizar la limpieza.
 */
if (process.env.CI && (!haveOperatorCreds || !canResetFixture)) {
  throw new Error(
    'En CI hacen falta E2E_OPERATOR_* y SUPABASE_SERVICE_KEY. Sin ellas dual-entry-routes#2 no se prueba contra la base y el verde no significa nada.',
  );
}

const ORG = 'ZZ Prueba Matriz SL';
const EMAIL = 'zz.prueba.matriz@bearingworld.test';

function admin() {
  return createClient(process.env.VITE_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_KEY ?? '', {
    auth: { persistSession: false },
  });
}

async function borrarFila() {
  const { error } = await admin().from('registration_requests').delete().eq('applicant_email', EMAIL);
  if (error) throw new Error(`borrando la solicitud de prueba: ${error.message}`);
}

test.describe('dual-entry-routes#2 · el FSR de un desconocido llega a la cola del Operador', () => {
  test.skip(!haveOperatorCreds, 'sin credenciales E2E_OPERATOR_*');
  test.skip(!canResetFixture, 'sin service key no se puede garantizar el borrado de la solicitud de prueba');
  test.use({ storageState: NO_SESSION });

  test.beforeEach(borrarFila);
  test.afterEach(borrarFila);

  test('enviar el FSR crea la fila PENDING_REVIEW y el Operador la ve en la cola', async ({ page, browser }) => {
    await page.goto('/#solicitud-de-registro');
    await page.getByRole('textbox', { name: 'Email del solicitante' }).fill(EMAIL);
    await page.getByRole('textbox', { name: 'Nombre y apellidos' }).fill('Prueba Matriz');
    await page.getByRole('textbox', { name: 'Nombre de la organización' }).fill(ORG);
    await page.getByRole('combobox', { name: 'País de la organización' }).selectOption('ES');
    await page.getByRole('textbox', { name: 'Teléfono de contacto' }).fill('+34 600 000 000');
    await page.getByRole('textbox', { name: 'Sitio web' }).fill('https://www.zz-prueba-matriz.test');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Tu solicitud está en revisión' })).toBeVisible();

    // La fila existe de verdad, pendiente: la función escribió, no solo contestó.
    const { data, error } = await admin()
      .from('registration_requests')
      .select('org_name, state')
      .eq('applicant_email', EMAIL);
    expect(error).toBeNull();
    expect(data).toEqual([{ org_name: ORG, state: 'PENDING_REVIEW' }]);

    // Y el Operador la ve en su cola, con la misma RLS que la de las tres de la siembra. En un contexto NUEVO:
    // este navegador recuerda la solicitud enviada y en `/` volvería a enseñar «Tu solicitud está en revisión».
    const operador = await browser.newContext({ storageState: NO_SESSION });
    try {
      const cola = await operador.newPage();
      await signIn(cola, OPERATOR);
      await expect(cola.getByRole('heading', { level: 1, name: 'Cola de solicitudes de registro' })).toBeVisible();
      await expect(cola.getByRole('button', { name: ORG })).toBeVisible();
    } finally {
      await operador.close();
    }
  });
});
