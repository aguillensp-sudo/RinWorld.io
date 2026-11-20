import './env';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, BETA, canResetFixture, haveCreds, NO_SESSION, signIn, topNav } from './fixtures';
import { NORDWALZ_MIEMBRO, NORDWALZ_ORG } from '../../supabase/seed/demo-content.mjs';

/**
 * CONTRATO DE ACEPTACIÓN · el hilo de una empresa con tres pestañas, contra el Supabase real.
 *
 * Change `amend-msg-hilos-pestanas-y-etiqueta` (spec y `design.md`). Escrito por Claude Code
 * antes que la pantalla; el Coder no escribe esto (CLAUDE.md §3).
 *
 * Lo que fija para quien construya la pantalla, y nada más:
 *
 *   · `thread-body` sigue siendo el contenedor del hilo (ancla de F-135).
 *   · Tres pestañas con rol `tab`: Mensajes, Soy cliente, Soy proveedor, en ese orden, y
 *     Mensajes seleccionada al abrir.
 *   · Cada tabla es una `table` dentro de su `tabpanel`, con las nueve cabeceras de la spec
 *     en orden; cada fila es `negotiation-row`; el estado va en `badge`; las notas, en el
 *     `title` de la fila. La Fecha lleva `aria-sort="descending"` al abrir.
 *   · Cada cabecera ordena con un botón que se llama como ella; Referencia filtra con un
 *     campo `Filtrar Referencia`.
 *   · La Referencia de una fila es un botón que lleva a Mensajes filtrado por ella.
 *   · El campo de escribir (`Escribe un mensaje`) va encima de los mensajes. La etiqueta de un
 *     mensaje va en `message-tag`, sin desplegable para cambiarla (PO, 18-nov-2026).
 *   · El buscador es un `searchbox` cuyo nombre es el texto de ayuda de la spec, arriba en
 *     Mensajes (donde estaba «Sobre:», quitado por el PO el 17-nov-2026 porque lo duplicaba);
 *     sus coincidencias son `option`; el filtro activo, «Referencia: … ✕», con el botón
 *     `Quitar filtro de referencia`. Lo que se escribe va etiquetado con la referencia buscada;
 *     sin búsqueda, es conversación general.
 *   · «Ver lo que ve el servidor» es un botón de la pestaña Mensajes que abre
 *     `server-view` con todos los elementos del hilo tal como los guarda la base.
 *   · Lo que ya había en el hilo sigue: la cabecera, `Acciones del hilo`, `Crear consulta`
 *     y los formularios de oferta y contraoferta (`messages.spec.ts`, `zz-h5-negociacion.spec.ts`).
 *   · En la línea de tiempo filtrada por referencia, cada consulta u oferta es también un
 *     `thread-item`, con su línea compacta (`Oferta · 4,82 EUR · 1.250 ud.`).
 *
 * Datos: la siembra de demo (`supabase/seed/demo-content.mjs`), que `fixture.setup.ts`
 * repone al empezar. Del hilo Alpha–Nordwälz (BETA es Nordwälz):
 *   · una oferta de Nordwälz a Alpha, 6205-2RS · NSK, Pendiente, con notas;
 * y este fichero le añade una consulta de Nordwälz a Alpha, 6206-ZZ · FAG, para tener dos
 * referencias. La borra al acabar. Va antes que `zz-h5-negociacion.spec.ts`, que vacía el
 * hilo.
 */
if (process.env.CI && !haveCreds) {
  throw new Error('En CI hacen falta E2E_ALPHA_* y E2E_BETA_*. Sin ellas este contrato no prueba nada.');
}

const HILO_ALPHA_NORDWALZ = '11111111-0000-4000-8000-000000000001';
const CONSULTA_EXTRA = '12111111-0000-4000-8000-0000000000f1';
const REF_OFERTA = '6205-2RS · NSK';
const REF_CONSULTA = '6206-ZZ · FAG';
const NOTAS = 'Precio por unidad para el lote completo.';
const AYUDA_BUSCADOR =
  'Busca una referencia dentro de este hilo sobre la que quieras recuperar el contenido de la conversación';
