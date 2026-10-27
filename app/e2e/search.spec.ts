import './env';
import { expect, test, type Page } from '@playwright/test';
import { abrirComprando, ALPHA, ALPHA_STORAGE, buscarReferencia, haveCreds, verOfertasDeTodas } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-01 en dos fases · contra el Supabase real.
 *
 * Reescrito el 26-oct-2026 por Claude Code para la búsqueda en dos fases (`amend-srch01-busqueda-en-dos-fases`):
 * lista previa de claves normalizadas → el usuario elige → tabla de ofertas paginada. La versión anterior
 * probaba la pantalla de una sola tabla (`SearchResults`), retirada el 25-oct-2026.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.** `PartSearch.test.tsx` mockea
 * `fetchPartKeys` y `fetchOffers`, así que pasaría entero con:
 *
 *   · unas RPC (`search_part_keys`, `search_offers`, `0076`) que se olvidaran de `app.current_org_id()`: la
 *     pantalla me enseñaría MI PROPIO inventario entre los proveedores, y ALPHA tiene `6205-2RS` publicada;
 *   · una zona que no corta: Anadolu Rulman lleva `continent = 'AS'` justamente para que "Europa" la deje fuera
 *     (`guion-demo-y-siembra.md` §3). Un filtro que no filtra devuelve resultados de más y parece correcto;
 *   · una `part_key` que no funde grafías: `32011-X` (Nordwälz) y `32011X` (Łożyska) son la misma clave;
 *   · un recorte del caso 1.3 que no llegara a la base.
 *
 * Igual que en el resto de e2e (F-015): si faltan credenciales en CI, esto es un error duro. Un test que se
 * salta la puerta y dice "passed" es peor que no tenerlo.
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas SRCH-01 no se prueba contra la base y el verde no significa nada.',
  );
}

/** Los fabricantes del bloque "Datos de ejemplo" de la spec §3. Son inventados
 *  para el mock, no distribuidoras del catálogo sembrado: si aparecen en
 *  pantalla, SRCH-01 está pintando el HTML aprobado en vez de la base. */
const INVENTADAS = [
  'SKF Nordic AB',
  'Schaeffler Iberia SL',
  'NSK Europe Ltd',
  'NTN-SNR Roulements',
  'Timken Europe GmbH',
];

/** La referencia con más ofertas de la siembra, y que ALPHA también publica. */
const CON_STOCK = '6205-2RS';

/** La columna 6 de todas las filas visibles. */
async function empresas(page: Page): Promise<string[]> {
  const filas = page.getByRole('row');
  const n = await filas.count();
  const out: string[] = [];
  // La 0 es la cabecera.
  for (let i = 1; i < n; i++) {
    out.push(((await filas.nth(i).getByRole('cell').nth(5).textContent()) ?? '').trim());
  }
  return out;
}

test.describe('SRCH-01 · tabla de ofertas real', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await abrirComprando(page);
    await buscarReferencia(page, CON_STOCK);
    await verOfertasDeTodas(page);
  });

  test('pinta stock de la base, no los datos de ejemplo del mock', async ({ page }) => {
    expect(await page.getByRole('row').count()).toBeGreaterThan(1);
    for (const inventada of INVENTADAS) {
      await expect(page.getByText(inventada, { exact: true })).toHaveCount(0);
    }
  });

  test('NUNCA enseña mi propio inventario: no me compro a mí mismo', async ({ page }) => {
    // El invariante de la pantalla, y ALPHA publica dos líneas de 6205-2RS: si las RPC no excluyeran la
    // organización propia, saldrían aquí.
    const vistas = await empresas(page);
    expect(vistas.length).toBeGreaterThan(0);
    expect(vistas).not.toContain(ALPHA.org);
  });

  test('la columna Empresa viene resuelta: ni un guion en toda la tabla', async ({ page }) => {
    const vistas = await empresas(page);
    for (const e of vistas) {
      expect(e).not.toBe('—');
      expect(e.length).toBeGreaterThan(0);
    }
  });

  test('el País sale con nombre completo, nunca el código ISO', async ({ page }) => {
    const paises = page.getByRole('row').nth(1).getByRole('cell').nth(6);
    const texto = ((await paises.textContent()) ?? '').trim();
    expect(texto).not.toMatch(/^[A-Z]{2}$/);
    expect(texto.length).toBeGreaterThan(2);
  });

  test('no hay ninguna columna ni celda de precio', async ({ page }) => {
    // `unit_price` va cifrado E2EE y no se indexa: una cifra de precio aquí sería
    // la ruptura del zero-knowledge, que es el argumento entero del producto.
    await expect(page.getByRole('columnheader', { name: /precio/i })).toHaveCount(0);
    await expect(page.getByText('€')).toHaveCount(0);
  });

  test('todas las filas son de la referencia buscada', async ({ page }) => {
    const filas = page.getByRole('row');
    const n = await filas.count();
    for (let i = 1; i < n; i++) {
      await expect(filas.nth(i).getByRole('cell').nth(1)).toContainText(CON_STOCK);
    }
  });
});

