import './env';
import { expect, test } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-01 · contra el Supabase real.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.**
 * `SearchResults.test.tsx` mockea `fetchResults`, así que pasaría entero con:
 *
 *   · una consulta sin `.neq('org_id', …)` — y `inventory_lines` tiene DOS
 *     políticas de lectura permisivas que se suman, así que la pantalla me
 *     enseñaría MI PROPIO inventario entre los proveedores. No falla nada: sale
 *     una tabla plausible donde me estoy comprando a mí mismo;
 *   · un embed sin la clave ajena nombrada, o un `!inner` contra una tabla que
 *     RLS no deja leer — la columna Empresa saldría a "—" en todas las filas, o
 *     la tabla saldría vacía sin error (F-020);
 *   · un chip de zona que no corta: Anadolu Rulman lleva `continent = 'AS'`
 *     justamente para que "Europa" la deje fuera (`guion-demo-y-siembra.md` §3).
 *     Un filtro que no filtra devuelve resultados de más y parece correcto.
 *
 * Igual que en el resto de e2e (F-015): si faltan credenciales en CI, esto es un
 * error duro. Un test que se salta la puerta y dice "passed" es peor que no
 * tenerlo.
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

/** La columna 6 de todas las filas visibles. */
async function empresas(page: import('@playwright/test').Page): Promise<string[]> {
  const filas = page.getByRole('row');
  const n = await filas.count();
  const out: string[] = [];
  // La 0 es la cabecera.
  for (let i = 1; i < n; i++) {
    out.push(((await filas.nth(i).getByRole('cell').nth(5).textContent()) ?? '').trim());
  }
  return out;
}