const CABECERAS = ['Referencia', 'Cantidad', 'Precio', 'Estado', 'Fecha', 'Plazo', 'Transporte', 'Válida hasta', 'Acciones'];

// -----------------------------------------------------------------------------
// Ayudantes
// -----------------------------------------------------------------------------

function servicio() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

/** Una segunda referencia en el hilo: consulta de Nordwälz a Alpha. Su contenido no se lee. */
async function anadirConsultaExtra() {
  const { url, headers } = servicio();
  await borrarConsultaExtra();
  const res = await fetch(`${url}/rest/v1/thread_items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: CONSULTA_EXTRA,
      thread_id: HILO_ALPHA_NORDWALZ,
      sender_org_id: NORDWALZ_ORG,
      sender_member_id: NORDWALZ_MIEMBRO,
      item_type: 'CONSULTA',
      part_number: '6206-ZZ',
      brand: 'FAG',
      estado_consulta: 'Pendiente',
      content_ciphertext: `\\x${'ab'.repeat(48)}`,
      content_iv: `\\x${'07'.repeat(12)}`,
    }),
  });
  if (!res.ok) throw new Error(`No se pudo añadir la consulta extra (HTTP ${res.status}): ${await res.text()}`);
}

/** Quita la consulta extra y los mensajes que la etiquetan (la base no deja borrarla con ellos). */
async function borrarConsultaExtra() {
  const { url, headers } = servicio();
  await fetch(
    `${url}/rest/v1/thread_items?thread_id=eq.${HILO_ALPHA_NORDWALZ}&item_type=eq.MENSAJE&part_number=eq.6206-ZZ`,
    { method: 'DELETE', headers },
  );
  const res = await fetch(`${url}/rest/v1/thread_items?id=eq.${CONSULTA_EXTRA}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`No se pudo borrar la consulta extra (HTTP ${res.status}).`);
}

/** Entra en Hilos (CONVERSACIÓN) y abre el hilo con esa organización. */
async function abrirHilo(page: Page, org: string) {
  await page.goto('/');
  await topNav(page).getByRole('button', { name: 'Hilos' }).click();
  await expect(page.getByRole('listitem').first()).toBeVisible();
  await page.getByRole('button', { name: new RegExp(org) }).click();
  await expect(page.getByTestId('thread-body')).toBeVisible();
}

const pestana = (page: Page, nombre: 'Mensajes' | 'Soy cliente' | 'Soy proveedor') =>
  page.getByRole('tab', { name: nombre, exact: true });

/** Abre la pestaña y devuelve su panel. */
async function irA(page: Page, nombre: 'Mensajes' | 'Soy cliente' | 'Soy proveedor'): Promise<Locator> {
  await pestana(page, nombre).click();
  await expect(pestana(page, nombre)).toHaveAttribute('aria-selected', 'true');
  return page.getByRole('tabpanel', { name: nombre });
}

const fila = (panel: Locator, ref: string) => panel.getByTestId('negotiation-row').filter({ hasText: ref });
const escribir = (page: Page) => page.getByRole('textbox', { name: 'Escribe un mensaje' });
const buscador = (page: Page) => page.getByRole('searchbox', { name: AYUDA_BUSCADOR });
const opcionesBuscador = (page: Page) => page.getByRole('search').getByRole('option');

/** Busca una referencia en Mensajes y la elige: filtra y etiqueta lo que se escriba. */
async function buscar(page: Page, texto: string, ref: string) {
  await buscador(page).fill(texto);
  await opcionesBuscador(page).filter({ hasText: ref }).click();
  await expect(page.getByText(`Referencia: ${ref}`)).toBeVisible();
}

