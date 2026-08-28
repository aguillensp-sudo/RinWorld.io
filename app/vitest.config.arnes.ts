import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * ⚠ LA SUITE QUE MIDE EL ARNÉS, que no es la del producto.
 *
 * Única diferencia con `vitest.config.ts`: la última línea de `exclude`. Los
 * `*.fuera-de-contrato.test.*` son tests obligatorios del producto que **ninguna
 * tarea del corpus le pide al Coder** —Realtime, el cableado entre pantallas—, y
 * puntuárselos es medirlo por algo que nadie le mandó construir. En la corrida
 * del 28-ago fueron **tres de los seis rojos de MSG-01**, y encima los que
 * dominaban el recorte del feedback (`F-114`). `F-116` / `B-011`, opción (b),
 * decidida por el PO el 28-ago-2026.
 *
 * Lo usa **C1** (`harness/graph/nodes/test_runner.py`), que lanza
 * `npm run test:arnes` en vez de `npm test`. C2 no lo necesita: corre los
 * ficheros que declara `acceptance.unit`, y esos ya no contienen nada fuera de
 * contrato desde que se partieron.
 *
 * **La exclusión vive aquí y no en `vitest.config.ts`** para que el camino
 * peligroso sea el que salta: olvidarse de esto mide de más y se ve en el primer
 * rojo; ponerlo en el config por defecto perdería cobertura del producto en
 * silencio si alguien olvidara una bandera en la CI.
 *
 * El bloque `test` está copiado y no importado del otro fichero: importar entre
 * configs de Vite sin extensión levanta un aviso en cada corrida, y con
 * extensión choca con `allowImportingTsExtensions: false`. Son cuatro líneas y
 * las dos están en `tsconfig.json`, así que una divergencia la caza `tsc`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      '**/*.fuera-de-contrato.test.{ts,tsx}',
    ],
    css: true,
  },
});
