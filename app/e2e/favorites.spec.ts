import './env';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ALPHA, ALPHA_STORAGE, BETA, canResetFixture, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · favoritos desde la ficha, con confirmación · contra el Supabase real.
 *
 * Escrito por Claude Code (`Plan §6`) tras la decisión del PO del 24-oct-2026: marcar y quitar un favorito
 * pide SIEMPRE una confirmación (desde Comprando, desde la búsqueda por lotes y desde la ficha), y la ficha
 * de la propia organización no ofrece el botón.
 *
 * **Esto es lo que los tests de unidad no pueden probar, y por eso existe.** `OrganizationProfile.favoritos.test`
 * mockea `fetchFavoriteOrgIds` y `toggleFavorite`, así que pasaría entero con una RLS de `favorite_distributors`
 * que rechazara el INSERT, un trigger de recuento roto o un botón que nunca llega a la ficha montada de verdad.
 *
 * ⚠ ESTE FICHERO ESCRIBE en `favorite_distributors` (neto cero: añade y quita). Si el test se cae a mitad, el
 * `finally` borra la fila de ALPHA con la service key. Sin service key se salta con motivo a la vista.
 */
if (process.env.CI && (!haveCreds || !canResetFixture)) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_* y SUPABASE_SERVICE_KEY. Sin ellas los favoritos no se prueban contra la base y el verde no significa nada.',
  );
}

const PADANA = 'Cuscinetti Padana';

async function abrirFicha(page: Page, nombre: string) {
  await page.goto('/');
  await topNav(page).getByRole('button', { name: 'Empresas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await page.getByRole('button', { name: nombre, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
}

async function recuento(page: Page): Promise<number> {
  const texto = (await page.getByText(/^★ \d+ favoritos?$/).textContent()) ?? '';
  return Number(/\d+/.exec(texto)![0]);
}

test.describe('Favoritos · ficha con confirmación', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.skip(!canResetFixture, 'sin service key no se puede garantizar la limpieza del favorito de prueba');
  test.use({ storageState: ALPHA_STORAGE });

  test('añadir y quitar desde la ficha piden confirmación, y el recuento sube y baja', async ({ page }) => {
    const db = createClient(process.env.VITE_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_KEY ?? '', {
      auth: { persistSession: false },
    });
    try {
      await abrirFicha(page, PADANA);
      const inicial = await recuento(page);
      // Parte sin ser favorita: la siembra no deja favoritos de ALPHA.
      await expect(page.getByRole('button', { name: /Añadir a favoritos/ })).toBeVisible();

      // Añadir: el clic solo abre el diálogo; el recuento no se mueve hasta confirmar.
      await page.getByRole('button', { name: /Añadir a favoritos/ }).click();
      const dialogo = page.getByRole('dialog');
      await expect(dialogo.getByText(`¿Añadir a ${PADANA} a tus favoritos?`)).toBeVisible();
      await expect.poll(() => recuento(page)).toBe(inicial);
      await dialogo.getByRole('button', { name: 'Añadir a favoritos' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Quitar de favoritos/ })).toBeVisible();
      await expect(page.getByText(`★ ${inicial + 1} favorito${inicial + 1 === 1 ? '' : 's'}`)).toBeVisible();

      // Quitar: también con confirmación, y deja el recuento como estaba.
      await page.getByRole('button', { name: /Quitar de favoritos/ }).click();
      await expect(page.getByRole('dialog').getByText(`¿Quitar a ${PADANA} de tus favoritos?`)).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Quitar de favoritos' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Añadir a favoritos/ })).toBeVisible();
      await expect.poll(() => recuento(page)).toBe(inicial);
    } finally {
      const { data: yo } = await db.from('members').select('id').eq('email', ALPHA.email).maybeSingle();
      if (yo?.id) await db.from('favorite_distributors').delete().eq('member_id', yo.id);
    }
  });

  test('en la ficha de la propia organización no hay botón de favoritos', async ({ page }) => {
    await abrirFicha(page, ALPHA.org);
    await expect(page.getByRole('button', { name: /Contactar/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /favoritos/ })).toHaveCount(0);
  });
});

test.describe('Favoritos · «Mis favoritos» y «Favoritos recibidos» (F-280)', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.skip(!canResetFixture, 'sin service key no se puede garantizar la limpieza de los favoritos de prueba');
  test.use({ storageState: ALPHA_STORAGE });

  const cliente = () =>
    createClient(process.env.VITE_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_KEY ?? '', {
      auth: { persistSession: false },
    });

  test('Mis favoritos lista lo marcado y quitar pide confirmación', async ({ page }) => {
    const db = cliente();
    const { data: yo } = await db.from('members').select('id').eq('email', ALPHA.email).single();
    const { data: padana } = await db.from('organizations').select('id').eq('name', PADANA).single();
    try {
      await db.from('favorite_distributors').insert({ member_id: yo!.id, distributor_org_id: padana!.id });

      await page.goto('/');
      await topNav(page).getByRole('button', { name: 'Comprando' }).click();
      await page.getByRole('button', { name: 'Mis favoritos' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Mis favoritos' })).toBeVisible();
      const lista = page.getByTestId('favorites-list');
      await expect(lista.getByText(PADANA, { exact: true })).toBeVisible();

      // Quitar: el clic solo abre el diálogo.
      await page.getByRole('button', { name: `Quitar a ${PADANA} de favoritos` }).click();
      await expect(page.getByRole('dialog').getByText(`¿Quitar a ${PADANA} de tus favoritos?`)).toBeVisible();
      const { count: antes } = await db
        .from('favorite_distributors')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', yo!.id);
      expect(antes).toBe(1);
      await page.getByRole('dialog').getByRole('button', { name: 'Quitar de favoritos' }).click();
      await expect(page.getByTestId('favorites-empty')).toBeVisible();
      const { count: despues } = await db
        .from('favorite_distributors')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', yo!.id);
      expect(despues).toBe(0);
    } finally {
      await db.from('favorite_distributors').delete().eq('member_id', yo!.id);
    }
  });

  test('el Panel de la organización marcada cuenta usuarios: un número que sube con cada favorito', async ({
    page,
  }) => {
    const db = cliente();
    const { data: beta } = await db.from('members').select('id').eq('email', BETA.email).single();
    const { data: alpha } = await db.from('organizations').select('id').eq('name', ALPHA.org).single();
    try {
      await page.goto('/');
      const tarjeta = page.getByTestId('favorites-count');
      await expect(tarjeta).toHaveText(/^\d+$/); // medido: nunca el guion con sesión y función
      const inicial = Number(await tarjeta.textContent());

      await db.from('favorite_distributors').insert({ member_id: beta!.id, distributor_org_id: alpha!.id });
      await page.reload();
      await expect(page.getByTestId('favorites-count')).toHaveText(String(inicial + 1));
      await expect(page.getByText('usuarios te añadieron a favoritos este mes')).toBeVisible();
    } finally {
      await db.from('favorite_distributors').delete().eq('member_id', beta!.id).eq('distributor_org_id', alpha!.id);
    }
  });
});