// -----------------------------------------------------------------------------
// thread-access-routing
// -----------------------------------------------------------------------------
test.describe('Hilos · accesos', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test('el menú se llama Hilos y lleva a CONVERSACIÓN, la lista de hilos', async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Hilos' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hilos' })).toBeVisible();
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await expect(page.getByTestId('thread-body')).toHaveCount(0);
  });

  // F-027 a (0082, PO 18-nov-2026): el Panel cuenta los hilos sin leer y abrir uno lo da por leído.
  test('sin leer: el Panel da un número, no «—», y abrir el hilo lo quita de la lista', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('threads-count')).toHaveText(/^\d+$/);
    await expect(page.getByTestId('threads-detail')).toHaveText(/^(Más reciente: .+ — .+|Todo leído)$/);

    const marcado = page.waitForResponse((r) => r.url().includes('/rpc/mark_thread_read') && r.ok());
    await abrirHilo(page, 'Nordwälz Lager');
    await marcado;

    await page.getByRole('button', { name: 'Hilos', exact: true }).first().click();
    const filaHilo = page.getByRole('button', { name: /Abrir hilo con Nordwälz Lager/ });
    await expect(filaHilo).toBeVisible();
    await expect(filaHilo.getByTestId('unread-count')).toHaveCount(0);
  });

  test('al abrir un hilo se ve la pestaña Mensajes, y las tres pestañas van en orden', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await expect(page.getByRole('tab')).toHaveText(['Mensajes', 'Soy cliente', 'Soy proveedor']);
    await expect(pestana(page, 'Mensajes')).toHaveAttribute('aria-selected', 'true');
  });

  test('Vendiendo · Ver acuerdo abre el hilo de esa empresa en Mensajes, sin pasar por la lista', async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Vendiendo' }).click();
    await page.getByRole('row').filter({ hasText: '22316-E' }).getByRole('button', { name: 'Ver acuerdo' }).click();
    await expect(page.getByTestId('thread-body')).toBeVisible();
    // La contraparte va en la cabecera, fuera de `thread-body` (mismo aserto que `messages.spec.ts`).
    await expect(page.getByRole('button', { name: 'Roulements Rhône' }).first()).toBeVisible();
    await expect(pestana(page, 'Mensajes')).toHaveAttribute('aria-selected', 'true');
    // PO, 20-nov-2026: ya filtrado por la referencia de la fila, no el hilo entero.
    await expect(page.getByText(/^Referencia: 22316-E · /)).toBeVisible();
  });
});

