import './env';
import { expect, test, type Page } from '@playwright/test';
import {
  ALPHA,
  ALPHA_STORAGE,
  BETA,
  canResetFixture,
  haveCreds,
  NO_SESSION,
  signIn,
  topNav,
} from './fixtures';

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

test.describe('MSG-02 · un hilo real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  /**
   * Lo que los 67 tests de unidad de MSG-02 NO pueden ver, y por eso existe esto.
   * `Thread.test.tsx` mockea `fetchThreadDetail` y `fetchThreadItems`, así que
   * pasaría entero con:
   *
   *   · el embed de las dos organizaciones sin nombrar la FK — `threads` tiene
   *     TRES hacia `organizations` y saldría `PGRST201` (F-020);
   *   · la contraparte resuelta al revés, que no da error: da una cabecera
   *     plausible con mi propia organización enfrente;
   *   · el ciphertext escapándose al DOM. **Y este es nuevo de MSG-02:** a
   *     diferencia de MSG-01, aquí la consulta SÍ se trae `content_ciphertext`
   *     —es lo que hace real la costura de D-07-05—, así que por primera vez hay
   *     bytes cifrados en el navegador y hay que mirar que no lleguen a pintarse.
   */
  const abrirHilo = async (page: Page, org: string) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Hilos' }).click();
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await page.getByRole('button', { name: new RegExp(org) }).click();
  };

  test('la cabecera resuelve la contraparte, y no soy yo', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');

    // ⚠ SE MIRA EL ENLACE DE LA CABECERA, NO LA PÁGINA ENTERA, y la primera
    // versión de este test miraba la página: `ALPHA.org` sale **dos veces en el
    // shell** —la barra de nav y el pie del sidebar llevan la organización del
    // usuario— y además sale, legítimamente, como autor de cada elemento que yo
    // mandé. Un `toHaveCount(0)` global aquí no mide la contraparte: mide el
    // shell. Es la misma forma que los dos asertos sin ámbito de la revisión a
    // mano de hoy (F-059).
    const enlaceOrg = page.getByRole('button', { name: 'Nordwälz Lager' });
    await expect(enlaceOrg).toBeVisible();
    await expect(enlaceOrg).not.toHaveText(ALPHA.org);

    // El badge de país es el ISO de dos letras (§3), no "Alemania" como el mock.
    await expect(page.getByText('Alemania', { exact: true })).toHaveCount(0);
  });

  test('⚠ el historial trae elementos y NO se escapa un byte cifrado al DOM', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await expect(page.getByTestId('thread-item').first()).toBeVisible();

    // ANCLA · el contenido se descifra de verdad. Sin esto, los dos asertos de
    // abajo los cumpliría una pantalla que no pinta nada — que es exactamente lo
    // que pasaba hasta el día 7, y por eso este test decía otra cosa.
    // El texto sale del blob cifrado: no existe en ninguna columna en claro.
    await expect(page.getByText('Precio por unidad para el lote completo.')).toBeVisible();
    await expect(page.getByText(/4,82\s?€\/ud\./)).toBeVisible();

    const html = await page.content();
    // El blob viaja como cadena hex `\x…` por PostgREST. Que el contenido se lea
    // ARRIBA y el ciphertext no aparezca por ningún lado es la frontera del
    // zero-knowledge mirada desde donde se ve de verdad — y es la pareja de
    // pantallas que el panel de vista-servidor del día 11 tiene que enseñar.
    expect(html).not.toContain('content_ciphertext');
    expect(html).not.toMatch(/\\x[0-9a-f]{16,}/i);
    // Y la CEK envuelta tampoco baja al DOM, aunque la consulta sí la traiga.
    expect(html).not.toContain('wrapped_cek');
  });

  test('con la clave de la sesión NO se pinta el indicador de cifrado, y sigue sin haber botón', async ({
    page,
  }) => {
    /**
     * ⚠ ESTE TEST DECÍA LO CONTRARIO HASTA EL DÍA 8, Y QUE SE CAYERA ERA LA SEÑAL.
     *
     * Afirmaba *"sin passphrase se pinta el indicador de la capability"*, y era
     * cierto mientras `decryptItem` devolviera `null` siempre (D-07-05). Con la
     * rebanada E2EE y las claves deterministas de la demo (D-08-01 a), el
     * contenido se abre y el indicador desaparece — que es justo lo que el socio
     * tiene que ver el día 11.
     *
     * La rama opaca NO deja de existir ni deja de estar probada: se recorre en
     * cuanto no hay clave para un elemento (otra sesión, claves aleatorias) y la
     * cubren cinco asertos de `thread-detail.test.ts`. Lo que no se puede es
     * ejercitarla aquí con la semilla de demo puesta, y decir lo contrario sería
     * un aserto que no mide lo que dice.
     */
    await abrirHilo(page, 'Nordwälz Lager');
    await expect(page.getByText('Precio por unidad para el lote completo.')).toBeVisible(); // ancla
    await expect(
      page.getByText('Contenido cifrado — introduce tu frase de seguridad para ver'),
    ).toHaveCount(0);
    // F-027 sigue en pie: no hay recuperación de claves que prometer, ni después
    // de la rebanada. Las claves siguen viviendo en memoria de sesión.
    await expect(page.getByRole('button', { name: /frase de seguridad/i })).toHaveCount(0);
  });

  test('`Marcar acuerdo alcanzado` está deshabilitado y dice por qué (D-07-04)', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await page.getByRole('button', { name: 'Acciones del hilo' }).click();
    await expect(page.getByRole('button', { name: 'Marcar acuerdo alcanzado' })).toBeDisabled();
    await expect(page.getByText('El acuerdo se alcanza aceptando una oferta.')).toBeVisible();
  });

  test('⚠ el campo de mensaje SIGUE en un hilo CERRADO SIN ACUERDO (D-07-01)', async ({ page }) => {
    // La desviación obligatoria de MSG-02 contra su §6, contra el hilo cerrado
    // que la siembra tiene con Anadolu Rulman. Si el campo desapareciera, nadie
    // podría volver a escribir y la reapertura de 0009 no ocurriría nunca.
    await abrirHilo(page, 'Anadolu Rulman');
    await expect(page.getByText('CERRADO SIN ACUERDO', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Escribe un mensaje' })).toBeVisible();
  });

  test('el breadcrumb vuelve a la lista', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await page.getByRole('button', { name: 'Hilos' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hilos' })).toBeVisible();
  });

  test('⚠ D-08-02 · se envía cifrado, se lee descifrado, y el hilo cerrado SE REABRE', async ({
    page,
  }) => {
    /**
     * ⚠ ESTE ES EL ÚNICO TEST QUE RECORRE LA REBANADA E2EE ENTERA, Y HASTA HOY NO
     * SE PODÍA ESCRIBIR.
     *
     * Enviar mueve el hilo al principio de la lista y cambia la vista previa de
     * MSG-01, así que rompía otros dos tests de este mismo fichero: la suite no
     * sabía reponer la siembra y un test así solo pasaba la primera vez. Lo que
     * faltaba no era el test — era `fixture.setup.ts`.
     *
     * Lo que se recorre de punta a punta, y **ningún test de unidad alcanza**:
     * generar una CEK, envolverla para los dos miembros con la pública que
     * `thread_public_keys` (0012) devuelve, cifrar, escribir elemento y claves en
     * UNA transacción (`create_thread_item`), volver a leer, desenvolver y
     * descifrar. Si cualquiera de esos ocho pasos falla, el texto no aparece.
     *
     * Y de propina cierra D-07-01: **escribir en un hilo cerrado lo reabre**
     * (`0009`), que es exactamente el argumento con el que D-08-02 metió el envío
     * en el día 8. Hasta hoy eso solo lo sostenían dos asertos de SQL.
     */
    test.skip(!canResetFixture, 'sin SUPABASE_SERVICE_KEY no hay siembra repuesta que reabrir');

    await abrirHilo(page, 'Anadolu Rulman');

    // ANCLA 1 · el hilo empieza cerrado. Sin esto, "se reabrió" no significa nada.
    await expect(page.getByText('CERRADO SIN ACUERDO', { exact: true }).first()).toBeVisible();

    // Un texto único por corrida: si el historial trajera uno viejo, el aserto de
    // abajo pasaría sin haber enviado nada.
    const texto = `Retomamos esto. Referencia de prueba ${Date.now()}`;

    await page.getByRole('textbox', { name: 'Escribe un mensaje' }).fill(texto);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    // ANCLA 2 · el mensaje se lee EN CLARO. Salió cifrado y ha vuelto descifrado:
    // es la costura de D-07-05 recorrida en la dirección que faltaba.
    await expect(page.getByText(texto)).toBeVisible({ timeout: 15_000 });

    // Y el campo se vació, que es la señal de que el envío salió bien y no de que
    // se perdió el texto: el pie solo lo vacía cuando `onSend` devuelve true.
    await expect(page.getByRole('textbox', { name: 'Escribe un mensaje' })).toHaveValue('');

    // LO QUE DE VERDAD PRUEBA ESTE TEST · el trigger de 0009 reabrió el hilo, y
    // la cabecera se enteró porque `handleSend` vuelve a leer. El estado lo
    // deriva la base, no el cliente (F-044).
    await expect(page.getByText('CERRADO SIN ACUERDO', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ABIERTO', { exact: true }).first()).toBeVisible();

    // Y el ciphertext sigue sin bajar al DOM, ahora también en el camino de
    // escritura.
    const html = await page.content();
    expect(html).not.toContain('content_ciphertext');
    expect(html).not.toContain('wrapped_cek');
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