test.describe('SRCH-01 · resultados reales', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Comprando' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
    // Se espera a la tabla, no solo al título: leer filas antes de que llegue la
    // consulta encuentra cero y falla por carrera, no por defecto.
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('pinta stock de la base, no los datos de ejemplo del mock', async ({ page }) => {
    expect(await page.getByRole('row').count()).toBeGreaterThan(1);
    for (const inventada of INVENTADAS) {
      await expect(page.getByText(inventada, { exact: true })).toHaveCount(0);
    }
  });

  test('NUNCA enseña mi propio inventario: no me compro a mí mismo', async ({ page }) => {
    // El invariante de la pantalla. Es el espejo del `.eq('org_id')` de INV-01 y
    // la única forma de cazarlo es esta.
    const vistas = await empresas(page);
    expect(vistas.length).toBeGreaterThan(0);
    expect(vistas).not.toContain(ALPHA.org);
  });

  test('la columna Empresa viene resuelta: ni un guion en toda la tabla', async ({ page }) => {
    // Un "—" en todas las filas es la firma de un embed roto (F-020) o de un
    // `!inner` contra una tabla que RLS esconde. Con la pantalla en blanco se ve;
    // con una columna a guiones, no.
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

  /**
   * ⚠ LOS DOS BOTONES DE ESTE FORMULARIO SE BUSCAN CON CUIDADO, Y NO ES CELO.
   *
   * `FilterChips.tsx` pone `aria-label="Añadir filtro"` al botón que **abre** el
   * formulario, y el que lo **envía** dice `Añadir`. Un `aria-label` tapa el texto
   * interno, así que el visible `+ Filtro` no es el nombre accesible de nada.
   *
   * Y en Playwright el `name` en cadena casa **por subcadena** e insensible a
   * mayúsculas — al revés que Testing Library, que casa exacto —, de modo que
   * `'Añadir'` a secas resuelve a los DOS botones y aborta por strict mode. De ahí
   * el `exact: true` en el submit: es obligatorio, no estilo.
   *
   * Los dos defectos estaban aquí desde el día 6 y ninguno se vio, porque la suite
   * no arrancaba (F-050). El primero era `/Filtro/` con mayúscula, que no casaba
   * con nada; arreglarlo destapó el segundo tres líneas más abajo. Es F-048 otra
   * vez y el corolario de F-052: **una suite que no corre deja de cubrirse a sí
   * misma.**
   */
  test('el chip de zona Europa deja fuera a la distribuidora turca', async ({ page }) => {
    // `guion-demo-y-siembra.md` §3: Anadolu Rulman lleva `continent = 'AS'` por el
    // geoscheme de la ONU, precisamente para que este chip corte.
    await page.getByRole('button', { name: 'Añadir filtro' }).click();
    await page.getByLabel('Campo').selectOption('Zona');
    await page.getByLabel('Valor').selectOption('Europa');
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();

    await expect(page.getByText('Anadolu Rulman')).toHaveCount(0);
    // Y sigue habiendo resultados: el chip filtra, no vacía la tabla.
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('el chip de referencia filtra de verdad contra la base', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir filtro' }).click();
    await page.getByLabel('Campo').selectOption('Ref');
    await page.getByLabel('Valor').fill('6205-2RS');
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();

    await expect(page.getByRole('row').nth(1)).toBeVisible();
    const filas = page.getByRole('row');
    const n = await filas.count();
    for (let i = 1; i < n; i++) {
      await expect(filas.nth(i).getByRole('cell').nth(1)).toContainText('6205-2RS');
    }
  });

  /**
   * ⚠ ESTE TEST PEDÍA EL ESTADO VACÍO Y SU PREMISA ERA FALSA. Decía: *"la
   * referencia 32011X de Anadolu está ARCHIVED"*, y filtraba por `32011X`
   * esperando cero filas. Pero el catálogo sembrado tiene **tres** referencias que
   * casan con `32011`, no una:
   *
   *   32011-X · SKF · PUBLISHED · Nordwälz Lager  (EU)
   *   32011X  · NTN · ARCHIVED  · Anadolu Rulman  (AS)   <- la que el test conocía
   *   32011X  · NSK · PUBLISHED · Łożyska Wschód  (EU)   <- la que no
   *
   * Así que `32011X` devuelve UNA fila legítima y el estado vacío no llega nunca.
   *
   * Y el test era **débil** además de falso: esperar cero filas también lo pasa una
   * búsqueda rota que no devuelva nada jamás. Con una referencia publicada y otra
   * archivada compartiendo literal, se puede probar lo que el nombre promete —que
   * el filtro de `status` corta— **y** que la búsqueda sigue trayendo lo que debe.
   * Ese par de assertions juntos no los pasa ninguna de las dos averías.
   *
   * El estado vacío se prueba aparte, abajo, con una referencia que no existe.
   */
  test('no trae líneas que no estén publicadas', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir filtro' }).click();
    await page.getByLabel('Campo').selectOption('Ref');
    await page.getByLabel('Valor').fill('32011X');
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();

    // La PUBLISHED de Łożyska sí sale: la búsqueda no está simplemente rota.
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    // Y la ARCHIVED de Anadolu no aparece, que es el invariante.
    await expect(page.getByText('Anadolu Rulman')).toHaveCount(0);
  });

  test('sin resultados sale el estado vacío, no una tabla en blanco', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir filtro' }).click();
    await page.getByLabel('Campo').selectOption('Ref');
    await page.getByLabel('Valor').fill('ZZ-NO-EXISTE-9999');
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();

    await expect(page.getByText('No hemos encontrado stock con estos filtros.')).toBeVisible();
  });

  test('el watcher no promete nada: deshabilitado y sin toast', async ({ page }) => {
    const boton = page.getByRole('button', { name: /watcher/i });
    await expect(boton).toBeDisabled();
    await expect(page.getByText(/te avisaremos/i)).toHaveCount(0);
  });
});

