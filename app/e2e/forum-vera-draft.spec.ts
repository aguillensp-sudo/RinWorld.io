import './env';
import { expect, test } from '@playwright/test';
import { ALPHA_STORAGE, haveCreds, topNav } from './fixtures';

/**
 * CONTRATO DE ACEPTACIÓN · community-forum/vera-drafting-and-summary#1 · creación de hilo asistida por VERA.
 *
 * Escrito por Claude Code. El Coder no lo ve. Cubre lo que `vera-tools.foro.test.ts` no puede: que el
 * borrador llega al formulario real de «Nuevo hilo», que la herramienta le dice a VERA que NO está publicado,
 * y que el hilo no existe en la base hasta que el usuario pulsa «Publicar hilo».
 *
 * ⚠ EL MODELO ESTÁ INTERCEPTADO, Y ES A PROPÓSITO. El proxy `/functions/v1/vera` se responde desde el test:
 * primer turno, un `tool_use` de `preparar_hilo_foro` con título y cuerpo fijos; segundo turno, una frase.
 * Esto prueba la interfaz y la regla «no se publica solo», NO que Sonnet decida llamar a la herramienta ni
 * que resuma solo a petición: eso necesita una llamada real, con el visto bueno del PO (`CLAUDE.md` §5).
 * No gasta nada y no escribe en la base: el test nunca pulsa «Publicar hilo».
 */
if (process.env.CI && !haveCreds) {
  throw new Error(
    'En CI hacen falta E2E_ALPHA_EMAIL/PASSWORD. Sin ellas el borrador de VERA en el foro no se prueba contra la base y el verde no significa nada.',
  );
}

test.describe('FORO · VERA deja un borrador de hilo y no lo publica', () => {
  test.skip(!haveCreds, 'sin credenciales E2E_*');
  test.use({ storageState: ALPHA_STORAGE });

  test('VERA rellena el formulario de hilo nuevo, lo dice sin publicar, y el hilo no existe hasta confirmar', async ({
    page,
  }) => {
    const titulo = `E2E borrador VERA ${Date.now()}`;
    const cuerpo = 'Borrador redactado por VERA para el e2e: busco proveedor de juntas de eje.';

    // Cuerpos que el cliente manda al proxy, para ver qué recibe VERA tras ejecutar la herramienta.
    const peticiones: string[] = [];
    await page.route('**/functions/v1/vera', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
          },
        });
        return;
      }
      peticiones.push(req.postData() ?? '');
      const primera = peticiones.length === 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(
          primera
            ? {
                stop_reason: 'tool_use',
                content: [
                  {
                    type: 'tool_use',
                    id: 'toolu_e2e_borrador',
                    name: 'preparar_hilo_foro',
                    input: { titulo, cuerpo },
                  },
                ],
              }
            : {
                stop_reason: 'end_turn',
                content: [{ type: 'text', text: 'Te he dejado el borrador en el formulario. Revísalo antes de publicar.' }],
              },
        ),
      });
    });

    await page.goto('/');
    await topNav(page).getByRole('button', { name: 'Foros' }).click();
    await page.getByRole('button', { name: /Plataforma y soporte/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Plataforma y soporte' })).toBeVisible();

    await page.getByLabel('Pregunta a VERA').fill('Abre un hilo sobre juntas de eje');
    await page.getByRole('button', { name: 'Enviar' }).click();

    // El borrador llega al formulario real, rellenado, y sin publicar.
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo hilo en Plataforma y soporte' })).toBeVisible();
    await expect(page.getByLabel('Título del hilo')).toHaveValue(titulo);
    await expect(page.getByLabel('Cuerpo del hilo')).toHaveValue(cuerpo);
    await expect(page.getByRole('button', { name: 'Publicar hilo' })).toBeEnabled();

    // VERA recibió el resultado de la herramienta con el aviso explícito, y dijo su frase al usuario.
    await expect(page.getByTestId('vera-chat')).toContainText('Revísalo antes de publicar.');
    expect(peticiones).toHaveLength(2);
    expect(peticiones[1]).toContain('toolu_e2e_borrador');
    expect(peticiones[1]).toContain('NO está publicado');

    // Sin confirmar, el hilo no existe: al cancelar, la categoría no lo lista.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Plataforma y soporte' })).toBeVisible();
    await expect(page.getByRole('button', { name: titulo })).toHaveCount(0);
  });
});
