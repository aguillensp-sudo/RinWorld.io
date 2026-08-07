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
}
