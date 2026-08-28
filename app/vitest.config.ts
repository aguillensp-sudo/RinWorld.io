import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * LA SUITE DEL PRODUCTO: todo. Es lo que corren `npm test` y la CI, y sigue
 * siendo la de siempre.
 *
 * El que recorta es el arnés, no el producto: `vitest.config.arnes.ts` deja
 * fuera los `*.fuera-de-contrato.test.*` para no puntuarle al Coder lo que su
 * tarea no le pide (`F-116` / `B-011`). La exclusión vive ahí y no aquí a
 * propósito — si viviera aquí, olvidarse de una bandera en la CI perdería
 * cobertura del producto en silencio, y ese es el fallo caro. Al revés no: lo
 * peor que pasa es que el arnés mida de más, y eso salta a la primera.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e es de Playwright; Vitest no debe recogerlo.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    css: true,
  },
});