// -----------------------------------------------------------------------------
// thread-role-tabs y negotiation-tables-by-role
// -----------------------------------------------------------------------------
test.describe('Hilos · Soy cliente y Soy proveedor', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test('las dos tablas tienen las mismas nueve columnas, en orden, y ni Organización ni País', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    for (const nombre of ['Soy cliente', 'Soy proveedor'] as const) {
      const panel = await irA(page, nombre);
      await expect(panel.getByRole('columnheader')).toHaveText(CABECERAS);
    }
  });

  test('la oferta recibida está en Soy cliente, POR DECIDIR, con sus tres acciones; no en Soy proveedor', async ({
    page,
  }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    const cliente = await irA(page, 'Soy cliente');
    const f = fila(cliente, REF_OFERTA);
    await expect(f).toHaveCount(1);
    await expect(f.getByTestId('badge')).toHaveText('POR DECIDIR');
    await expect(f).toContainText('4,82 EUR');
    await expect(f).toContainText('1.250 ud.');
    await expect(f).toContainText('2 días');
    await expect(f.getByRole('button')).toHaveText([REF_OFERTA, 'Aceptar', 'Contra-ofertar', 'Rechazar']);
    // Las notas no son columna: van al pasar el ratón.
    await expect(f).toHaveAttribute('title', new RegExp(NOTAS.replace('.', '\\.')));

    const proveedor = await irA(page, 'Soy proveedor');
    await expect(fila(proveedor, REF_OFERTA)).toHaveCount(0);
  });

  test('una consulta enviada sin respuesta está en Soy cliente como ESPERANDO OFERTA, sin acciones', async ({
    page,
  }) => {
    await abrirHilo(page, 'Cuscinetti Padana');
    const cliente = await irA(page, 'Soy cliente');
    const f = fila(cliente, 'NU2210-E-TVP2 · INA');
    await expect(f.getByTestId('badge')).toHaveText('ESPERANDO OFERTA');
    await expect(f).toContainText('240 ud.');
    await expect(f.getByRole('button')).toHaveText(['NU2210-E-TVP2 · INA']);
  });

  test('una oferta enviada y aceptada está en Soy proveedor como ACEPTADA, sin acciones', async ({ page }) => {
    await abrirHilo(page, 'Roulements Rhône');
    const proveedor = await irA(page, 'Soy proveedor');
    const f = fila(proveedor, '22316-E · Timken');
    await expect(f.getByTestId('badge')).toHaveText('ACEPTADA');
    await expect(f).toContainText('88,50 EUR');
    await expect(f.getByRole('button')).toHaveText(['22316-E · Timken']);
    const cliente = await irA(page, 'Soy cliente');
    await expect(cliente.getByTestId('negotiation-row')).toHaveCount(0);
  });

  test('orden por Fecha al abrir, pulsar una cabecera reordena, el filtro de Referencia filtra', async ({ page }) => {
    test.skip(!canResetFixture, 'sin clave de servicio no se puede añadir la segunda referencia');
    await anadirConsultaExtra();
    try {
      await abrirHilo(page, 'Nordwälz Lager');
      const proveedor = await irA(page, 'Soy proveedor');
      // La consulta de Nordwälz a Alpha: Alpha es el proveedor y aún no ha respondido.
      const f = fila(proveedor, REF_CONSULTA);
      await expect(f.getByTestId('badge')).toHaveText('POR RESPONDER');
      await expect(f.getByRole('button')).toHaveText([REF_CONSULTA, 'Responder con oferta', 'Sin stock']);

      const cliente = await irA(page, 'Soy cliente');
      await expect(cliente.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending');
      await cliente.getByRole('button', { name: 'Referencia', exact: true }).click();
      await expect(cliente.getByRole('columnheader', { name: 'Referencia' })).toHaveAttribute('aria-sort', /ascending|descending/);

      await cliente.getByRole('textbox', { name: 'Filtrar Referencia' }).fill('NU214');
      await expect(cliente.getByTestId('negotiation-row')).toHaveCount(0);
      await cliente.getByRole('textbox', { name: 'Filtrar Referencia' }).fill('6205');
      await expect(cliente.getByTestId('negotiation-row')).toHaveCount(1);
    } finally {
      await borrarConsultaExtra();
    }
  });

  test('Beta ve la misma oferta desde el otro lado: Soy proveedor, ESPERANDO AL CLIENTE, sin acciones', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: NO_SESSION });
    const page = await ctx.newPage();
    try {
      await signIn(page, BETA);
      await topNav(page).getByRole('button', { name: 'Hilos' }).click();
      await expect(page.getByRole('listitem').first()).toBeVisible();
      await page.getByRole('button', { name: new RegExp(ALPHA.org) }).click();
      await expect(page.getByTestId('thread-body')).toBeVisible();

      const proveedor = await irA(page, 'Soy proveedor');
      const f = fila(proveedor, REF_OFERTA);
      await expect(f.getByTestId('badge')).toHaveText('ESPERANDO AL CLIENTE');
      await expect(f.getByRole('button')).toHaveText([REF_OFERTA]);
      const cliente = await irA(page, 'Soy cliente');
      await expect(fila(cliente, REF_OFERTA)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});

