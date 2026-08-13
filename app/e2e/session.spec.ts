import { test, expect } from '@playwright/test';
import {
  ALPHA,
  BETA,
  NO_SESSION,
  haveCreds,
  sidebar,
  signIn,
  topNav,
  veraPanel,
} from './fixtures';

// En CI las credenciales son obligatorias: si faltan, el trabajo tiene que
// fallar, no saltarse la puerta y reportar verde.
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD y E2E_BETA_EMAIL/PASSWORD. Sin ellas no se prueba la puerta del día 2 y el verde no significa nada.',
  );
}

test.describe('shell sin sesión', () => {
  test.use({ storageState: NO_SESSION });

  test('la raíz muestra el login, no el shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('form', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    await expect(veraPanel(page)).toBeHidden();
  });

  test('el botón se habilita con los dos campos rellenos', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Correo electrónico').fill('x@y.com');
    await page.getByLabel('Contraseña').fill('secreto');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});

/**
 * LA PUERTA DE SALIDA DEL DÍA 2, tal como la fija openspec/mvp/ESTADO.md:
 * "dos navegadores, dos cuentas, cada una entra y ve su propia sesión."
 *
 * Este test hace dos logins de verdad en dos contextos limpios — no reutiliza el
 * estado guardado por auth.setup.ts, porque el login simultáneo de las dos
 * cuentas ES lo que se está probando.
 */
test.describe('puerta del día 2 · dos navegadores, dos cuentas', () => {
  test.skip(!haveCreds, 'Faltan E2E_ALPHA_* / E2E_BETA_* en el entorno');

  test('cada cuenta entra y ve su propia sesión', async ({ browser }) => {
    // Dos contextos = dos navegadores de verdad, con cookies y storage separados.
    const alphaCtx = await browser.newContext({ storageState: NO_SESSION });
    const betaCtx = await browser.newContext({ storageState: NO_SESSION });
    const alphaPage = await alphaCtx.newPage();
    const betaPage = await betaCtx.newPage();

    await Promise.all([signIn(alphaPage, ALPHA), signIn(betaPage, BETA)]);

    // Cada una ve SU organización en el nav.
    await expect(alphaPage.getByTestId('nav-org')).toHaveText(ALPHA.org);
    await expect(betaPage.getByTestId('nav-org')).toHaveText(BETA.org);

    // Y su propio saludo. El día 9 el andamiaje `Welcome` se sustituyó por
    // PANEL-01, que es el punto de entrada de verdad: el saludo vive ahora en su
    // subtítulo. Es la misma comprobación, en el sitio nuevo.
    await expect(alphaPage.getByText(/^Bienvenido,/)).toBeVisible();
    await expect(betaPage.getByText(/^Bienvenido,/)).toBeVisible();

    // Lo que de verdad prueba el aislamiento: cada una actúa COMO su organización.
    //
    // ⚠ Y se comprueba ACOTADO a la identidad -nav y usuario-, nunca sobre la
    // página entera. Se intentó con `body` y falló con razón (F-080): PANEL-01
    // pinta el nombre de la CONTRAPARTE en la línea de detalle -"Más reciente:
    // 6205-2RS · Rodamientos Ibéricos"-, así que la organización ajena aparece en
    // la pantalla de forma completamente legitima: es con quien se negocia.
    // Confundir "no negocia con ella" con "no la ve" habría convertido un aserto
    // de aislamiento en uno que prohibe el producto.
    await expect(alphaPage.getByTestId('nav-org')).not.toHaveText(BETA.org);
    await expect(betaPage.getByTestId('nav-org')).not.toHaveText(ALPHA.org);
    await expect(alphaPage.getByTestId('nav-user')).not.toHaveText(
      await betaPage.getByTestId('nav-user').innerText(),
    );

    await alphaCtx.close();
    await betaCtx.close();
  });
});

/**
 * El resto del shell, sobre la sesión ya autenticada por auth.setup.ts. Sin
 * repetir login: seis logins en paralelo con la misma cuenta hacían la suite
 * intermitente.
 */
