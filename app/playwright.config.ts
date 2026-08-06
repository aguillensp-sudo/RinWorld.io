// Vite carga .env por su cuenta para las VITE_*, pero Playwright no carga nada:
// sin esto E2E_* llega vacío, la suite de la puerta se salta entera y el resumen
// dice "3 passed" como si todo estuviera bien. Un skip silencioso es peor que un
// fallo. Va primero y en su propio módulo porque los imports se evalúan antes
// que este cuerpo.
import './e2e/env';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { ALPHA_STORAGE } from './e2e/fixtures';

const isCI = !!process.env.CI;

const reporter: PlaywrightTestConfig['reporter'] = isCI
  ? [['github'], ['html', { open: 'never' }]]
  : [['list']];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // En CI, un worker: los dos contextos del test de la puerta ya prueban el
  // paralelismo que importa, y serializar hace los fallos legibles.
  ...(isCI ? { workers: 1 } : {}),
  reporter,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Autentica una vez y guarda el estado; el proyecto principal lo reutiliza.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ALPHA_STORAGE },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  // `preview` sobre el build, no `dev`: la puerta se prueba contra lo que se
  // despliega, no contra el servidor de desarrollo.
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