test.describe('SRCH-01 · lista previa y filtros contra la base', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => abrirComprando(page));

  test('la lista previa enseña la clave normalizada, escriba como escriba el usuario', async ({ page }) => {
    // Espacios y minúsculas: la clave es la misma que la de «6205-2RS».
    const lista = await buscarReferencia(page, '6205 2rs');
    await expect(lista.getByRole('checkbox', { name: /^62052RS\b/ })).toBeVisible();
    // Ninguna celda con la grafía de un distribuidor (`design.md` §6).
    await expect(lista.getByText('6205-2RS')).toHaveCount(0);
  });

  /*
   * Con zona por defecto (Europa, el continente de ALPHA) Anadolu no sale; quitando la zona, sí. Las dos
   * mitades juntas: la primera sola la pasa una búsqueda que no traiga nunca a Anadolu.
   */
  test('la zona por defecto (Europa) deja fuera a la distribuidora turca, y sin zona aparece', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Quitar filtro Zona' })).toBeVisible();
    await buscarReferencia(page, CON_STOCK);
    await verOfertasDeTodas(page);
    await expect(page.getByText('Anadolu Rulman')).toHaveCount(0);

    await page.getByRole('button', { name: '‹ Volver a la lista de referencias' }).click();
    await buscarReferencia(page, CON_STOCK, { zona: 'Cualquiera' });
    await verOfertasDeTodas(page);
    await expect(page.getByText('Anadolu Rulman').first()).toBeVisible();
  });

  /**
   * El catálogo sembrado tiene tres líneas que casan con `32011X`:
   *
   *   32011-X · SKF · PUBLISHED · Nordwälz Lager  (EU)
   *   32011X  · NTN · ARCHIVED  · Anadolu Rulman  (AS)
   *   32011X  · NSK · PUBLISHED · Łożyska Wschód  (EU)
   *
   * Sin zona, para que el corte de Anadolu no lo haga el continente. Prueba a la vez que `status` corta y que
   * las dos grafías publicadas son UNA clave: esperar cero filas lo pasaría también una búsqueda rota.
   */
  test('no trae líneas que no estén publicadas, y funde 32011-X con 32011X', async ({ page }) => {
    const lista = await buscarReferencia(page, '32011X', { zona: 'Cualquiera' });
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    await verOfertasDeTodas(page);

    await expect(page.getByText('Łożyska Wschód')).toBeVisible();
    await expect(page.getByText('Nordwälz Lager')).toBeVisible();
    await expect(page.getByText('Anadolu Rulman')).toHaveCount(0);
  });

  /*
   * «Contiene»: «2RS» no es el principio de ninguna referencia que acabe en 2RS, pero sí está dentro de
   * `62052RS`. Las dos mitades juntas: la segunda sola la pasa un «contiene» que siempre está activo.
   */
  test('«Contiene» casa en cualquier parte de la clave; sin él, solo por el principio', async ({ page }) => {
    const sinContiene = await buscarReferencia(page, '2RS', { zona: 'Cualquiera', contiene: false });
    await expect(sinContiene.getByRole('checkbox', { name: /^62052RS\b/ })).toHaveCount(0);

    const conContiene = await buscarReferencia(page, '2RS', { contiene: true });
    await expect(conContiene.getByRole('checkbox', { name: /^62052RS\b/ })).toBeVisible();
  });

  test('se pueden elegir claves sueltas y solo se piden las ofertas de esas', async ({ page }) => {
    const lista = await buscarReferencia(page, '6', { zona: 'Cualquiera' });
    const casillas = lista.getByRole('checkbox');
    expect(await casillas.count()).toBeGreaterThanOrEqual(2);

    await expect(page.getByRole('button', { name: /^Ver ofertas de las seleccionadas \(0\)/ })).toBeDisabled();
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    const ver = page.getByRole('button', { name: /^Ver ofertas de las seleccionadas \(2\)/ });
    await expect(ver).toBeEnabled();
    await ver.click();

    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await expect(page.getByText(/ofertas? de 2 referencias/)).toBeVisible();

    // Al volver, la selección sigue marcada.
    await page.getByRole('button', { name: '‹ Volver a la lista de referencias' }).click();
    await expect(page.getByRole('list', { name: 'Referencias encontradas' }).getByRole('checkbox', { checked: true })).toHaveCount(2);
  });

  test('la tabla de ofertas se pagina: siguiente y anterior', async ({ page }) => {
    // El prefijo «6» da más de 50 ofertas (dos páginas); la lista previa de la siembra no llega a 60 claves.
    await buscarReferencia(page, '6', { zona: 'Cualquiera' });
    await verOfertasDeTodas(page);

    const pager = page.getByRole('navigation', { name: 'Páginas de ofertas' });
    await expect(pager.getByText(/^Página 1 de \d+$/)).toBeVisible();
    await expect(pager.getByRole('button', { name: /Anterior/ })).toBeDisabled();

    await pager.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(pager.getByText(/^Página 2 de \d+$/)).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    await pager.getByRole('button', { name: /Anterior/ }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(pager.getByText(/^Página 1 de \d+$/)).toBeVisible();
  });

  test('caso 1.3: sin coincidencia exacta recorta por el final y lo avisa', async ({ page }) => {
    const lista = await buscarReferencia(page, '6205-2RSXYZ');
    await expect(
      page.getByText('No hay ninguna referencia que empiece por «62052RSXYZ». Se muestran las que empiezan por «62052RS».'),
    ).toBeVisible();
    await expect(lista.getByRole('checkbox', { name: /^62052RS\b/ })).toBeVisible();
  });

  test('caso 1.4: sin ninguna coincidencia sale el aviso, y el watcher no promete nada', async ({ page }) => {
    await buscarReferencia(page, 'ZZ-NO-EXISTE-9999');
    await expect(page.getByText('No hay coincidencias para «ZZNOEXISTE9999».')).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear watcher/i })).toBeDisabled();
    await expect(page.getByText(/te avisaremos/i)).toHaveCount(0);
  });
});

