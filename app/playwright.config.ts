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
    /**
     * ⚠ LA SIEMBRA SE REPONE ANTES DE NADA, Y ES LO QUE HACE LA SUITE
     * IDEMPOTENTE.
     *
     * Sin esto no se podía escribir un e2e que **enviara un mensaje de verdad**:
     * enviar mueve el hilo al principio de la lista y cambia la vista previa de
     * MSG-01, así que rompía otros dos tests y solo pasaba la primera vez. Lo que
     * faltaba no era el test, era esto — y con ello entra la única cosa de
     * D-08-02 que no se observaba de punta a punta: que escribir en un hilo
     * cerrado lo reabre (D-07-01, `0009`).
     *
     * Va ANTES de `setup` porque publica `members.public_key` de las dos cuentas,
     * y sin esa clave el envío se niega (0012 §3).
     */
    { name: 'fixture', testMatch: /fixture\.setup\.ts/ },
    // Autentica una vez y guarda el estado; el proyecto principal lo reutiliza.
    { name: 'setup', testMatch: /auth\.setup\.ts/, dependencies: ['fixture'] },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ALPHA_STORAGE },
      dependencies: ['setup'],
      testIgnore: /(auth|fixture)\.setup\.ts/,
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
