// Primero el entorno: este módulo lee process.env en cuanto se evalúa.
import './env';
import type { Page } from '@playwright/test';

/**
 * Credenciales de las dos cuentas de desarrollo. Entran por entorno; en CI van en
 * secrets. Nunca en el repo (CLAUDE.md §1).
 */
export const ALPHA = {
  email: process.env.E2E_ALPHA_EMAIL ?? '',
  password: process.env.E2E_ALPHA_PASSWORD ?? '',
  org: process.env.E2E_ALPHA_ORG ?? 'Rodamientos Ibéricos',
};

export const BETA = {
  email: process.env.E2E_BETA_EMAIL ?? '',
  password: process.env.E2E_BETA_PASSWORD ?? '',
  org: process.env.E2E_BETA_ORG ?? 'Nordwälz Lager',
};

export const haveCreds = !!(ALPHA.email && ALPHA.password && BETA.email && BETA.password);

/**
 * Lo que `fixture.setup.ts` necesita para reponer la siembra de demo antes de la
 * suite.
 *
 * Vive aquí y no en el propio setup porque **Playwright no deja que un fichero de
 * test importe otro fichero de test**, y los tests que dependen de la siembra
 * repuesta tienen que consultarlo para saltarse con motivo. Es la misma bandera
 * que `haveCreds` y por el mismo susto: un skip mudo hizo que la suite dijera
 * *"3 passed"* sin haber probado nada.
 *
 * ⚠ `SUPABASE_SERVICE_KEY` **no existe en la aplicación ni puede existir**: vive
 * solo en el arranque de la suite y nunca la ve el navegador (`CLAUDE.md` §1 y
 * §4). Hace falta porque reponer exige saltarse RLS —borrar filas ajenas y
 * escribir `members.public_key` de las dos cuentas—, y eso la clave publicable no
 * lo puede hacer, que es precisamente el punto de que sea publicable.
 */
export const canResetFixture = !!(
  process.env.VITE_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_KEY &&
  process.env.VITE_DEMO_KEY_SEED
);

export const ALPHA_STORAGE = '.playwright/alpha.json';

/** Contexto sin sesión, para los tests que tienen que ver el login. */
export const NO_SESSION = { cookies: [], origins: [] };

/**
 * Los dos `aside` del shell, por rol y nombre exacto. `getByLabel` casa por
 * subcadena y 'VERA' aparece en tres sitios (el panel, el botón de colapsar y el
 * textarea), así que por etiqueta no es unívoco.
 */
export const veraPanel = (page: Page) =>
  page.getByRole('complementary', { name: 'VERA', exact: true });

export const sidebar = (page: Page) =>
  page.getByRole('complementary', { name: 'Menú lateral', exact: true });

export const topNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' });

export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(who.email);
  await page.getByLabel('Contraseña').fill(who.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Se vacía la caja en cuanto el formulario la ha leído, y no es cosmético.
  // Cuando un test falla, Playwright adjunta al informe un volcado del DOM con
  // el VALOR de cada campo — y ese informe se sube como artefacto de la CI, en
  // un repositorio público. La contraseña de la cuenta de pruebas estuvo
  // descargable así. `submit()` de `Login.tsx` ya capturó el valor al pulsar,
  // así que vaciar aquí no afecta al login. Ver F-038.
  await page.getByLabel('Contraseña').fill('');
}