/**
 * F-088 · LO QUE NO CABE TIENE QUE PODER DESPLAZARSE, Y ESTO SOLO SE VE EN NAVEGADOR.
 *
 * jsdom no calcula layout: los tests de unidad encuentran todas las filas aunque en un navegador de verdad la
 * mitad quede fuera de un contenedor recortado. De ahí el viewport bajo a propósito. Álvaro lo encontró dos
 * veces: en la tabla vieja (sesión 1) y en la lista previa nueva (25-oct-2026, sin scroll ni paginador visible).
 *
 * ⚠ No vale `scrollIntoViewIfNeeded()` + `toBeInViewport()`: `overflow: hidden` sigue siendo un contenedor de
 * scroll por script, así que Playwright llegaría donde una persona no puede. Se comprueba la CADENA DE
 * CONTENEDORES en sus dos mitades:
 *
 *   · negativa — ningún ancestro recorta con `overflow: hidden` contenido que le desborda;
 *   · positiva — y alguno desborda con `auto`/`scroll`: el scroll existe y no es que todo quepa.
 */
async function cadenaDeScroll(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const ultima = document.querySelector(sel);
    if (!ultima) return { error: 'sin elementos', recortan: [] as string[], desplazables: [] as string[] };
    const recortan: string[] = [];
    const desplazables: string[] = [];
    let el: Element | null = ultima;
    while (el) {
      const h = el as HTMLElement;
      const overflowY = getComputedStyle(h).overflowY;
      // +1 de tolerancia: los redondeos subpíxel no son desbordamiento de nada.
      if (h.scrollHeight > h.clientHeight + 1) {
        const nombre = `${el.tagName}.${String(el.className).slice(0, 30)}`;
        if (overflowY === 'hidden') recortan.push(nombre);
        if (overflowY === 'auto' || overflowY === 'scroll') desplazables.push(nombre);
      }
      el = el.parentElement;
    }
    return { error: null, recortan, desplazables };
  }, selector);
}

test.describe('SRCH-01 · todo se puede desplazar en una ventana baja (F-088)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE, viewport: { width: 1280, height: 480 } });

  test.beforeEach(async ({ page }) => abrirComprando(page));

  test('la lista previa: ninguna celda queda recortada sin cómo llegar a ella', async ({ page }) => {
    // Prefijo «6» y sin zona: unas treinta claves, ocho filas de rejilla en 480px.
    const lista = await buscarReferencia(page, '6', { zona: 'Cualquiera' });
    expect(await lista.getByRole('listitem').count()).toBeGreaterThan(20);

    const cadena = await cadenaDeScroll(page, 'ul[aria-label="Referencias encontradas"] > li:last-child');
    expect(cadena.error).toBeNull();
    expect(cadena.recortan).toEqual([]);
    expect(cadena.desplazables.length).toBeGreaterThan(0);
  });

  test('la tabla de ofertas: ninguna fila queda recortada sin cómo llegar a ella', async ({ page }) => {
    await buscarReferencia(page, '6');
    await verOfertasDeTodas(page);
    // Con 480px de alto tiene que sobrar tabla; si no sobrara, este test no probaría nada.
    expect(await page.getByRole('row').count()).toBeGreaterThan(20);

    const cadena = await cadenaDeScroll(page, 'tbody tr:last-child');
    expect(cadena.error).toBeNull();
    expect(cadena.recortan).toEqual([]);
    expect(cadena.desplazables.length).toBeGreaterThan(0);
  });
});