test.describe('shell autenticado', () => {
  test.skip(!haveCreds, 'Faltan E2E_ALPHA_* / E2E_BETA_* en el entorno');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-org')).toBeVisible();
  });

  test('el shell aparece completo', async ({ page }) => {
    await expect(page.getByTestId('nav-org')).toHaveText(ALPHA.org);
    await expect(topNav(page)).toBeVisible();
    await expect(veraPanel(page)).toBeVisible();
    // Acotado a la barra superior: los ocho ítems están duplicados en el menú
    // lateral y sin acotar la consulta no es unívoca.
    await expect(
      topNav(page).getByRole('button', { name: 'Panel', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('el menú lateral se abre y se cierra sin empujar el layout', async ({ page }) => {
    const sb = sidebar(page);
    const contentBefore = await veraPanel(page).boundingBox();

    // Es overlay: existe siempre, translateX(-100%) cerrado. Se comprueba por
    // posición, que es lo que el usuario percibe.
    expect((await sb.boundingBox())?.x ?? 0).toBeLessThan(0);

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(async () => {
      expect((await sb.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
    }).toPass();

    // §2: el sidebar se superpone, NO refluye el layout. Si empujara, VERA se
    // habría movido.
    const contentAfter = await veraPanel(page).boundingBox();
    expect(contentAfter?.x).toBe(contentBefore?.x);

    await page.getByRole('button', { name: 'Cerrar menú' }).click();
    await expect(async () => {
      expect((await sb.boundingBox())?.x ?? 0).toBeLessThan(0);
    }).toPass();
  });

  test('VERA colapsa a 32px y vuelve', async ({ page }) => {
    const vera = veraPanel(page);
    expect((await vera.boundingBox())?.width ?? 0).toBeGreaterThan(100);

    await page.getByRole('button', { name: 'Colapsar VERA' }).click();
    await expect(async () => {
      const w = (await vera.boundingBox())?.width ?? 0;
      expect(Math.round(w)).toBe(32);
    }).toPass();

    await page.getByRole('button', { name: 'Expandir VERA' }).click();
    await expect(async () => {
      expect((await vera.boundingBox())?.width ?? 0).toBeGreaterThan(100);
    }).toPass();
  });

  /**
   * ⚠ **EL PROXY SE INTERCEPTA, Y NO ES POR VELOCIDAD.** `CLAUDE.md` §5 prohíbe
   * llamadas reales al LLM en CI automático, así que aquí Sonnet queda fuera.
   *
   * Lo que sí se prueba es **todo el camino del cliente**: construir la petición,
   * firmarla con la sesión, leer la respuesta y pintar. Lo único sin cubrir es lo
   * que diga el modelo — que no es determinista y no se puede afirmar en un test.
   *
   * Sustituye al test del día 2, que comprobaba que VERA declaraba no estar
   * conectada. Esa afirmación dejó de ser cierta al cablearla, y **el e2e fue lo
   * único que lo notó**: los tests de unidad montan el panel SIN agente, así que
   * seguían pasando mientras la aplicación real ya se comportaba de otra forma.
   */
  test('VERA responde desde su herramienta, nunca con el eco enlatado del shell', async ({ page }) => {
    let autorizacion: string | undefined;

    await page.route('**/functions/v1/vera', async (route) => {
      autorizacion = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'text',
              text: 'No puedo leer el contenido de los hilos: va cifrado y el servidor no tiene la clave.',
            },
          ],
        }),
      });
    });

    await page.getByLabel('Pregunta a VERA').fill('¿qué precio me han ofrecido?');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText(/va cifrado y el servidor no tiene la clave/)).toBeVisible();
    // El eco del shell aprobado sigue prohibido: es el riesgo #1 con otra cara.
    await expect(page.getByText(/Entendido\. ¿Algo más\?/)).toBeHidden();
    // Y la llamada viajó con la sesión del usuario, no anónima.
    expect(autorizacion).toMatch(/^Bearer .+/);
  });

  /**
   * La costura que de verdad importa: que una herramienta **mueva la aplicación**,
   * no que VERA diga que la ha movido. Con el cableado roto, VERA contaría que te
   * ha llevado a Hilos y la pantalla se quedaría donde estaba — el riesgo #1 en
   * su forma más difícil de ver.
   */
  test('una herramienta de VERA mueve la aplicación de verdad', async ({ page }) => {
    let vuelta = 0;

    await page.route('**/functions/v1/vera', async (route) => {
      vuelta += 1;
      const cuerpo =
        vuelta === 1
          ? {
              stop_reason: 'tool_use',
              content: [
                { type: 'tool_use', id: 'toolu_1', name: 'navegar', input: { pantalla: 'Hilos' } },
              ],
            }
          : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ya estás en Hilos.' }] };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cuerpo),
      });
    });

    await page.getByLabel('Pregunta a VERA').fill('llévame a los hilos');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText('Ya estás en Hilos.')).toBeVisible();
    // El nav se movió de verdad, y hubo dos vueltas: la herramienta y la respuesta.
    await expect(page.getByRole('button', { name: 'Hilos' }).first()).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(vuelta).toBe(2);
  });

  test('cerrar sesión vuelve al login', async ({ page }) => {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('form', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
