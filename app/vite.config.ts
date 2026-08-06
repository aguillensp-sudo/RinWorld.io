import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La configuración de Vitest vive en vitest.config.ts: desde Vitest 4 la clave
// `test` ya no se acepta dentro de la config de Vite.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
