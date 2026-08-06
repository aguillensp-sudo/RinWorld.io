import { test as setup, expect } from '@playwright/test';
import { ALPHA, ALPHA_STORAGE, signIn } from './fixtures';

/**
 * Autentica UNA vez y guarda el estado, para que el resto de los tests del shell
 * no repitan login.
 *
 * Por qué existe: con seis tests haciendo login con la misma cuenta en paralelo
 * contra el mismo GoTrue, la suite fallaba de forma intermitente — pasaba
 * aislada y caía una de cada dos corridas completa. Una suite que a veces pasa
 * no sirve de puerta.
 *
 * El test de la puerta NO usa esto: abre sus dos contextos y hace dos logins de
 * verdad, porque eso es precisamente lo que tiene que demostrar.
 */
setup('autenticar como alpha', async ({ page }) => {
  await signIn(page, ALPHA);
  await expect(page.getByTestId('nav-org')).toHaveText(ALPHA.org);
  await page.context().storageState({ path: ALPHA_STORAGE });
});
