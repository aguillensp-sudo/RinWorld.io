import { describe, expect, it } from 'vitest';
import screen from './Visibility.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana
 * que no declare su propio scroll se recorta SIN barra (F-186 / F-189 / F-190). La
 * regla va escrita en la TAREA del Coder desde SRCH-03 (F-198); este test mide si
 * el generador la cumplio.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('INV-07 · Visibility', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