/**
 * F-088 · LA TABLA TIENE QUE PODER DESPLAZARSE, Y ESTO SOLO SE VE EN NAVEGADOR.
 *
 * Ningún test de unidad puede cazarlo: jsdom no calcula layout, así que
 * `SearchResults.test.tsx` pinta las 200 filas y las encuentra todas aunque en
 * un navegador de verdad la mitad quede fuera del contenedor recortado. Ningún
 * check del arnés lo mira tampoco —C2 mira comportamiento, C3 color, C4 es
 * mecánico—, y el resto de e2e corre en el viewport por defecto, que es lo
 * bastante alto como para que el desbordamiento no llegue a ocurrir.
 *
 * De ahí el viewport bajo a propósito: es la única forma de que el defecto
 * exista dentro del test. Álvaro lo encontró en la sesión 1 con una ventana
 * normal y "Seleccionar todos", sin saber si había más filas debajo.
 *
 * El aserto es "la última fila se puede llegar a ver", no "existe un elemento
 * con overflow": lo segundo lo pasa cualquier `overflow-y: auto` puesto en el
 * sitio equivocado.
 */
test.describe('SRCH-01 · la tabla se desplaza en una ventana baja (F-088)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE, viewport: { width: 1280, height: 480 } });

  /**
   * ⚠ EL PRIMER INTENTO DE ESTE TEST PASABA CON EL DEFECTO PUESTO, Y LA RAZÓN
   * MERECE QUEDAR ESCRITA.
   *
   * Decía `scrollIntoViewIfNeeded()` y luego `toBeInViewport()`, que es lo que
   * uno escribe sin pensarlo. Pero **`overflow: hidden` sigue siendo un
   * contenedor de scroll**: lo que quita es la barra y el gesto del usuario, no
   * la capacidad de desplazarlo por script. Así que Playwright desplazaba
   * `.bwcnt` a mano, la fila entraba en el viewport y el aserto se ponía verde
   * sobre contenido al que una persona no puede llegar de ninguna manera.
   *
   * Medido con el defecto puesto: `.page` ocupa 11521px dentro de un `.bwcnt` de
   * 384px, y la última de las 186 filas cae a y=11555. Nada en la cadena tiene
   * `overflow-y: auto`.
   *
   * De ahí que lo que se compruebe sea la CADENA DE CONTENEDORES, que es lo que
   * el hallazgo nombra, y en sus dos mitades:
   *
   *   · negativa — ningún ancestro puede estar recortando con `overflow: hidden`
   *     contenido que le desborda: eso es contenido inalcanzable, por definición;
   *   · positiva — y alguno tiene que desbordar con `auto`/`scroll`, o sea, el
   *     scroll existe de verdad y no es que la tabla quepa entera.
   *
   * Las dos juntas: la primera sola la pasaría una tabla que cupiera en pantalla,
   * y la segunda sola no dice nada de lo que se recorta más arriba.
   */
  test('ningún contenedor recorta filas sin dejar cómo llegar a ellas', async ({ page }) => {
    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Comprando' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    // Con 480px de alto tiene que sobrar tabla; si no sobrara, este test no
    // estaría probando nada y hay que enterarse.
    expect(await page.getByRole('row').count()).toBeGreaterThan(20);

    const cadena = await page.evaluate(() => {
      const ultima = document.querySelector('tbody tr:last-child');
      if (!ultima) return { error: 'sin filas', recortan: [], desplazables: [] };
      const recortan: string[] = [];
      const desplazables: string[] = [];
      let el: Element | null = ultima;
      while (el) {
        const h = el as HTMLElement;
        const overflowY = getComputedStyle(h).overflowY;
        // +1 de tolerancia: los redondeos subpíxel del navegador producen
        // diferencias de una unidad que no son desbordamiento de nada.
        if (h.scrollHeight > h.clientHeight + 1) {
          const nombre = `${el.tagName}.${String(el.className).slice(0, 30)}`;
          if (overflowY === 'hidden') recortan.push(nombre);
          if (overflowY === 'auto' || overflowY === 'scroll') desplazables.push(nombre);
        }
        el = el.parentElement;
      }
      return { error: null, recortan, desplazables };
    });

    expect(cadena.error).toBeNull();
    expect(cadena.recortan).toEqual([]);
    expect(cadena.desplazables.length).toBeGreaterThan(0);
  });
});