// -----------------------------------------------------------------------------
// Mensajes, message-reference-tag y thread-reference-search
// -----------------------------------------------------------------------------
test.describe('Hilos · Mensajes, etiqueta y búsqueda', () => {
  test.skip(!haveCreds || !canResetFixture, 'sin credenciales E2E_* o sin clave de servicio');
  test.use({ storageState: ALPHA_STORAGE });

  test('el campo de escribir va encima, y el mensaje más reciente sale el primero', async ({ page }) => {
    await abrirHilo(page, 'Łożyska Wschód');
    await irA(page, 'Mensajes');
    const nuevo = `Mensaje de orden ${Date.now()}`;
    await escribir(page).fill(nuevo);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(page.getByTestId('thread-item').first()).toContainText(nuevo, { timeout: 15_000 });

    const campo = await escribir(page).boundingBox();
    const primero = await page.getByTestId('thread-item').first().boundingBox();
    expect(campo && primero && campo.y < primero.y).toBe(true);
  });

  test('sin búsqueda, el mensaje es conversación general, buscando, lleva la referencia, sin desplegable para cambiarla', async ({
    page,
  }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await irA(page, 'Mensajes');
    await expect(page.getByRole('combobox', { name: 'Sobre:' })).toHaveCount(0);

    const general = `General ${Date.now()}`;
    await escribir(page).fill(general);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    const m1 = page.getByTestId('thread-item').filter({ hasText: general });
    await expect(m1).toBeVisible({ timeout: 15_000 });
    await expect(m1.getByTestId('message-tag')).toHaveCount(0);

    await buscar(page, '6205', REF_OFERTA);
    const texto = `Sobre la oferta ${Date.now()}`;
    await escribir(page).fill(texto);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    const mensaje = page.getByTestId('thread-item').filter({ hasText: texto });
    await expect(mensaje.getByTestId('message-tag')).toHaveText(REF_OFERTA, { timeout: 15_000 });

    // Sin desplegable para cambiarla (PO, 18-nov-2026: «no sirve para nada»).
    await expect(page.getByTestId('thread-body').getByRole('combobox')).toHaveCount(0);
  });

  test('el buscador va arriba en Mensajes, encima del campo de escribir, y no en las tablas', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await irA(page, 'Mensajes');
    const b = await buscador(page).boundingBox();
    const campo = await escribir(page).boundingBox();
    expect(b && campo && b.y < campo.y).toBe(true);
    for (const nombre of ['Soy cliente', 'Soy proveedor'] as const) {
      await irA(page, nombre);
      await expect(buscador(page)).toHaveCount(0);
    }
  });

  test('escribir desde una fila abre Mensajes filtrado por su referencia', async ({ page }) => {
    await anadirConsultaExtra();
    try {
      await abrirHilo(page, 'Nordwälz Lager');
      const cliente = await irA(page, 'Soy cliente');
      await fila(cliente, REF_OFERTA).getByRole('button', { name: REF_OFERTA }).click();
      await expect(pestana(page, 'Mensajes')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(`Referencia: ${REF_OFERTA}`)).toBeVisible();
    } finally {
      await borrarConsultaExtra();
    }
  });

  test('la otra organización ve la etiqueta',async ({ page, browser }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await buscar(page, '6205', REF_OFERTA);
    const texto = `Etiqueta ajena ${Date.now()}`;
    await escribir(page).fill(texto);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(page.getByTestId('thread-item').filter({ hasText: texto })).toBeVisible({ timeout: 15_000 });

    const ctx = await browser.newContext({ storageState: NO_SESSION });
    const beta = await ctx.newPage();
    try {
      await signIn(beta, BETA);
      await topNav(beta).getByRole('button', { name: 'Hilos' }).click();
      await expect(beta.getByRole('listitem').first()).toBeVisible();
      await beta.getByRole('button', { name: new RegExp(ALPHA.org) }).click();
      const mensaje = beta.getByTestId('thread-item').filter({ hasText: texto });
      await expect(mensaje.getByTestId('message-tag')).toHaveText(REF_OFERTA, { timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });

  test('el buscador lista coincidencias en orden alfanumérico y filtra Mensajes hasta quitar el filtro', async ({
    page,
  }) => {
    await anadirConsultaExtra();
    try {
      await abrirHilo(page, 'Nordwälz Lager');
      await irA(page, 'Mensajes');
      const general = `Conversación general ${Date.now()}`;
      await escribir(page).fill(general);
      await page.getByRole('button', { name: 'Enviar mensaje' }).click();
      await expect(page.getByTestId('thread-item').filter({ hasText: general })).toBeVisible({ timeout: 15_000 });

      // Uno etiquetado con la oferta y otro con la consulta: al filtrar por la oferta sale el primero y
      // no el segundo (PO, 17-nov: «no está filtrando los mensajes de esa etiqueta»).
      const etiquetados = [
        { ref: REF_OFERTA, filtro: '6205', texto: `Sobre la oferta ${Date.now()}` },
        { ref: REF_CONSULTA, filtro: '6206', texto: `Sobre la consulta ${Date.now()}` },
      ];
      for (const m of etiquetados) {
        await buscar(page, m.filtro, m.ref);
        await escribir(page).fill(m.texto);
        await page.getByRole('button', { name: 'Enviar mensaje' }).click();
        await expect(
          page.getByTestId('thread-item').filter({ hasText: m.texto }).getByTestId('message-tag'),
        ).toHaveText(m.ref, { timeout: 15_000 });
        await page.getByRole('button', { name: 'Quitar filtro de referencia' }).click();
      }

      await buscador(page).fill('620');
      await expect(opcionesBuscador(page)).toHaveText([REF_OFERTA, REF_CONSULTA]);
      await opcionesBuscador(page).filter({ hasText: REF_OFERTA }).click();

      await expect(page.getByText(`Referencia: ${REF_OFERTA}`)).toBeVisible();
      // La oferta de esa referencia y su mensaje salen en la línea de tiempo; el general y el de la otra
      // referencia, no.
      await expect(page.getByTestId('thread-item').filter({ hasText: '4,82 EUR' })).toHaveCount(1);
      await expect(page.getByTestId('thread-item').filter({ hasText: etiquetados[0]!.texto })).toHaveCount(1);
      await expect(page.getByTestId('thread-item').filter({ hasText: etiquetados[1]!.texto })).toHaveCount(0);
      await expect(page.getByTestId('thread-item').filter({ hasText: general })).toHaveCount(0);

      await page.getByRole('button', { name: 'Quitar filtro de referencia' }).click();
      await expect(page.getByText(`Referencia: ${REF_OFERTA}`)).toHaveCount(0);
      await expect(page.getByTestId('thread-item').filter({ hasText: general })).toHaveCount(1);
    } finally {
      await borrarConsultaExtra();
    }
  });

  test('sin coincidencias, el aviso debajo del buscador', async ({ page }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await page.getByRole('searchbox', { name: AYUDA_BUSCADOR }).fill('NU214');
    await expect(page.getByText('No hay ninguna referencia que coincida con «NU214» en este hilo')).toBeVisible();
    await expect(page.getByRole('search').getByRole('option')).toHaveCount(0);
  });

  test('«Ver lo que ve el servidor» enseña todo el hilo cifrado, y fuera del panel no baja un byte', async ({
    page,
  }) => {
    await abrirHilo(page, 'Nordwälz Lager');
    await irA(page, 'Mensajes');
    expect(await page.content()).not.toMatch(/\\x[0-9a-f]{16,}/i);

    await page.getByRole('button', { name: 'Ver lo que ve el servidor' }).click();
    const panel = page.getByTestId('server-view');
    await expect(panel).toContainText('OFERTA');
    await expect(panel).toContainText('6205-2RS');
    await expect(panel.getByText(/\\x[0-9a-f]{16,}/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Ocultar lo que ve el servidor' }).click();
    await expect(page.getByTestId('server-view')).toHaveCount(0);
  });
});
